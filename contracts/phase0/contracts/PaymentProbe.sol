// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Phase-0, single-task payment probe. Not a production task treasury.
/// Authorization is an on-chain approved operation ID, not an off-chain signature.
contract PaymentProbe is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status { None, Reserved, Settled, Expired }
    struct Payment {
        uint256 amount;
        uint256 deadline;
        uint256 epoch;
        bytes32 requestHash;
        Status status;
    }

    address public immutable owner;
    IERC20 public immutable token;
    address public immutable merchant;
    uint256 public immutable maximumBudget;
    address public worker;
    uint256 public epoch = 1;
    uint256 public deposited;
    uint256 public available;
    uint256 public reserved;
    uint256 public spent;
    uint256 public returned;
    bool public cancelled;
    mapping(bytes32 => Payment) public payments;

    event Reserved(bytes32 indexed operationId, bytes32 requestHash, uint256 amount, uint256 epoch, uint256 deadline);
    event Paid(bytes32 indexed operationId, address indexed merchant, uint256 amount);
    event Expired(bytes32 indexed operationId, uint256 amount);
    event WorkerChanged(address indexed worker, uint256 epoch);
    event Withdrawn(address indexed owner, uint256 amount);

    error Unauthorized();
    error InvalidPayment();
    error Unavailable();
    error NonExactTransfer();

    constructor(address token_, address merchant_, address worker_, uint256 maximumBudget_) {
        if (token_.code.length == 0 || merchant_ == address(0) || worker_ == address(0) || maximumBudget_ == 0) revert InvalidPayment();
        owner = msg.sender;
        token = IERC20(token_);
        merchant = merchant_;
        worker = worker_;
        maximumBudget = maximumBudget_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function deposit(uint256 amount) external onlyOwner nonReentrant {
        if (cancelled || amount == 0 || deposited + amount > maximumBudget) revert Unavailable();
        uint256 beforeBalance = token.balanceOf(address(this));
        token.safeTransferFrom(owner, address(this), amount);
        if (token.balanceOf(address(this)) != beforeBalance + amount) revert NonExactTransfer();
        deposited += amount;
        available += amount;
    }

    function reserve(bytes32 operationId, bytes32 requestHash, uint256 amount, uint256 expectedEpoch, uint256 ttlSeconds) external {
        if (msg.sender != worker) revert Unauthorized();
        if (cancelled || expectedEpoch != epoch || amount == 0 || amount > available) revert Unavailable();
        if (operationId == bytes32(0) || requestHash == bytes32(0) || ttlSeconds == 0 || ttlSeconds > 300 || payments[operationId].status != Status.None) revert InvalidPayment();
        uint256 deadline = block.timestamp + ttlSeconds;
        payments[operationId] = Payment(amount, deadline, epoch, requestHash, Status.Reserved);
        available -= amount;
        reserved += amount;
        emit Reserved(operationId, requestHash, amount, epoch, deadline);
    }

    /// @dev ITransferExecutor signature from the Hedera exact scheme.
    /// Any submitter can execute the exact, previously approved transfer.
    /// This local ERC20 implementation has not established HTS compatibility.
    function executeTransfer(address from, address asset, address to, uint256 amount, bytes calldata authorization) external nonReentrant {
        if (from != address(this) || asset != address(token) || to != merchant || authorization.length != 32) revert InvalidPayment();
        bytes32 operationId = abi.decode(authorization, (bytes32));
        Payment storage payment = payments[operationId];
        if (payment.status != Status.Reserved || payment.amount != amount || block.timestamp >= payment.deadline) revert Unavailable();
        uint256 beforeVault = token.balanceOf(address(this));
        uint256 beforeMerchant = token.balanceOf(merchant);
        payment.status = Status.Settled;
        reserved -= amount;
        spent += amount;
        token.safeTransfer(to, amount);
        if (token.balanceOf(address(this)) + amount != beforeVault || token.balanceOf(merchant) != beforeMerchant + amount) revert NonExactTransfer();
        emit Paid(operationId, merchant, amount);
    }

    function replaceWorker(address replacement) external onlyOwner {
        if (cancelled || replacement == address(0)) revert InvalidPayment();
        worker = replacement;
        epoch += 1;
        emit WorkerChanged(replacement, epoch);
    }

    function cancel() external onlyOwner {
        if (!cancelled) {
            cancelled = true;
            epoch += 1;
        }
    }

    function expire(bytes32 operationId) external {
        Payment storage payment = payments[operationId];
        if (payment.status != Status.Reserved || block.timestamp < payment.deadline) revert Unavailable();
        payment.status = Status.Expired;
        reserved -= payment.amount;
        available += payment.amount;
        emit Expired(operationId, payment.amount);
    }

    function withdrawAvailable(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0 || amount > available) revert Unavailable();
        available -= amount;
        returned += amount;
        token.safeTransfer(owner, amount);
        emit Withdrawn(owner, amount);
    }
}
