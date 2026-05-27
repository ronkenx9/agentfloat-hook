#!/usr/bin/env bash
# Install Foundry deps for AgentFloat contracts.
# Run from the contracts/ directory.

set -euo pipefail

if [ ! -f foundry.toml ]; then
  echo "error: run from contracts/ directory (foundry.toml not found)"
  exit 1
fi

if ! command -v forge &> /dev/null; then
  echo "error: forge not found. Install Foundry first: https://book.getfoundry.sh/getting-started/installation"
  exit 1
fi

echo "[setup] Installing Foundry dependencies..."

# Versions tested against during the Hook the Future hackathon (May 2026).
# Update at your own risk — newer v4-core/v4-periphery may shift the BaseHook interface.
forge install --no-git --no-commit \
  foundry-rs/forge-std@v1.9.4 \
  OpenZeppelin/openzeppelin-contracts@v5.0.2 \
  Uniswap/v4-core@main \
  Uniswap/v4-periphery@main

echo "[setup] Building contracts..."
forge build

echo "[setup] Running tests..."
forge test

echo
echo "[setup] Done. If tests passed, you're ready to deploy."
echo "[setup] Next: configure .env (see ../.env.example) and run:"
echo "         forge script script/Deploy.s.sol --rpc-url \$X_LAYER_RPC_URL --broadcast"
