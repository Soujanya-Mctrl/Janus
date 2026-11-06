// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Local test fixture, not USDC or an HTS token.
contract TestToken is ERC20 {
    constructor() ERC20("RelayBudget LOCAL TEST", "LOCAL") {
        _mint(msg.sender, 1_000_000 * 10 ** 6);
    }
    function decimals() public pure override returns (uint8) { return 6; }
}
