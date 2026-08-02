import { useEffect, useRef } from 'react';
import { useGameStore } from '../state/gameStore';
import { LANE_NAME, type LaneIndex } from '../game/constants';

/**
 * A tapped ArrowDown stays "ducked" this long in total, so a quick tap still
 * reads as a full roll; holding the key keeps the duck active indefinitely.
 */
const DUCK_TAP_HOLD_MS = 400;

/**
 * Keep the jump level-signal up briefly after keyup: a very fast tap can fit
 * entirely between two animation frames, and the game loop (which samples the
 * gesture once per frame) would never see it.
 */
const JUMP_MIN_HOLD_MS = 80;

/**
 * Keyboard driver for the game. Writes the same absolute-lane GestureResult
 * shape the CV pipeline produces, so everything downstream is input-agnostic.
 * Arrows are relative (one lane per press) — laneRef is the intent layer that
 * converts them to the absolute lane the contract requires.
 */
export function useKeyboardControls(enabled: boolean) {
  const laneRef = useRef<LaneIndex>(1);
  const jumpHeldRef = useRef(false);
  const jumpStartedAtRef = useRef(0);
  const jumpReleaseTimerRef = useRef<number | null>(null);
  const duckActiveRef = useRef(false);
  const duckStartedAtRef = useRef(0);
  const duckReleaseTimerRef = useRef<number | null>(null);
  const runId = useGameStore((s) => s.runId);

  useEffect(() => {
    if (!enabled) return;

    // New run: back to the center lane, neutral posture.
    laneRef.current = 1;
    jumpHeldRef.current = false;
    duckActiveRef.current = false;
    pushGesture();

    function pushGesture() {
      useGameStore.getState().setGesture({
        jump: jumpHeldRef.current,
        duck: duckActiveRef.current,
        hipX: 0.5,
        hipY: 0.5,
        lane: LANE_NAME[laneRef.current],
        ts: Date.now(),
      });
    }

    function clearDuckTimer() {
      if (duckReleaseTimerRef.current !== null) {
        window.clearTimeout(duckReleaseTimerRef.current);
        duckReleaseTimerRef.current = null;
      }
    }

    function clearJumpTimer() {
      if (jumpReleaseTimerRef.current !== null) {
        window.clearTimeout(jumpReleaseTimerRef.current);
        jumpReleaseTimerRef.current = null;
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!event.code.startsWith('Arrow')) return;
      event.preventDefault();
      if (useGameStore.getState().phase !== 'playing') return;

      switch (event.code) {
        case 'ArrowLeft':
          if (event.repeat) return;
          laneRef.current = Math.max(0, laneRef.current - 1) as LaneIndex;
          break;
        case 'ArrowRight':
          if (event.repeat) return;
          laneRef.current = Math.min(2, laneRef.current + 1) as LaneIndex;
          break;
        case 'ArrowUp':
          if (!event.repeat) jumpStartedAtRef.current = performance.now();
          clearJumpTimer();
          jumpHeldRef.current = true;
          break;
        case 'ArrowDown':
          if (!event.repeat) duckStartedAtRef.current = performance.now();
          clearDuckTimer();
          duckActiveRef.current = true;
          break;
      }
      pushGesture();
    }

    function onKeyUp(event: KeyboardEvent) {
      switch (event.code) {
        case 'ArrowUp': {
          const remaining = JUMP_MIN_HOLD_MS - (performance.now() - jumpStartedAtRef.current);
          const release = () => {
            jumpReleaseTimerRef.current = null;
            jumpHeldRef.current = false;
            pushGesture();
          };
          if (remaining <= 0) {
            release();
          } else {
            clearJumpTimer();
            jumpReleaseTimerRef.current = window.setTimeout(release, remaining);
          }
          break;
        }
        case 'ArrowDown': {
          const remaining = DUCK_TAP_HOLD_MS - (performance.now() - duckStartedAtRef.current);
          const release = () => {
            duckReleaseTimerRef.current = null;
            duckActiveRef.current = false;
            pushGesture();
          };
          if (remaining <= 0) {
            release();
          } else {
            clearDuckTimer();
            duckReleaseTimerRef.current = window.setTimeout(release, remaining);
          }
          break;
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      clearDuckTimer();
      clearJumpTimer();
    };
  }, [enabled, runId]);
}

/** Esc / P pause toggle — active in both control modes, so it lives apart from the driver. */
export function usePauseHotkeys() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Escape' && event.code !== 'KeyP') return;
      useGameStore.getState().togglePause();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
