// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IStrategy {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external returns (uint256 actualOut);
    function currentValue() external view returns (uint256);
    function asset() external view returns (address);
    function name() external view returns (string memory);
}
