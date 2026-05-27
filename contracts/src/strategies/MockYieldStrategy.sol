// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IStrategy} from "../interfaces/IStrategy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IVault {
    function totalDeposits() external view returns (uint256);
}

contract MockYieldStrategy is IStrategy {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlying;
    address public immutable vault;
    string public constant STRATEGY_NAME = "Mock Yield Strategy";

    uint256 public lastUpdateBlock;
    uint256 public bpsPerBlock; // 1 bps = 100 (using 6 decimals for precision, e.g. 1000 = 0.1% per block)
    uint256 public storedBalance;

    constructor(address _underlying, address _vault, uint256 _bpsPerBlock) {
        require(_underlying != address(0), "Zero address underlying");
        require(_vault != address(0), "Zero address vault");
        underlying = IERC20(_underlying);
        vault = _vault;
        bpsPerBlock = _bpsPerBlock;
        lastUpdateBlock = block.number;
    }

    // Accrues simulated yield since last update block
    function _accrueYield() internal view returns (uint256) {
        uint256 baseAmount = storedBalance;
        if (baseAmount == 0) {
            // We are shadow, simulate yield based on the vault's total deposits
            baseAmount = IVault(vault).totalDeposits();
        }

        if (baseAmount == 0 || block.number <= lastUpdateBlock) {
            return baseAmount;
        }

        uint256 blockDelta = block.number - lastUpdateBlock;
        uint256 yield = (baseAmount * blockDelta * bpsPerBlock) / 1000000;
        return baseAmount + yield;
    }

    function deposit(uint256 amount) external override {
        storedBalance = _accrueYield();
        lastUpdateBlock = block.number;

        underlying.safeTransferFrom(msg.sender, address(this), amount);
        storedBalance += amount;
    }

    function withdraw(uint256 amount) external override returns (uint256 actualOut) {
        storedBalance = _accrueYield();
        lastUpdateBlock = block.number;

        if (amount > storedBalance) {
            amount = storedBalance;
        }

        storedBalance -= amount;
        
        // Ensure we don't try to transfer more tokens than we actually hold.
        // In a mock strategy, simulated yield is virtual, so we might not have the actual tokens.
        uint256 actualTokenBalance = underlying.balanceOf(address(this));
        actualOut = amount > actualTokenBalance ? actualTokenBalance : amount;

        if (actualOut > 0) {
            underlying.safeTransfer(msg.sender, actualOut);
        }
        return actualOut;
    }

    function currentValue() external view override returns (uint256) {
        return _accrueYield();
    }

    function asset() external view override returns (address) {
        return address(underlying);
    }

    function name() external view override returns (string memory) {
        return STRATEGY_NAME;
    }
}
