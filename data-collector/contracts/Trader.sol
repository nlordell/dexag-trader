// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

import { IERC20 } from "./interfaces/IERC20.sol";
import { Caller } from "./libraries/Caller.sol";
import { SafeERC20 } from "./libraries/SafeERC20.sol";

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
