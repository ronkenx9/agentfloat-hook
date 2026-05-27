import { fetchState } from "@/lib/api";
import { loadRealState } from "@/lib/brain";
import { getDemoState } from "@/lib/demo";
import { Masthead } from "@/components/Masthead";
import { Receipt } from "@/components/Receipt";
import { ModeDial } from "@/components/ModeDial";
import { ProposalCard } from "@/components/ProposalCard";
import { ProofTier } from "@/components/ProofTier";
import { EditorialImage } from "@/components/EditorialImage";
import { LiveTicker } from "@/components/LiveTicker";
import { StrategyRace } from "@/components/StrategyRace";
import { EventTicker } from "@/components/EventTicker";
import { HookDiagram } from "@/components/HookDiagram";
import { HeroMetrics } from "@/components/HeroMetrics";
import { StrategyDeck } from "@/components/StrategyDeck";

// Re-render every 30 seconds so live proposals/scores show up without manual refresh.
export const revalidate = 30;

interface SearchParams {
  demo?: string;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const useDemo = params.demo === "1";

  let state;
  if (useDemo) {
    state = getDemoState();
  } else {
    state = (await fetchState()) ?? loadRealState();
  }
  const hasProposals = state.proposals.length > 0;

  return (
    <main className="min-h-screen flex flex-col">
      <Masthead isDemo={state.isDemo} agentAlive={state.health.agentAlive} />

      {/* Live data band — sits right under masthead */}
      <LiveTicker initialState={state} />

      {/* ─────────── PLATE 01 — Hero ─────────── */}
      <EditorialImage
        src="/hero.png"
        alt="A figure reading a folder — the system at work"
        heightRatio={0.85}
        position="right"
        overlayPosition="left"
        overlayTone="ink"
        overlay={
          <div>
            <span className="mono text-[10px] uppercase tracking-[0.12em] text-ink-soft">
              № 01 · The product
            </span>
            <h1 className="serif text-[48px] md:text-[72px] leading-[1.03] tracking-tight mt-4 max-w-[14ch]">
              Yield routing that <em className="italic">learns and ships</em> its own upgrades.
            </h1>
            <p className="text-lg text-ink-soft mt-5 max-w-[42ch] leading-relaxed">
              Out-of-range LP capital flows into a vault that runs multiple strategies in parallel.
              An LLM proposes new ones every hour. Only proven winners ship — and you choose how
              involved you want to be.
            </p>
          </div>
        }
      />

      {/* ─────────── Hero metrics row ─────────── */}
      <HeroMetrics />

      {/* ─────────── Hook in Action diagram ─────────── */}
      <HookDiagram />

      {/* ─────────── Strategy deck (Pokemon cards) ─────────── */}
      <StrategyDeck />

      {/* ─────────── Strategy race (live bars) ─────────── */}
      <StrategyRace />

      {/* ─────────── Receipt + Mode dial ─────────── */}
      <section className="max-w-[1180px] mx-auto px-6 pt-2 pb-14 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-rule border border-rule">
          <div className="bg-paper">
            <Receipt receipt={state.receipt} />
          </div>
          <div className="bg-paper">
            <ModeDial mode={state.mode} isDemo={state.isDemo} />
          </div>
        </div>
      </section>

      {/* ─────────── PLATE 02 — The Notebook ─────────── */}
      <EditorialImage
        src="/middle.png"
        alt="Multiple coloured trails diverging — parallel strategies"
        heightRatio={0.55}
        position="center"
        overlayPosition="bottom-left"
        overlayTone="paper"
        overlay={
          <div>
            <span className="mono text-[10px] uppercase tracking-[0.12em] opacity-70">
              № 02 · The AI's notebook
            </span>
            <h2
              className="serif text-3xl md:text-5xl mt-3 tracking-tight leading-[1.05] max-w-[20ch]"
              style={{
                color: "var(--gold)",
                fontWeight: 600,
                textShadow: "var(--overlay-shadow)",
              }}
            >
              What the orchestrator wrote, in its own words.
            </h2>
            <p
              className="text-sm mt-3 max-w-[44ch]"
              style={{
                color: "var(--gold)",
                fontWeight: 500,
                textShadow: "var(--overlay-shadow)",
              }}
            >
              One strategy active. Others tested in shadow. Whichever proves itself becomes the
              next active. {state.proposals.length}{" "}
              {state.proposals.length === 1 ? "entry" : "entries"} so far.
            </p>
          </div>
        }
      />

      {/* ─────────── Proposals feed ─────────── */}
      <section className="bg-paper-2/30">
        <div className="max-w-[1180px] mx-auto px-6 py-14 w-full">
          {!hasProposals ? (
            <div className="text-center py-16 text-ink-soft">
              <p className="serif text-2xl mb-3">No proposals yet.</p>
              <p className="text-sm max-w-[40ch] mx-auto">
                The orchestrator runs every ~hour. Once it generates its first proposal, it will
                appear here with the AI's reasoning and any deploy outcomes.
              </p>
              <p className="text-xs mt-4">
                <a href="/?demo=1" className="mono uppercase underline decoration-rule hover:text-accent">
                  View demo →
                </a>
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {state.proposals.map((p) => (
                <ProposalCard key={p.id} proposal={p} explorerBase={state.contracts.explorerBase} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Live on-chain event ticker — scrolling */}
      <EventTicker />

      {/* ─────────── PLATE 03 — The Proof ─────────── */}
      <EditorialImage
        src="/footer.png"
        alt="A close — confidence at rest"
        heightRatio={0.55}
        position="center"
        overlayPosition="bottom-left"
        overlayTone="paper"
        overlay={
          <div>
            <span className="mono text-[10px] uppercase tracking-[0.12em] opacity-70">
              № 03 · The proof
            </span>
            <h2 className="serif text-3xl md:text-5xl mt-3 tracking-tight leading-[1.05] max-w-[18ch]">
              On-chain, in the open.
            </h2>
            <p className="text-sm mt-3 opacity-80 max-w-[44ch]">
              Six verified contracts on X Layer Testnet. Eight tests passing. One AI-generated
              strategy already shipped autonomously.
            </p>
          </div>
        }
      />

      {/* ─────────── Proof Tier ─────────── */}
      <ProofTier state={state} />

      {/* ─────────── Final colophon ─────────── */}
      <footer className="bg-ink text-paper py-10">
        <div
          className="max-w-[1180px] mx-auto px-6 flex flex-col md:flex-row items-baseline justify-between gap-4 text-[10px] mono uppercase tracking-[0.12em]"
          style={{ color: "var(--rule)" }}
        >
          <span>AgentFloat · Yield routing that learns</span>
          <span style={{ color: "var(--ink-faint)" }}>
            Set in Source Serif 4 + JetBrains Mono · Vol. I MMXXVI
          </span>
        </div>
      </footer>
    </main>
  );
}
