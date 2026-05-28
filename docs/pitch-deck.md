---
marp: true
theme: default
paginate: true
size: 16:9
title: AgentFloat
description: Pitch deck for AgentFloat, a Uniswap v4 yield-routing hook on X Layer.
output: pitch-deck.pdf
---

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;1,8..60,400&display=swap');

:root {
  --paper: #E3D3BF;
  --ink: #181614;
  --muted: #5F574D;
  --line: rgba(24, 22, 20, 0.22);
  --gold: #C39C4E;
}

section {
  background: var(--paper);
  color: var(--ink);
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 58px 72px;
  letter-spacing: 0;
}

h1, h2 {
  font-family: "Source Serif 4", Georgia, serif;
  font-weight: 400;
  letter-spacing: 0;
  margin: 0;
}

h1 {
  font-size: 86px;
  line-height: 0.9;
}

h2 {
  font-size: 50px;
  line-height: 1.02;
  max-width: 930px;
}

p, li {
  font-size: 28px;
  line-height: 1.22;
}

p {
  max-width: 920px;
}

em {
  font-style: italic;
  color: var(--ink);
}

code, .mono, table, .caption, .label {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0;
}

code {
  color: var(--ink);
  background: transparent;
}

.brand {
  color: var(--gold);
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 20px;
  letter-spacing: 0;
  margin-bottom: 28px;
}

.quiet {
  color: var(--muted);
}

.accent {
  color: var(--gold);
}

.rule {
  width: 88px;
  height: 3px;
  background: var(--gold);
  margin: 34px 0 26px;
}

.split {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 54px;
  align-items: center;
}

.stack {
  display: grid;
  gap: 14px;
}

.box {
  border: 1.5px solid var(--line);
  border-radius: 6px;
  padding: 18px 20px;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 18px;
  line-height: 1.3;
}

.box strong {
  color: var(--ink);
  font-weight: 600;
}

.node {
  border: 1.5px solid var(--line);
  border-radius: 6px;
  padding: 14px 16px;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 18px;
  line-height: 1.2;
  background: rgba(255,255,255,0.1);
}

.node.gold {
  border-color: var(--gold);
}

.arrow {
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--muted);
  text-align: center;
  font-size: 20px;
}

.flow {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.diagram-row {
  display: grid;
  grid-template-columns: 1fr 44px 1fr 44px 1fr;
  align-items: center;
  gap: 8px;
}

.small {
  font-size: 18px;
  line-height: 1.28;
}

.caption {
  color: var(--muted);
  font-size: 16px;
  line-height: 1.25;
  margin-top: 12px;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-top: 34px;
}

.kpi {
  border-top: 3px solid var(--gold);
  padding-top: 14px;
}

.kpi strong {
  display: block;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 36px;
  font-weight: 500;
  line-height: 1;
}

.kpi span {
  display: block;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--muted);
  font-size: 15px;
  line-height: 1.25;
  margin-top: 10px;
}

.usecase-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-top: 34px;
}

.usecase {
  border-top: 3px solid var(--gold);
  padding-top: 16px;
}

.usecase h3 {
  font-family: "Source Serif 4", Georgia, serif;
  font-size: 31px;
  font-weight: 400;
  line-height: 1.05;
  margin: 0 0 12px;
}

.usecase p {
  font-size: 16px;
  line-height: 1.32;
  margin: 0;
  color: var(--muted);
}

.faq-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 30px;
}

.faq {
  border: 1.5px solid var(--line);
  border-radius: 6px;
  padding: 16px 18px;
}

.faq .q {
  display: block;
  font-family: "Source Serif 4", Georgia, serif;
  font-size: 25px;
  line-height: 1.08;
  margin-bottom: 10px;
}

.faq .a {
  display: block;
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.35;
}

.photo-copy {
  position: relative;
  z-index: 1;
  max-width: 560px;
  color: var(--paper);
  text-shadow: 0 1px 18px rgba(0, 0, 0, 0.52);
}

.photo-copy h2 {
  color: var(--paper);
}

.photo-copy .brand {
  color: var(--gold);
}

.photo-copy .caption {
  color: rgba(227, 211, 191, 0.84);
}

.photo-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(24, 22, 20, 0.78), rgba(24, 22, 20, 0.22), rgba(24, 22, 20, 0));
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 17px;
  line-height: 1.22;
}

th {
  color: var(--muted);
  font-weight: 500;
  text-align: left;
}

td, th {
  border-bottom: 1px solid var(--line);
  padding: 10px 8px;
}

ul {
  margin: 28px 0 0;
  padding-left: 24px;
}

li {
  margin: 10px 0;
}

section::after {
  color: var(--muted);
  font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
}
</style>

<!-- _class: title -->

![bg cover](/Users/gadgetplug/Documents/vibecoding/agentfloat-hook/web/public/hero%20image%20.png)

<div class="brand">AgentFloat</div>

# AgentFloat

---

## Concentrated liquidity can go quiet.

When a v4 LP position drifts out of range, that capital stops earning trading fees. AgentFloat treats the idle interval as yield inventory, then recalls it when swaps need liquidity again.

<div class="kpis">
  <div class="kpi"><strong>v4</strong><span>hook surface</span></div>
  <div class="kpi"><strong>0</strong><span>fees while out of range</span></div>
  <div class="kpi"><strong>JIT</strong><span>recall before swaps</span></div>
  <div class="kpi"><strong>USDT</strong><span>mainnet Aave route</span></div>
</div>

---

## The category move is <em>selection</em>.

Most v4 yield hooks route capital to a hardcoded protocol. AgentFloat's downstream destination is chosen by a self-improving system.

<div class="diagram-row" style="margin-top: 42px;">
  <div class="node">v4 hook<br><span class="quiet">idle LP capital</span></div>
  <div class="arrow">→</div>
  <div class="node gold">FloatVault<br><span class="quiet">active + shadow strategies</span></div>
  <div class="arrow">→</div>
  <div class="node">promote()<br><span class="quiet">only after scored wins</span></div>
</div>

---

## Architecture: contracts execute, brain selects.

<div class="split">
<div class="flow">
  <div class="node">Uniswap v4 Pool<br><span class="quiet">afterAddLiquidity · beforeSwap · afterRemoveLiquidity</span></div>
  <div class="arrow">↓</div>
  <div class="node gold">AgentFloatHook<br><span class="quiet">routes out-of-range USDT</span></div>
  <div class="arrow">↓</div>
  <div class="node">FloatVault<br><span class="quiet">activeStrategyId · shadowStrategyIds[] · consecutiveWins</span></div>
  <div class="arrow">↓</div>
  <div class="node">IStrategy<br><span class="quiet">Idle · Aave V3 USDT · future library</span></div>
</div>
<div class="flow">
  <div class="node">Brain Agent<br><span class="quiet">watcher · scorer · promoter · orchestrator</span></div>
  <div class="arrow">↓</div>
  <div class="node">Operator brain<br><span class="quiet">strategy specs · proposals · scoring · operating mode</span></div>
  <div class="arrow">↓</div>
  <div class="node">Guardrails<br><span class="quiet">chain allowlists · audit rules · rate limits</span></div>
</div>
</div>

---

## The loop closed on-chain.

<div class="split">
<div class="stack">
  <div class="box">proposal: 2026-05-26-999-parameter_variant.md<br>action_type: parameter_variant<br>status: executed<br>decision_reason: autonomous mode: all guardrails cleared</div>
  <div class="box">deployer log<br>strategy_id: 3<br>name: Mock Yield Strategy (v3)<br>constructor: bpsPerBlock=200</div>
</div>
<div class="stack">
  <div class="box">OKLink tx<br>0x4245ab63…51e88</div>
  <div class="box">deployed contract<br>0xb742…ac63bd</div>
  <div class="caption">Proposal frontmatter → deployer log → OKLink transaction → registered strategy contract.</div>
</div>
</div>

---

## We built the AI a leash before autonomy.

The AI can propose and deploy shadows under policy. Real capital is gated by the vault's on-chain <span class="mono">consecutiveWins</span> counter.

| Network | Chain | AI can | AI cannot |
|---|---:|---|---|
| X Layer testnet | `1952` | `parameter_variant`, `new_strategy`, `register_strategy`, `retire`, `scoring_change` | bypass `consecutiveWins` |
| X Layer mainnet | `196` | `register_strategy`, `retire`, `scoring_change`, `no_action` | deploy new Solidity |

<div class="caption">Source of truth: <span class="mono">chain_actions_allowed</span> in the operating-mode policy.</div>

---

## Mainnet is live on X Layer.

| Contract | Address | Receipt |
|---|---|---|
| AgentFloatHook | `0x5Ba6671e…4580` | permission bits `0x580` |
| FloatVault | `0xbF06de10…a6f4` | strategy registry |
| Flap Factory | `0x87D665B8…24F8` | yield tax vaults |
| AaveStrategy | `0x4C109f12…56E1` | real Aave V3 USDT |
| IdleStrategy | `0xf292e500…5EEb` | baseline |
| PoolManager | `0x360e68fa…fb32` | canonical v4 |
| USDT / USDC | `0x779Ded0c…3736` | USDt0 |

<div class="caption">Total deploy cost: <span class="mono">0.000372 OKB</span>, about <span class="mono">$0.09</span>.</div>

---

## Flap tokens can opt in with one deploy.

<div class="split">
<div>
`FlapYieldTaxVaultFactory` lets any Flap-graduated token route tax revenue into AgentFloat instead of leaving it idle.
</div>
<div class="flow">
  <div class="node gold">newVault(taxToken, quoteToken, creator)</div>
  <div class="arrow">↓</div>
  <div class="node">FlapYieldTaxVault</div>
  <div class="arrow">↓</div>
  <div class="node">FloatVault → AaveStrategy</div>
</div>
</div>

<div class="caption">Quote paths: <span class="mono">ERC20</span> · native <span class="mono">OKB → WOKB</span> · custom <span class="mono">ERC20</span>.</div>

---

![bg cover](/Users/gadgetplug/Documents/vibecoding/agentfloat-hook/web/public/middle.png)
<div class="photo-scrim"></div>

<div class="photo-copy">
<div class="brand">Use cases</div>

## One hook, multiple idle-balance surfaces.

<div class="caption">AgentFloat is useful wherever liquidity has to wait before it is useful again.</div>
</div>

---

## Use cases for the hook.

<div class="usecase-grid">
  <div class="usecase">
    <h3>Out-of-range LP capital.</h3>
    <p>When concentrated liquidity stops earning fees, the hook parks idle USDT into FloatVault and recalls it before swaps.</p>
  </div>
  <div class="usecase">
    <h3>Flap tax vault yield.</h3>
    <p>Graduated token tax revenue routes through `FlapYieldTaxVaultFactory`, then downstream into the same strategy-selection system.</p>
  </div>
  <div class="usecase">
    <h3>Pre-audited strategy library.</h3>
    <p>Mainnet autonomy can register, retire, and score known strategies without letting the AI deploy fresh Solidity.</p>
  </div>
</div>

<div class="caption">The hook captures temporary inactivity; the vault decides where that capital should work.</div>

---

## Why this wins.

1. AI-selected downstream destination.
2. Multi-strategy parallel testing before capital moves.
3. Trustless promotion through <span class="mono">consecutiveWins</span>.
4. Chain-scoped guardrails: testnet can explore; mainnet selects from audited paths.

---

## Traction is receipts, not claims.

<div class="kpis">
  <div class="kpi"><strong>4,800+</strong><span>scoring epochs posted to chain</span></div>
  <div class="kpi"><strong>2,214</strong><span>epochs analyzed by consolidator</span></div>
  <div class="kpi"><strong>6</strong><span>LLM proposals across 36h</span></div>
  <div class="kpi"><strong>12/12</strong><span>Forge tests passing</span></div>
</div>

<div class="caption"><span class="mono">2</span> autonomous on-chain promotions recorded in README; history wiki currently consolidates <span class="mono">1</span> structured promotion event.</div>

---

![bg cover](/Users/gadgetplug/Documents/vibecoding/agentfloat-hook/web/public/footer.png)
<div class="photo-scrim"></div>

<div class="photo-copy">
<div class="brand">FAQ</div>

## The hard questions are in the design.

<div class="caption">Yield spikes, AI autonomy, shadow testing, and exploit response are handled as explicit system states.</div>
</div>

---

## FAQ.

<div class="faq-grid">
  <div class="faq">
    <span class="q">What if a yield spike disappears before promotion?</span>
    <span class="a">The shadow must beat the active route by `minDeltaBps` for `minEpochsConsecutive`. If the edge decays, `consecutiveWins` resets to `0`.</span>
  </div>
  <div class="faq">
    <span class="q">What are production strategies?</span>
    <span class="a">Separate `IStrategy` contracts: Aave-style lending vaults now; Compound, Morpho, stable LP, or basis routes can be added as audited library entries.</span>
  </div>
  <div class="faq">
    <span class="q">How do shadow strategies test without funds?</span>
    <span class="a">They track virtual balances against the same vault conditions and expose `currentValue()`. Only the active strategy holds real assets.</span>
  </div>
  <div class="faq">
    <span class="q">What happens if a target protocol gets risky?</span>
    <span class="a">The operator can pause or retire the strategy in the brain spec; the promoter refuses paused strategies on the next epoch.</span>
  </div>
</div>

---

## Next: volume, library, fee.

- Expand the pre-audited strategy library beyond Idle and Aave V3 USDT.
- Route real mainnet volume through the hook and Flap tax vaults.
- Monetize with a protocol fee on incremental yield.

<div class="rule"></div>

Judge the system by the artifacts: mainnet hook, autonomous testnet deploy, operating-mode guardrails, and passing tests.

<!--
Compile to PDF:
marp ~/Documents/vibecoding/agentfloat-hook/docs/pitch-deck.md -o pitch-deck.pdf

Compile to PPTX:
marp ~/Documents/vibecoding/agentfloat-hook/docs/pitch-deck.md -o pitch-deck.pptx
-->
