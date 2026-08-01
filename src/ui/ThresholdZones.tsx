import { useGameStore } from '../state/gameStore';
import { GESTURE_THRESHOLDS, toScreenX } from '../gestures/gestureThresholds';

const pct = (value: number) => `${value * 100}%`;

/** Keep a guide line readable even when its threshold sits on (or past) the frame edge. */
const clampToFrame = (y: number) => Math.min(Math.max(y, 0.02), 0.98);

/**
 * Guides showing where the lane / jump / duck thresholds actually sit in the camera
 * frame. Lines stay thin and low-contrast so they never fight the feed, but only the
 * zone the player is currently in lights up — that's the part meant to be readable.
 */
export function ThresholdZones() {
  const lane = useGameStore(state => state.gesture.lane);
  const jump = useGameStore(state => state.gesture.jump);
  const duck = useGameStore(state => state.gesture.duck);

  // Mirrored: the player's left is the left edge of the mirrored image.
  const leftEdge = toScreenX(GESTURE_THRESHOLDS.laneLeftX);
  const rightEdge = toScreenX(GESTURE_THRESHOLDS.laneRightX);
  const jumpY = clampToFrame(GESTURE_THRESHOLDS.jumpY);
  const duckY = clampToFrame(GESTURE_THRESHOLDS.duckY);

  const lanes = [
    { key: 'left' as const, from: 0, to: leftEdge },
    { key: 'center' as const, from: leftEdge, to: rightEdge },
    { key: 'right' as const, from: rightEdge, to: 1 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0">
      {lanes.map(zone => {
        const isActive = lane === zone.key;
        return (
          <div
            className="absolute inset-y-0"
            key={zone.key}
            style={{ left: pct(zone.from), width: pct(zone.to - zone.from) }}
          >
            <div
              className={`absolute inset-0 transition-colors duration-200 ${
                isActive ? 'bg-white/[0.08]' : 'bg-transparent'
              }`}
            />
            {/* Sits clear of the bottom edge so it never stacks with the duck label. */}
            <span
              className={`absolute bottom-11 left-1/2 -translate-x-1/2 rounded-md px-2 py-0.5 text-sm font-semibold uppercase tracking-[0.25em] backdrop-blur-[2px] transition-colors duration-200 ${
                isActive ? 'bg-white/20 text-white' : 'bg-black/40 text-white/70'
              }`}
            >
              {zone.key}
            </span>
          </div>
        );
      })}

      {[leftEdge, rightEdge].map(x => (
        <div
          className="absolute inset-y-0 w-0.5 bg-white/25"
          key={x}
          style={{ left: pct(x) }}
        />
      ))}

      <ZoneLine active={jump} label="Jump" side="above" y={jumpY} />
      <ZoneLine active={duck} label="Duck" side="below" y={duckY} />
    </div>
  );
}

interface ZoneLineProps {
  active: boolean;
  label: string;
  /** Which side of the line counts as inside the zone. */
  side: 'above' | 'below';
  y: number;
}

function ZoneLine({ active, label, side, y }: ZoneLineProps) {
  // The label wants to sit inside its own zone, but a threshold near the frame edge
  // leaves no room there (duck sits on the bottom edge), so it flips to the other side
  // of the line rather than being clipped away.
  const hasRoomInZone = side === 'above' ? y > 0.1 : y < 0.9;
  const labelBelowLine = side === 'above' ? !hasRoomInZone : hasRoomInZone;

  return (
    <>
      <div
        className={`absolute inset-x-0 transition-colors duration-200 ${
          active ? 'bg-sky-300/10' : 'bg-transparent'
        }`}
        style={
          side === 'above'
            ? { top: 0, height: pct(y) }
            : { top: pct(y), bottom: 0 }
        }
      />
      <div
        className={`absolute inset-x-0 border-t-2 border-dashed transition-colors duration-200 ${
          active ? 'border-sky-200/70' : 'border-white/30'
        }`}
        style={{ top: pct(y) }}
      >
        <span
          className={`absolute left-4 rounded-md px-2 py-0.5 text-sm font-semibold uppercase tracking-[0.25em] backdrop-blur-[2px] transition-colors duration-200 ${
            active ? 'bg-sky-300/20 text-sky-50' : 'bg-black/40 text-white/70'
          } ${labelBelowLine ? 'top-full mt-1.5' : 'bottom-full mb-1.5'}`}
        >
          {label}
        </span>
      </div>
    </>
  );
}
