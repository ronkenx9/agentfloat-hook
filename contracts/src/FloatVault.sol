// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IStrategy.sol";

contract FloatVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    mapping(address => uint256) public deposits;
    uint256 public totalDeposits;

    struct StrategyEntry {
        address strategy;       // address of IStrategy implementation
        bool isActive;
        bool isShadow;
        uint256 totalDeposited; // tracked separately from real deposits
        uint256 lastScore;      // last score posted by the brain agent
        uint256 lastScoreAt;
    }

    mapping(uint256 => StrategyEntry) public strategies;
    uint256 public activeStrategyId;
    uint256 public strategyCount;

    address public promoter;  // address authorized to call promote()

    // Decentralized promotion configurations
    mapping(uint256 => uint256) public consecutiveWins;
    uint256 public minDeltaBps = 10;
    uint256 public minEpochsConsecutive = 5;

    event Parked(address indexed agent, uint256 amount);
    event Withdrawn(address indexed agent, uint256 amount);
    event StrategyRegistered(uint256 indexed id, address strategy, string name);
    event StrategyPromoted(uint256 indexed fromId, uint256 indexed toId, uint256 atBlock);
    event ScoreUpdated(uint256 indexed strategyId, uint256 score, uint256 epoch);
    event PromoterUpdated(address indexed previousPromoter, address indexed newPromoter);
    event PromotionThresholdsUpdated(uint256 minDeltaBps, uint256 minEpochsConsecutive);

    modifier onlyPromoter() {
        require(msg.sender == promoter || msg.sender == owner(), "Not promoter or owner");
        _;
    }

    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "Zero address usdc");
        usdc = IERC20(_usdc);
        promoter = msg.sender;
    }

    function setPromoter(address _promoter) external onlyOwner {
        require(_promoter != address(0), "Zero address promoter");
        emit PromoterUpdated(promoter, _promoter);
        promoter = _promoter;
    }

    function setPromotionThresholds(uint256 _minDeltaBps, uint256 _minEpochsConsecutive) external onlyOwner {
        minDeltaBps = _minDeltaBps;
        minEpochsConsecutive = _minEpochsConsecutive;
        emit PromotionThresholdsUpdated(_minDeltaBps, _minEpochsConsecutive);
    }

    // Agent parks idle USDC into the vault
    function park(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        deposits[msg.sender] += amount;
        totalDeposits += amount;
        
        // Update totalDeposited for all strategies
        uint256 count = strategyCount;
        for (uint256 i = 1; i <= count; i++) {
            strategies[i].totalDeposited += amount;
        }

        // Route to active strategy
        if (activeStrategyId != 0) {
            address activeStrategy = strategies[activeStrategyId].strategy;
            usdc.approve(activeStrategy, 0);
            usdc.approve(activeStrategy, amount);
            IStrategy(activeStrategy).deposit(amount);
        }
        
        emit Parked(msg.sender, amount);
    }

    // Agent withdraws USDC from the vault instantly
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(deposits[msg.sender] >= amount, "Insufficient deposit");
        
        deposits[msg.sender] -= amount;
        totalDeposits -= amount;

        // Update totalDeposited for all strategies
        uint256 count = strategyCount;
        for (uint256 i = 1; i <= count; i++) {
            if (strategies[i].totalDeposited >= amount) {
                strategies[i].totalDeposited -= amount;
            } else {
                strategies[i].totalDeposited = 0;
            }
        }

        // Pull from active strategy
        if (activeStrategyId != 0) {
            address activeStrategy = strategies[activeStrategyId].strategy;
            IStrategy(activeStrategy).withdraw(amount);
        }

        usdc.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }

    // Registers a new strategy
    function registerStrategy(address strategy, bool asShadow) external onlyOwner returns (uint256 id) {
        require(strategy != address(0), "Zero address strategy");
        
        strategyCount++;
        id = strategyCount;
        
        bool isActive = false;
        if (!asShadow) {
            // Deactivate old active strategy
            if (activeStrategyId != 0) {
                strategies[activeStrategyId].isActive = false;
                strategies[activeStrategyId].isShadow = true;
            }
            isActive = true;
            activeStrategyId = id;
        }
        
        strategies[id] = StrategyEntry({
            strategy: strategy,
            isActive: isActive,
            isShadow: asShadow,
            totalDeposited: totalDeposits, // Initialize to current vault deposits
            lastScore: 0,
            lastScoreAt: block.number
        });
        
        emit StrategyRegistered(id, strategy, IStrategy(strategy).name());
    }

    // Post strategy score
    function postScore(uint256 strategyId, uint256 score) external onlyPromoter {
        require(strategyId <= strategyCount && strategyId != 0, "Invalid strategy ID");
        strategies[strategyId].lastScore = score;
        strategies[strategyId].lastScoreAt = block.number;
        emit ScoreUpdated(strategyId, score, block.number);

        // Update consecutive wins for shadow strategies
        if (strategyId != activeStrategyId && activeStrategyId != 0) {
            uint256 activeScore = strategies[activeStrategyId].lastScore;
            if (score >= activeScore + minDeltaBps) {
                consecutiveWins[strategyId] += 1;
            } else {
                consecutiveWins[strategyId] = 0;
            }
        }
    }

    // Promote shadow strategy to active
    function promote(uint256 strategyId) external nonReentrant {
        require(strategyId <= strategyCount && strategyId != 0, "Invalid strategy ID");
        StrategyEntry storage newActive = strategies[strategyId];
        require(newActive.isShadow, "Strategy must be shadow");
        
        // Trustless promotion: if eligible, anyone can promote.
        // Otherwise, only promoter or owner can force promote.
        if (consecutiveWins[strategyId] < minEpochsConsecutive) {
            require(msg.sender == promoter || msg.sender == owner(), "Not eligible and not promoter/owner");
        }

        uint256 oldActiveId = activeStrategyId;
        
        // 1. Withdraw all funds from current active strategy
        if (oldActiveId != 0) {
            StrategyEntry storage oldActive = strategies[oldActiveId];
            address oldStrategy = oldActive.strategy;
            uint256 val = IStrategy(oldStrategy).currentValue();
            if (val > 0) {
                // Withdraw from old strategy to the vault
                IStrategy(oldStrategy).withdraw(val);
            }
            oldActive.isActive = false;
            oldActive.isShadow = true;
            consecutiveWins[oldActiveId] = 0; // Reset wins tracking
        }
        
        // 2. Deposit all USDC in the vault into the new active strategy
        address newStrategy = newActive.strategy;
        uint256 usdcBalance = usdc.balanceOf(address(this));
        if (usdcBalance > 0) {
            usdc.approve(newStrategy, 0);
            usdc.approve(newStrategy, usdcBalance);
            IStrategy(newStrategy).deposit(usdcBalance);
        }
        
        // Update states
        newActive.isActive = true;
        newActive.isShadow = false;
        activeStrategyId = strategyId;
        consecutiveWins[strategyId] = 0; // Reset wins tracking
        
        emit StrategyPromoted(oldActiveId, strategyId, block.number);
    }
}
