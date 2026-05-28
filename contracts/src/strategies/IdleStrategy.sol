// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IStrategy} from "../interfaces/IStrategy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract IdleStrategy is IStrategy {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlying;
    address public immutable vault;
    string public constant STRATEGY_NAME = "Idle USDC Strategy";

    modifier onlyVault() {
        require(msg.sender == vault, "Only vault");
        _;
    }

    constructor(address _underlying, address _vault) {
        require(_underlying != address(0), "Zero address");
        require(_vault != address(0), "Zero address vault");
        underlying = IERC20(_underlying);
        vault = _vault;
    }

    function deposit(uint256 amount) external override onlyVault {
        underlying.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) external override onlyVault returns (uint256 actualOut) {
        underlying.safeTransfer(msg.sender, amount);
        return amount;
    }

    function currentValue() external view override returns (uint256) {
        return underlying.balanceOf(address(this));
    }

    function asset() external view override returns (address) {
        return address(underlying);
    }

    function name() external view override returns (string memory) {
        return STRATEGY_NAME;
    }
}
