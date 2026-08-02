import { useGameStore } from '../state/gameStore';

/**
 * In-game overlay. runStats is written on a ~150ms throttle by the game loop,
 * so subscribing to it here re-renders at ~7Hz, not per frame.
 */
export function Hud() {
  const runStats = useGameStore((s) => s.runStats);
  const controlMode = useGameStore((s) => s.controlMode);
  const stumbleWarning = useGameStore((s) => s.stumbleWarning);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute left-4 top-4 flex flex-col gap-1 rounded-xl border border-white/10 bg-black/50 px-4 py-3 backdrop-blur">
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-400">
          Score
        </span>
        <span className="font-mono text-2xl font-bold tabular-nums text-zinc-50">
          {runStats.score.toLocaleString()}
        </span>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
          <span className="font-mono text-sm tabular-nums text-amber-200">{runStats.coins}</span>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 backdrop-blur">
        <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
          {controlMode === 'keyboard' ? 'Keyboard' : 'Camera'}
        </span>
        <span className="font-mono text-xs tabular-nums text-zinc-300">
          {Math.round(runStats.speed)} m/s
        </span>
      </div>

      {stumbleWarning && (
        <div className="absolute left-1/2 top-16 -translate-x-1/2 animate-pulse rounded-full border border-amber-400/70 bg-amber-400/20 px-5 py-2 backdrop-blur">
          <span className="text-sm font-bold uppercase tracking-[0.25em] text-amber-200">
            Inspector close!
          </span>
        </div>
      )}
    </div>
  );
}
