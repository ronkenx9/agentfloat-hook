import { startWatcher } from './watcher';
import { startApi } from './api';

console.log('==================================================');
console.log('            AGENTFLOAT BRAIN AGENT                ');
console.log('==================================================');

// HTTP API (port 4000 by default) — serves the dashboard
startApi();

// On-chain watcher loop (scoring, promotion, orchestration, consolidation)
startWatcher().catch((error) => {
  console.error('Fatal error in agent watcher:', error);
  process.exit(1);
});
