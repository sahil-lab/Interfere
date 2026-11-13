import { useSyncExternalStore } from 'react';
import { requestFrame, setContinuous, setGlide } from '../motion';

export interface FieldState {
  /** Autoplaying motion is stopped: by the visitor, or by their OS preference. */
  paused: boolean;
  /** prefers-reduced-motion: static layouts and no scroll-linked effects. */
  reduced: boolean;
  /** 0..1 extra turbulence chosen with the hero slider. */
  noise: number;
  status: 'starting' | 'running' | 'unavailable';
  /** Points currently drawn each frame. */
  points: number;
}

const preference =
  typeof window === 'undefined'
    ? null
    : window.matchMedia('(prefers-reduced-motion: reduce)');

let state: FieldState = {
  paused: preference?.matches ?? false,
  reduced: preference?.matches ?? false,
  noise: 0.12,
  status: 'starting',
  points: 0,
};

const subscribers = new Set<() => void>();

function applyMotion() {
  // A reduced-motion visitor only gets a running loop if they ask for motion,
  // and always keeps the browser's own scrolling.
  setContinuous(!(state.reduced && state.paused));
  setGlide(!state.reduced);
}

export function getField() {
  return state;
}

export function setField(patch: Partial<FieldState>) {
  state = { ...state, ...patch };
  applyMotion();
  for (const notify of subscribers) notify();
  requestFrame();
}

function subscribe(notify: () => void) {
  subscribers.add(notify);
  return () => {
    subscribers.delete(notify);
  };
}

export function useField() {
  return useSyncExternalStore(subscribe, getField);
}

if (preference) {
  applyMotion();
  preference.addEventListener('change', () => {
    setField({ reduced: preference.matches, paused: preference.matches });
  });
}

/**
 * One-shot values the renderer decays. `pulse` and `fault` are set only by
 * the result of a check the visitor ran; `veil` hides the field until the
 * page is revealed.
 */
export const impulse = { pulse: 0, fault: 0, veil: 1, lifting: false };

/** Lets the field assemble out of dust once the page is on screen. */
export function revealField() {
  impulse.lifting = true;
  requestFrame();
}

export function emitPulse() {
  if (state.paused) return;
  impulse.pulse = 1;
  requestFrame();
}

export function emitFault() {
  if (state.paused) return;
  impulse.fault = 1;
  requestFrame();
}
