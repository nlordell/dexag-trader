// SPDX-License-Identifier: MIT
pragma solidity ^0.8;

interface IERC20 {
    function balanceOf(address holder) external view returns (uint256);
    function approve(address target, uint256 amount) external returns (bool);
}
