import { useEffect, useRef } from 'react';

export interface Frame {
  /** Seconds since the previous frame, clamped so motion stays stable. */
  dt: number;
  scrollY: number;
  /** Eased scroll position for scroll-linked motion. */
  smoothY: number;
  /** Eased scroll velocity in px/s. */
  velocity: number;
  vw: number;
  vh: number;
  pointerX: number;
  pointerY: number;
  /** 0..1 eased presence of a mouse or pen pointer inside the window. */
  pointer: number;
}

type Listener = (frame: Frame) => void;

const listeners = new Set<Listener>();
const frame: Frame = {
  dt: 1 / 60,
  scrollY: 0,
  smoothY: 0,
  velocity: 0,
  vw: 0,
  vh: 0,
  pointerX: 0,
  pointerY: 0,
  pointer: 0,
};

let scheduled = 0;
let last = 0;
let continuous = false;
let pointerTarget = 0;
let started = false;

// Wheel input is eased here rather than by the browser, so the page and the
// canvas that follows it move in the same frame.
let glide = false;
let gliding = false;
let glideTarget = 0;
let glidePosition = 0;

function measure() {
  frame.vw = document.documentElement.clientWidth;
  frame.vh = window.innerHeight;
}

function scrollLimit() {
  return Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );
}

/** True when an inner scroll area under the pointer can still take the wheel. */
function innerScroller(target: EventTarget | null, deltaY: number) {
  let node = target instanceof Element ? target : null;
  while (node && node !== document.body && node !== document.documentElement) {
    if (node.scrollHeight > node.clientHeight + 1) {
      const overflow = getComputedStyle(node).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') {
        const atStart = node.scrollTop <= 0;
        const atEnd =
          node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
        if (deltaY < 0 ? !atStart : !atEnd) return true;
      }
    }
    node = node.parentElement;
  }
  return false;
}

function onWheel(event: WheelEvent) {
  // Leave zoom gestures, sideways scrolling, and inner scroll areas alone.
  if (!glide || event.ctrlKey || event.defaultPrevented) return;
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  if (innerScroller(event.target, event.deltaY)) return;
  event.preventDefault();
  const unit =
    event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? window.innerHeight : 1;
  if (!gliding) glidePosition = glideTarget = window.scrollY;
  glideTarget = Math.min(
    scrollLimit(),
    Math.max(0, glideTarget + event.deltaY * unit),
  );
  gliding = true;
  requestFrame();
}

/**
 * A key or pointer press means the visitor is moving the page some other
 * way: a scroll key, a link, the scrollbar. The glide stops there, because
 * its next step would cancel a scroll the browser has only just begun.
 */
function endGlide() {
  gliding = false;
}

function tick(now: number) {
  scheduled = 0;
  // Easing below is exponential, so a long frame on a slow device is safe.
  const dt = last
    ? Math.min(Math.max((now - last) / 1000, 0.001), 0.25)
    : 1 / 60;
  last = now;

  if (gliding) {
    if (Math.abs(window.scrollY - glidePosition) > 2) {
      // The keyboard, the scrollbar, or a link moved the page: let it.
      gliding = false;
    } else {
      glidePosition += (glideTarget - glidePosition) * (1 - Math.exp(-dt * 10));
      if (Math.abs(glideTarget - glidePosition) < 0.4) {
        glidePosition = glideTarget;
        gliding = false;
      }
      window.scrollTo({ top: glidePosition, behavior: 'instant' });
    }
  }

  const y = window.scrollY;
  frame.dt = dt;
  if (continuous) {
    const raw = (y - frame.scrollY) / dt;
    frame.velocity += (raw - frame.velocity) * (1 - Math.exp(-dt * 8));
    frame.smoothY += (y - frame.smoothY) * (1 - Math.exp(-dt * 10));
    frame.pointer += (pointerTarget - frame.pointer) * (1 - Math.exp(-dt * 6));
  } else {
    frame.velocity = 0;
    frame.smoothY = y;
    frame.pointer = 0;
  }
  frame.scrollY = y;
  for (const listener of listeners) listener(frame);
  // Continuous mode eases values every frame; otherwise frames are on demand.
  // A listener may already have requested the next frame.
  if ((continuous || gliding) && !document.hidden && !scheduled) {
    scheduled = requestAnimationFrame(tick);
  }
  if (!scheduled) last = 0;
}

export function requestFrame() {
  start();
  if (!scheduled) scheduled = requestAnimationFrame(tick);
}

function start() {
  if (started) return;
  started = true;
  measure();
  frame.scrollY = frame.smoothY = window.scrollY;
  window.addEventListener('scroll', requestFrame, { passive: true });
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', endGlide, { capture: true });
  window.addEventListener('pointerdown', endGlide, { capture: true });
  window.addEventListener('resize', () => {
    measure();
    requestFrame();
  });
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch') return;
      frame.pointerX = event.clientX;
      frame.pointerY = event.clientY;
      pointerTarget = 1;
      requestFrame();
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    pointerTarget = 0;
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) requestFrame();
  });
  // Reflow without a scroll or resize (fonts, disclosures) still moves things.
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      measure();
      requestFrame();
    }).observe(document.body);
  }
}

export function setContinuous(value: boolean) {
  continuous = value;
  requestFrame();
}

/** Eased wheel scrolling; off, the browser scrolls natively. */
export function setGlide(value: boolean) {
  glide = value;
  if (!value) gliding = false;
}

export function onFrame(listener: Listener) {
  listeners.add(listener);
  requestFrame();
  return () => {
    listeners.delete(listener);
  };
}

/** Runs a callback on every shared animation frame without re-subscribing. */
export function useFrame(callback: Listener) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  });
  useEffect(() => onFrame((current) => saved.current(current)), []);
}

export const clamp01 = (value: number) =>
  value < 0 ? 0 : value > 1 ? 1 : value;
