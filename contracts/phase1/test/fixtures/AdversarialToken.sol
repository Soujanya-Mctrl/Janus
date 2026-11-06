// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test fixture only: can enable a one-unit transfer tax after funding.
contract AdversarialToken is ERC20 {
    bool public taxed;
    constructor() ERC20("Adversarial LOCAL TEST", "BAD") { _mint(msg.sender, 1_000_000 * 10 ** 6); }
    function decimals() public pure override returns (uint8) { return 6; }
    function setTaxed(bool value) external { taxed = value; }
    function _update(address from, address to, uint256 value) internal override {
        if (taxed && from != address(0) && to != address(0) && value > 0) {
            super._update(from, to, value - 1);
            super._update(from, address(0), 1);
        } else super._update(from, to, value);
    }
}
