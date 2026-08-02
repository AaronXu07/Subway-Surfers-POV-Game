import { useGameStore } from '../state/gameStore';

/** Mode-select screen shown while phase === 'menu'. */
export function StartScreen() {
  const setControlMode = useGameStore((s) => s.setControlMode);
  const setPhase = useGameStore((s) => s.setPhase);
  const startRun = useGameStore((s) => s.startRun);

  function playKeyboard() {
    setControlMode('keyboard');
    startRun();
  }

  function playCamera() {
    setControlMode('cv');
    setPhase('calibrating');
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 bg-gradient-to-b from-zinc-950 via-[#0a1526] to-[#07111f] p-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-sky-300">
          POV Runner
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-zinc-50">
          Choose your controls
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Dodge trains, jump barriers, grab coins — don&apos;t get caught.
        </p>
      </div>

      <div className="flex w-full max-w-2xl flex-col gap-4 sm:flex-row">
        <ModeCard
          title="Keyboard"
          subtitle="Arrow keys — instant play"
          detail="← → change lane · ↑ jump · ↓ roll"
          accent="emerald"
          onClick={playKeyboard}
        />
        <ModeCard
          title="Camera"
          subtitle="Move your body to steer"
          detail="Webcam + a quick calibration"
          accent="sky"
          onClick={playCamera}
        />
      </div>

      <p className="text-xs text-zinc-500">Esc / P pauses during a run</p>
    </div>
  );
}

function ModeCard({
  title,
  subtitle,
  detail,
  accent,
  onClick,
}: {
  title: string;
  subtitle: string;
  detail: string;
  accent: 'emerald' | 'sky';
  onClick: () => void;
}) {
  const accentClasses =
    accent === 'emerald'
      ? 'hover:border-emerald-400/70 hover:bg-emerald-400/10 focus-visible:border-emerald-400/70'
      : 'hover:border-sky-400/70 hover:bg-sky-400/10 focus-visible:border-sky-400/70';
  const labelClasses = accent === 'emerald' ? 'text-emerald-300' : 'text-sky-300';

  return (
    <button
      className={`flex-1 rounded-2xl border border-white/10 bg-zinc-900/80 p-6 text-left shadow-xl shadow-black/40 outline-none transition-colors duration-150 ${accentClasses}`}
      onClick={onClick}
      type="button"
    >
      <p className={`text-xs font-semibold uppercase tracking-[0.25em] ${labelClasses}`}>
        {subtitle}
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-zinc-50">{title}</h2>
      <p className="mt-3 text-sm text-zinc-400">{detail}</p>
    </button>
  );
}
