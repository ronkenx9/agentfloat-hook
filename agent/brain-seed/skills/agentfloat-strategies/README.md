# AgentFloat Strategies

Each strategy is a `.md` file in this directory with frontmatter declaring:

- `strategy_id` — matches the on-chain strategy registry ID
- `contract_address` — deployed strategy contract
- `network` + `chain_id`
- `status` — `active` | `shadow` | `paused` | `retired`
- `is_shadow` — true if shadow, false if real-capital
- `expected_apy_bps` — what we expect this to earn (for sanity-check guards)
- `risk_profile` — `zero` | `simulated` | `protocol` | `experimental`
- `paused` — boolean; promoter will refuse to promote a paused strategy
- `description` — one-liner

## To add a new strategy

1. Deploy the contract (implements `IStrategy` interface)
2. Call `FloatVault.registerStrategy(address, isShadow=true)` — note the returned `strategyId`
3. Create `~/brain/skills/agentfloat-strategies/<name>.md` with frontmatter above
4. The brain agent will pick it up on next epoch cycle
5. Watch the score log in `~/brain/raw/agentfloat-strategy-scores.md` to see how it performs

## To pause a strategy

Set `paused: true` in the frontmatter. The promoter will refuse to promote it, and the scorer will still track it for historical context. To resume, flip back to `false`.

## To retire a strategy

Set `status: retired` and the agent will stop scoring it. Keep the file for historical reference — do not delete.

## Why this format?

A strategy spec is metadata + intent, not code. The contract holds the logic; the spec holds the human-readable purpose, expected behavior, and operational rules. Both are needed; neither alone is complete.
