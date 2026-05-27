import Image from "next/image";

export function Masthead({ isDemo, agentAlive }: { isDemo: boolean; agentAlive: boolean }) {
  return (
    <header style={{ backgroundColor: "var(--paper-cover)" }}>
      <div className="max-w-[1180px] mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="AgentFloat"
            width={36}
            height={36}
            priority
            className="select-none"
          />
          <div className="flex flex-col leading-none">
            <span className="serif text-xl tracking-tight leading-none">AgentFloat</span>
            <span className="mono text-[9px] uppercase text-ink-soft mt-1 tracking-[0.12em]">
              Vol. I · MMXXVI
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-wider">
          {isDemo ? (
            <span className="mono px-2 py-1 bg-accent text-paper">Demo mode</span>
          ) : (
            <span className="mono text-ink-soft">Live</span>
          )}
          <span className="mono flex items-center gap-1.5 text-ink-soft">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${
                agentAlive ? "live-dot" : ""
              }`}
              style={{ backgroundColor: agentAlive ? "var(--signal-green)" : "var(--ink-faint)" }}
            />
            {agentAlive ? "Agent active" : "Agent offline"}
          </span>
        </div>
      </div>
    </header>
  );
}
