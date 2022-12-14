// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import { IERC20 } from "../interfaces/IERC20.sol";
import { Caller } from "./Caller.sol";

library SafeERC20 {
    using Caller for address;

    function safeApprove(IERC20 self, address target, uint256 amount) internal {
        bytes memory cdata = abi.encodeCall(self.approve, (target, amount));
        bytes memory rdata = address(self).doCall(cdata);
        require(
            rdata.length == 0 || abi.decode(rdata, (bool)),
            "SafeERC20: approval failed"
        );
    }
}
