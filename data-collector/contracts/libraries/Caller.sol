// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

library Caller {
    function doCall(address self, bytes memory cdata) internal returns (bytes memory rdata) {
        bool success;
        (success, rdata) = self.call(cdata);
        if (!success) {
            assembly { revert(add(rdata, 32), mload(rdata)) }
        }
    }
}
