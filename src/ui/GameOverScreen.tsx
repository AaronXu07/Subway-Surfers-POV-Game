import { useGameStore } from '../state/gameStore';
import { OverlayButton } from './PauseOverlay';

const REASON_COPY = {
  hard: 'You crashed!',
  caught: 'The inspector caught you!',
} as const;

/** End-of-run screen; the frozen world stays visible behind it. */
export function GameOverScreen() {
  const runStats = useGameStore((s) => s.runStats);
  const reason = useGameStore((s) => s.gameOverReason);
  const controlMode = useGameStore((s) => s.controlMode);
  const startRun = useGameStore((s) => s.startRun);
  const setPhase = useGameStore((s) => s.setPhase);
  const clearCalibration = useGameStore((s) => s.clearCalibration);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/70 backdrop-blur-sm">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-rose-300">
          Game over
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-50">
          {reason ? REASON_COPY[reason] : 'Run ended'}
        </h2>
      </div>

      <div className="flex items-center gap-6 rounded-2xl border border-white/10 bg-zinc-900/80 px-8 py-5">
        <Stat label="Score" value={runStats.score.toLocaleString()} />
        <Stat label="Coins" value={String(runStats.coins)} />
        <Stat label="Distance" value={`${Math.floor(runStats.distance)}m`} />
      </div>

      <div className="flex flex-col items-stretch gap-3">
        <OverlayButton label="Run again" onClick={startRun} primary />
        <OverlayButton label="Change controls" onClick={() => setPhase('menu')} />
        {controlMode === 'cv' && (
          <OverlayButton label="Recalibrate" onClick={clearCalibration} />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
        {label}
      </span>
      <span className="font-mono text-xl font-bold tabular-nums text-zinc-100">{value}</span>
    </div>
  );
}
