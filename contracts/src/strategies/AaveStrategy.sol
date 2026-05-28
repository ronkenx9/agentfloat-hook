// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IStrategy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IAavePool {
    struct ReserveConfigurationMap {
        uint256 data;
    }

    struct ReserveData {
        ReserveConfigurationMap configuration;
        uint128 liquidityIndex;
        uint128 currentLiquidityRate;
        uint128 variableBorrowIndex;
        uint128 currentVariableBorrowRate;
        uint128 currentStableBorrowRate;
        uint40 lastUpdateTimestamp;
        uint16 id;
        address aTokenAddress;
        address stableDebtTokenAddress;
        address variableDebtTokenAddress;
        address interestRateStrategyAddress;
        address accruedToTreasury;
        uint128 unbacked;
        uint128 isolationModeTotalDebt;
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
    function getReserveData(address asset) external view returns (ReserveData memory);
}

contract AaveStrategy is IStrategy {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlying;
    IAavePool public immutable pool;
    IERC20 public immutable aToken;
    address public immutable vault;
    string public constant STRATEGY_NAME = "Aave V3 Yield Strategy";

    uint256 public storedBalance;
    uint256 public lastLiquidityIndex;

    modifier onlyVault() {
        require(msg.sender == vault, "Only vault");
        _;
    }

    constructor(address _underlying, address _pool, address _aToken, address _vault) {
        require(_underlying != address(0), "Zero address underlying");
        require(_pool != address(0), "Zero address pool");
        require(_aToken != address(0), "Zero address aToken");
        require(_vault != address(0), "Zero address vault");
        underlying = IERC20(_underlying);
        pool = IAavePool(_pool);
        aToken = IERC20(_aToken);
        vault = _vault;
        lastLiquidityIndex = getAaveLiquidityIndex();
    }

    function getAaveLiquidityIndex() public view returns (uint256) {
        IAavePool.ReserveData memory data = pool.getReserveData(address(underlying));
        return uint256(data.liquidityIndex);
    }

    function deposit(uint256 amount) external override onlyVault {
        // Update simulated balance before receiving new funds
        storedBalance = currentValue();
        lastLiquidityIndex = getAaveLiquidityIndex();

        underlying.safeTransferFrom(msg.sender, address(this), amount);
        
        // Approve and supply to Aave Pool
        underlying.approve(address(pool), 0);
        underlying.approve(address(pool), amount);
        pool.supply(address(underlying), amount, address(this), 0);

        storedBalance += amount;
    }

    function withdraw(uint256 amount) external override onlyVault returns (uint256 actualOut) {
        storedBalance = currentValue();
        lastLiquidityIndex = getAaveLiquidityIndex();

        if (amount > storedBalance) {
            amount = storedBalance;
        }

        storedBalance -= amount;

        // Perform actual withdrawal from Aave Pool
        // The pool burns our aTokens and transfers underlying to msg.sender
        actualOut = pool.withdraw(address(underlying), amount, msg.sender);
        return actualOut;
    }

    function currentValue() public view override returns (uint256) {
        uint256 realBalance = aToken.balanceOf(address(this));
        if (realBalance > 0) {
            return realBalance;
        }

        // If in shadow mode (no real aTokens held), calculate virtual balance based on liquidity index growth
        if (storedBalance == 0) {
            return 0;
        }
        
        uint256 currentIndex = getAaveLiquidityIndex();
        if (currentIndex <= lastLiquidityIndex || lastLiquidityIndex == 0) {
            return storedBalance;
        }

        // liquidityIndex is expressed in Ray (27 decimals), so scale properly
        return (storedBalance * currentIndex) / lastLiquidityIndex;
    }

    function asset() external view override returns (address) {
        return address(underlying);
    }

    function name() external view override returns (string memory) {
        return STRATEGY_NAME;
    }
}
