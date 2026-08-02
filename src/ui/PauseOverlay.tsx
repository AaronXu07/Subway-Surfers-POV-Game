import { useGameStore } from '../state/gameStore';

/** Shown while phase === 'paused'; the world is frozen behind it. */
export function PauseOverlay() {
  const togglePause = useGameStore((s) => s.togglePause);
  const startRun = useGameStore((s) => s.startRun);
  const setPhase = useGameStore((s) => s.setPhase);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/60 backdrop-blur-sm">
      <h2 className="text-3xl font-bold tracking-tight text-zinc-50">Paused</h2>
      <div className="flex flex-col items-stretch gap-3">
        <OverlayButton label="Resume" onClick={togglePause} primary />
        <OverlayButton label="Restart" onClick={startRun} />
        <OverlayButton label="Quit to menu" onClick={() => setPhase('menu')} />
      </div>
      <p className="text-xs text-zinc-400">Esc / P to resume</p>
    </div>
  );
}

export function OverlayButton({
  label,
  onClick,
  primary = false,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      className={`min-w-52 rounded-xl border px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] outline-none transition-colors duration-150 ${
        primary
          ? 'border-emerald-400/70 bg-emerald-400/20 text-emerald-100 hover:bg-emerald-400/30'
          : 'border-white/15 bg-zinc-900/80 text-zinc-200 hover:border-white/30 hover:bg-zinc-800'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
