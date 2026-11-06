// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {PaymentProbe} from "./PaymentProbe.sol";

interface IHederaAssociation {
    function associateToken(address account, address token) external returns (int64);
}

/// @notice Testnet HTS adapter. Keeps the tested reservation and spending boundary.
contract HederaPaymentProbe is PaymentProbe {
    error AssociationFailed(int64 responseCode);

    constructor(address token_, address merchant_, address worker_, uint256 maximumBudget_)
        PaymentProbe(token_, merchant_, worker_, maximumBudget_)
    {
        int64 code = IHederaAssociation(address(0x167)).associateToken(address(this), token_);
        if (code != 22) revert AssociationFailed(code);
    }
}
