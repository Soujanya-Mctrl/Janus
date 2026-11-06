// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Flat, single-asset task budgets. Workers approve exact payments on-chain.
/// The scheduler can replace workers, but cannot change financial policy or withdraw.
contract TaskTreasury is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status { None, Reserved, Settled, Expired }
    struct Task {
        uint256 cap;
        uint256 available;
        uint256 reserved;
        uint256 spent;
        uint256 returned;
        uint256 perOperationLimit;
        address worker;
        address merchant;
        uint64 epoch;
        bool cancelled;
    }
    struct Operation {
        uint256 amount;
        uint256 deadline;
        bytes32 requestHash;
        uint64 epoch;
        uint64 attempt;
        Status status;
    }

    address public immutable owner;
    IERC20 public immutable token;
    address public scheduler;
    uint256 public deposited;
    uint256 public unallocated;
    uint256 public totalAvailable;
    uint256 public totalReserved;
    uint256 public totalSpent;
    uint256 public totalWithdrawn;
    mapping(bytes32 => Task) public tasks;
    mapping(bytes32 => Operation) private operations;

    error Unauthorized();
    error InvalidTask();
    error InvalidOperation();
    error Unavailable();
    error NonExactTransfer();

    event Deposited(uint256 amount);
    event TaskCreated(bytes32 indexed taskId, address worker, address merchant, uint256 cap, uint256 perOperationLimit);
    event WorkerAssigned(bytes32 indexed taskId, address indexed worker, uint64 epoch);
    event SchedulerChanged(address indexed scheduler);
    event Reserved(bytes32 indexed taskId, bytes32 indexed operationId, uint64 attempt, uint256 amount, uint64 epoch, uint256 deadline);
    event Paid(bytes32 indexed taskId, bytes32 indexed operationId, uint64 attempt, address merchant, uint256 amount);
    event Expired(bytes32 indexed taskId, bytes32 indexed operationId, uint64 attempt, uint256 amount);
    event TaskCancelled(bytes32 indexed taskId, uint64 epoch);
    event Released(bytes32 indexed taskId, uint256 amount);
    event Withdrawn(uint256 amount);

    constructor(address token_) {
        if (token_.code.length == 0) revert InvalidTask();
        owner = msg.sender;
        token = IERC20(token_);
    }
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function deposit(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert Unavailable();
        uint256 beforeBalance = token.balanceOf(address(this));
        token.safeTransferFrom(owner, address(this), amount);
        if (token.balanceOf(address(this)) != beforeBalance + amount) revert NonExactTransfer();
        deposited += amount;
        unallocated += amount;
        emit Deposited(amount);
    }

    function createTask(bytes32 taskId, address worker, address merchant, uint256 cap, uint256 perOperationLimit) external onlyOwner {
        if (taskId == bytes32(0) || tasks[taskId].cap != 0 || worker == address(0) || merchant == address(0) || merchant == address(this)
            || cap == 0 || perOperationLimit == 0 || perOperationLimit > cap) revert InvalidTask();
        if (cap > unallocated) revert Unavailable();
        tasks[taskId] = Task(cap, cap, 0, 0, 0, perOperationLimit, worker, merchant, 1, false);
        unallocated -= cap;
        totalAvailable += cap;
        emit TaskCreated(taskId, worker, merchant, cap, perOperationLimit);
    }

    function setScheduler(address replacement) external onlyOwner {
        scheduler = replacement; // Zero disables delegated scheduling; owner access remains.
        emit SchedulerChanged(replacement);
    }

    function assignWorker(bytes32 taskId, address replacement) external {
        if (msg.sender != owner && msg.sender != scheduler) revert Unauthorized();
        Task storage task = _task(taskId);
        if (task.cancelled || replacement == address(0)) revert InvalidTask();
        task.worker = replacement;
        task.epoch += 1;
        emit WorkerAssigned(taskId, replacement, task.epoch);
    }

    function reserve(bytes32 taskId, bytes32 operationId, bytes32 requestHash, uint256 amount, uint64 expectedEpoch, uint64 expectedAttempt, uint256 ttlSeconds) external nonReentrant {
        Task storage task = _task(taskId);
        if (msg.sender != task.worker) revert Unauthorized();
        if (task.cancelled || task.epoch != expectedEpoch || amount == 0 || amount > task.available || amount > task.perOperationLimit) revert Unavailable();
        if (operationId == bytes32(0) || requestHash == bytes32(0) || ttlSeconds == 0 || ttlSeconds > 300) revert InvalidOperation();
        Operation storage operation = operations[_key(taskId, operationId)];
        if (operation.status != Status.None && operation.status != Status.Expired) revert InvalidOperation();
        if (expectedAttempt != operation.attempt + 1) revert InvalidOperation();
        if (operation.status == Status.None) {
            operation.requestHash = requestHash;
            operation.amount = amount;
        } else if (operation.requestHash != requestHash || operation.amount != amount) revert InvalidOperation();
        operation.deadline = block.timestamp + ttlSeconds;
        operation.epoch = task.epoch;
        operation.attempt = expectedAttempt;
        operation.status = Status.Reserved;
        task.available -= amount;
        task.reserved += amount;
        totalAvailable -= amount;
        totalReserved += amount;
        emit Reserved(taskId, operationId, expectedAttempt, amount, task.epoch, operation.deadline);
    }

    /// @dev ITransferExecutor. Authorization is abi.encode(taskId, operationId, attempt).
    /// Old-epoch reservations remain valid obligations until their individual deadline.
    function executeTransfer(address from, address asset, address to, uint256 amount, bytes calldata authorization) external nonReentrant {
        if (from != address(this) || asset != address(token) || authorization.length != 96) revert InvalidOperation();
        (bytes32 taskId, bytes32 operationId, uint64 attempt) = abi.decode(authorization, (bytes32, bytes32, uint64));
        Task storage task = _task(taskId);
        Operation storage operation = operations[_key(taskId, operationId)];
        if (to != task.merchant) revert InvalidOperation();
        if (operation.status != Status.Reserved || operation.attempt != attempt || operation.amount != amount || block.timestamp >= operation.deadline) revert Unavailable();
        operation.status = Status.Settled;
        task.reserved -= amount;
        task.spent += amount;
        totalReserved -= amount;
        totalSpent += amount;
        _transferExact(to, amount);
        emit Paid(taskId, operationId, attempt, to, amount);
    }

    function expire(bytes32 taskId, bytes32 operationId, uint64 expectedAttempt) external {
        Task storage task = _task(taskId);
        Operation storage operation = operations[_key(taskId, operationId)];
        if (operation.status != Status.Reserved || operation.attempt != expectedAttempt || block.timestamp < operation.deadline) revert Unavailable();
        operation.status = Status.Expired;
        task.reserved -= operation.amount;
        task.available += operation.amount;
        totalReserved -= operation.amount;
        totalAvailable += operation.amount;
        emit Expired(taskId, operationId, expectedAttempt, operation.amount);
    }

    function cancelTask(bytes32 taskId) external onlyOwner {
        Task storage task = _task(taskId);
        if (!task.cancelled) {
            task.cancelled = true;
            task.epoch += 1;
            emit TaskCancelled(taskId, task.epoch);
        }
    }

    /// @notice Release only this task's free balance to the owner's treasury reserve.
    /// Cap and returned history remain fixed; new funding uses a new task ID.
    function releaseAvailable(bytes32 taskId, uint256 amount) external onlyOwner {
        Task storage task = _task(taskId);
        if (amount == 0 || amount > task.available) revert Unavailable();
        task.available -= amount;
        task.returned += amount;
        totalAvailable -= amount;
        unallocated += amount;
        emit Released(taskId, amount);
    }

    function withdrawUnallocated(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0 || amount > unallocated) revert Unavailable();
        unallocated -= amount;
        totalWithdrawn += amount;
        _transferExact(owner, amount);
        emit Withdrawn(amount);
    }

    function getOperation(bytes32 taskId, bytes32 operationId) external view returns (Operation memory) {
        return operations[_key(taskId, operationId)];
    }
    function accountedBalance() external view returns (uint256) {
        return unallocated + totalAvailable + totalReserved;
    }
    function _task(bytes32 taskId) private view returns (Task storage task) {
        task = tasks[taskId];
        if (task.cap == 0) revert InvalidTask();
    }
    function _key(bytes32 taskId, bytes32 operationId) private pure returns (bytes32) {
        return keccak256(abi.encode(taskId, operationId));
    }
    function _transferExact(address to, uint256 amount) private {
        uint256 beforeVault = token.balanceOf(address(this));
        uint256 beforeRecipient = token.balanceOf(to);
        token.safeTransfer(to, amount);
        if (token.balanceOf(address(this)) + amount != beforeVault || token.balanceOf(to) != beforeRecipient + amount) revert NonExactTransfer();
    }
}
