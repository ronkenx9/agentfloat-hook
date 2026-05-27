# AgentFloat — 90-Second Demo Script

**Target length:** 75–90 seconds
**Aspect ratio:** 16:9, 1920×1080 (X auto-crops to 16:9 for landscape video)
**Audio:** voiceover only, no music, light background room tone OK
**Tone:** measured, calm, fact-led. Not hype.
**Voice direction:** read the lines exactly as written — don't ad-lib. Each line is a beat.

---

## Shot 1 (0:00–0:08) — The problem

**On screen:** Uniswap v4 pool interface (screenshot or screen recording). Cursor hovers over a concentrated liquidity position. Highlight the words "out of range" in red.

**Voiceover:**
> "Concentrated liquidity is the v4 thesis. But when price moves out of your range, your capital sits idle."

---

## Shot 2 (0:08–0:18) — The hook fires

**On screen:** Architecture diagram of AgentFloat appears. Animate the arrow from "Uniswap v4 Pool" → "AgentFloatHook" → "FloatVault." Use the diagram from the README ASCII or build a clean SVG.

**Voiceover:**
> "AgentFloat is a v4 hook. When your position goes out of range, it routes the idle USDC into a vault that earns yield. When price moves back, the hook recalls the capital in time for the swap."

---

## Shot 3 (0:18–0:35) — Multiple strategies in parallel

**On screen:** Cut to the dashboard. Show the **Strategy Race** section with the bars filling. Active strategy in gold, shadows below.

**Voiceover:**
> "The vault doesn't just run one yield strategy. It runs several in parallel. One earns real money. The others are shadows — same conditions, simulated outcomes. Every epoch, an on-chain counter tracks which shadow is beating the active strategy."

---

## Shot 4 (0:35–0:55) — The AI proposes

**On screen:** Open the proposals feed. Click into a recent proposal. Show the reasoning text from Groq's response. Then cut to terminal: `npm run orchestrate` running, showing the call to llama-3.3.

**Voiceover:**
> "Once an hour, an LLM reads the system's own performance and proposes a new strategy variant. Groq's llama three point three, reading our second brain — strategy specs, scoring rules, recent history — and writing a structured proposal as markdown."

---

## Shot 5 (0:55–1:15) — Autonomous deployment (the killer beat)

**On screen:** Split screen. Left: the proposal markdown file at `~/brain/skills/agentfloat-strategies/proposals/2026-05-26-999-parameter_variant.md`. Right: OKLink showing the deployment transaction at `0x4245ab63…` and the resulting contract at `0xb74204…`.

**Voiceover:**
> "Approved proposals flow through guardrails — operating mode, audit requirements, daily caps — then into the deploy loop. This contract on X Layer Testnet was deployed yesterday by the AI. No human in the loop. The proposal became a registered shadow strategy in two transactions."

---

## Shot 6 (1:15–1:30) — Close

**On screen:** AgentFloat brand mark on cream background. Underneath, three lines:
- "Yield routing that learns and ships its own upgrades."
- "github.com/ronkenx9/agentfloat-hook"
- "Hook the Future · @XLayerOfficial · @Uniswap · @flapdotsh"

**Voiceover:**
> "AgentFloat. Yield routing that learns and ships its own upgrades. Built for Hook the Future on X Layer."

---

## Recording checklist

- [ ] Open dashboard at `http://localhost:3000` BEFORE recording — verify agent is alive and proposals are present
- [ ] Open OKLink in a second tab pointed at the deployment tx so cuts are instant
- [ ] Have the proposal markdown file open in a third tab (VSCode or just preview)
- [ ] QuickTime Screen Recording → Window selection → 1920×1080 if available
- [ ] Record voiceover separately in QuickTime/Audacity → import to iMovie
- [ ] Trim to 75–90 seconds — if longer, cut shot 1 or 6 first
- [ ] Export H.264 mp4 1080p, upload as unlisted YouTube → grab share link → put in `docs/submission.md` and the Google form

## Backup (no voiceover)

Same six shots, but with on-screen captions matching the voiceover lines. Slower-paced (2s per caption). Still under 90s. Less dynamic but ships without needing to record audio.
