// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {TaskTreasury} from "./TaskTreasury.sol";

interface IHTSAssociation {
    function associateToken(address account, address token) external returns (int64);
}
contract HederaTaskTreasury is TaskTreasury {
    error AssociationFailed(int64 responseCode);
    constructor(address token_) TaskTreasury(token_) {
        int64 code = IHTSAssociation(address(0x167)).associateToken(address(this), token_);
        if (code != 22) revert AssociationFailed(code);
    }
}
