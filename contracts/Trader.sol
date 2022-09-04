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

interface IERC20 {
    function balanceOf(address holder) external view returns (uint256);
    function approve(address target, uint256 amount) external returns (bool);
}

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

contract Trader {
    using Caller for address;
    using SafeERC20 for IERC20;

    function trade(
        IERC20 tokenIn,
        IERC20 tokenOut,
        address spender,
        address exchange,
        bytes calldata cdata
    ) external returns (uint256 executedIn, uint256 executedOut) {
        uint256 balanceIn = tokenIn.balanceOf(address(this));
        uint256 balanceOut = tokenOut.balanceOf(address(this));

        if (spender != address(0)) {
            tokenIn.safeApprove(spender, type(uint256).max);
        }
        exchange.doCall(cdata);

        executedIn = balanceIn - tokenIn.balanceOf(address(this));
        executedOut = tokenOut.balanceOf(address(this)) - balanceOut;
    }
}
