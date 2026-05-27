import { parseAbi } from 'viem';

export const FLOAT_VAULT_ABI = parseAbi([
  'function strategies(uint256) view returns (address strategy, bool isActive, bool isShadow, uint256 totalDeposited, uint256 lastScore, uint256 lastScoreAt)',
  'function activeStrategyId() view returns (uint256)',
  'function strategyCount() view returns (uint256)',
  'function promoter() view returns (address)',
  'function owner() view returns (address)',
  'function postScore(uint256 strategyId, uint256 score) external',
  'function promote(uint256 strategyId) external',
  'function park(uint256 amount) external',
  'function withdraw(uint256 amount) external',
  'function registerStrategy(address strategy, bool asShadow) external returns (uint256)',
  'event Parked(address indexed agent, uint256 amount)',
  'event Withdrawn(address indexed agent, uint256 amount)',
  'event StrategyRegistered(uint256 indexed id, address strategy, string name)',
  'event StrategyPromoted(uint256 indexed fromId, uint256 indexed toId, uint256 atBlock)',
  'event ScoreUpdated(uint256 indexed strategyId, uint256 score, uint256 epoch)'
]);

export const STRATEGY_ABI = parseAbi([
  'function deposit(uint256 amount) external',
  'function withdraw(uint256 amount) external returns (uint256 actualOut)',
  'function currentValue() view returns (uint256)',
  'function asset() view returns (address)',
  'function name() view returns (string)'
]);
