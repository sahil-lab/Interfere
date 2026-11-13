import { useEffect, useRef } from 'react';
import { clamp01, onFrame } from '../motion';
import { SCOPE_HALF_WIDTH } from './formations';
import {
  createFieldRenderer,
  fieldFailure,
  type FieldUniforms,
} from './renderer';
import { getField, impulse, setField, useField } from './store';

// Per formation: tangle, woven loop, scope, fingerprint.
// The scope's near corners are magnified by perspective, so fit it wide.
const HALF_WIDTH = [1.08, 1.04, SCOPE_HALF_WIDTH * 1.26, 0.84] as const;
const HALF_HEIGHT = [1.08, 1.04, 0.62, 1.02] as const;
const TONE = [0.2, 0.45, 0.9, 0.8] as const;
const ALPHA = [0.5, 0.46, 0.34, 0.3] as const;
const LINE_ALPHA = [0.2, 0.2, 0.2, 0.3] as const;
const GLOW = [0.085, 0.06, 0.0, 0.035] as const;
// The look above was tuned at these on-screen sizes (pixels per model unit).
// Additive light piles up when a formation is drawn smaller, so brightness is
// rescaled to keep the same density at any size.
const TUNED_UNIT = [313, 263, 130, 238] as const;
const TUNED_STRETCH = 1.34;
// Sustained slow frames step these down: points, strands, and resolution.
const POINT_SHARE = [1, 0.6, 0.36] as const;
const STRAND_SHARE = [1, 0.75, 0.5] as const;
const DPR_CAP = [1.75, 1.25, 1] as const;
/** Brightness is tuned for this many points and rescaled for other counts. */
const REFERENCE_POINTS = 65536;

const ease = (t: number) => t * t * (3 - 2 * t);
const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/**
 * One fixed canvas behind the page. The field sits on whichever
 * `[data-field-anchor]` box the visitor has reached and re-forms on the way,
 * so it behaves like an object that lives in the page.
 */
export default function Field() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const field = useField();

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    // `?field=full|lite|off` overrides the automatic choice, for review and
    // for anyone who wants the page without the artwork.
    const choice = new URLSearchParams(window.location.search).get('field');
    if (choice === 'off') {
      host.dataset.failure = 'Switched off with ?field=off.';
      setField({ status: 'unavailable', points: 0 });
      return;
    }
    const modest =
      (navigator.hardwareConcurrency || 4) <= 4 ||
      Math.min(window.screen.width, window.screen.height) < 700;
    let lite = false;
    const renderer = createFieldRenderer(canvas, (software) => {
      // CPU-rasterized WebGL gets a smaller, half-resolution field with no
      // full-screen pass: there, every shaded pixel is expensive.
      lite = choice === 'lite' || (software && choice !== 'full');
      if (lite) return { strands: 48, perStrand: 256 };
      return modest && choice !== 'full'
        ? { strands: 56, perStrand: 448 }
        : { strands: 72, perStrand: 896 };
    });
    if (!renderer) {
      host.dataset.failure = fieldFailure;
      setField({ status: 'unavailable', points: 0 });
      return;
    }
    host.dataset.tier = lite ? 'lite' : 'full';
    const adaptive = choice !== 'full';

    const anchors = [0, 1, 2, 3].map((index) =>
      document.querySelector<HTMLElement>(`[data-field-anchor="${index}"]`),
    );
    const centerX = new Float32Array(4);
    const centerY = new Float32Array(4);
    const unitPx = new Float32Array(4);
    const pointGain = new Float32Array(4);
    const lineGain = new Float32Array(4);
    const uniforms: FieldUniforms = {
      time: 0,
      morph: 0,
      noise: 0,
      pulse: 0,
      fault: 0,
      rotX: 0,
      rotY: 0,
      rotZ: 0,
      anchorX: 0,
      anchorY: 0,
      unit: 0,
      aspect: 1,
      pointerX: 0,
      pointerY: 0,
      pointerForce: 0,
      px: 1,
      tone: 0,
      alpha: 0,
      lineAlpha: 0,
      glow: 0,
      stretch: 1,
    };

    let time = 0;
    let morph = 0;
    let primed = false;
    let quality = 0;
    let slow = 0;
    let frames = 0;
    let width = 0;
    let height = 0;
    let ratio = 0;
    let formation = -1;
    let signature = '';
    let sinceDraw = 1;

    const stop = onFrame((frame) => {
      const state = getField();
      const { vw, vh, dt } = frame;
      if (vw < 1 || vh < 1) return;

      const dpr = lite
        ? 0.5
        : Math.min(window.devicePixelRatio || 1, DPR_CAP[quality] ?? 1);
      if (vw !== width || vh !== height || dpr !== ratio) {
        width = vw;
        height = vh;
        ratio = dpr;
        renderer.resize(vw, vh, dpr);
        signature = '';
      }

      // A formation is due once its anchor has risen into view. The change
      // then plays out in time, so stopping mid-scroll never strands the
      // field half-assembled across the page.
      let target = 0;
      for (let index = 0; index < 4; index++) {
        const rect = anchors[index]?.getBoundingClientRect();
        const w = rect?.width || vw;
        const h = rect?.height || vh;
        centerX[index] = rect ? rect.left + w / 2 : vw / 2;
        centerY[index] = rect ? rect.top + h / 2 : vh / 2;
        let fit = Math.min(
          w / 2 / HALF_WIDTH[index]!,
          h / 2 / HALF_HEIGHT[index]!,
        );
        let area = 1;
        if (index === 2) {
          // The scope spans its window's width and is then stretched on
          // screen to fill the height; the window already has margins.
          fit = w / 2 / HALF_WIDTH[2];
          const room = (0.96 * h) / 2 / HALF_HEIGHT[2];
          uniforms.stretch = clamp(room / fit, 1, 3.4);
          fit = Math.min(fit, room / uniforms.stretch);
          area = uniforms.stretch / TUNED_STRETCH;
        }
        unitPx[index] = fit;
        const scale = fit / TUNED_UNIT[index]!;
        pointGain[index] = clamp(scale * scale * area, 0.05, 1.5);
        lineGain[index] = clamp(scale * area * dpr, 0.25, 1.6);
        if (target === index - 1 && centerY[index]! < vh * 0.92) {
          target = index;
        }
      }

      if (!primed || state.reduced) morph = target;
      else morph += (target - morph) * (1 - Math.exp(-dt * 3.4));
      if (Math.abs(target - morph) < 0.002) morph = target;
      primed = true;

      const e0 = ease(clamp01(morph));
      const e1 = ease(clamp01(morph - 1));
      const e2 = ease(clamp01(morph - 2));
      const blend = (a: number, b: number, c: number, d: number) => {
        let value = a + (b - a) * e0;
        value += (c - value) * e1;
        value += (d - value) * e2;
        return value;
      };

      // The field first assembles out of dust as the page is revealed.
      if (state.reduced) impulse.veil = 0;
      else if (impulse.lifting && impulse.veil > 0) {
        impulse.veil = Math.max(0, impulse.veil - dt / 2);
      }
      const appear = ease(1 - impulse.veil);

      if (!state.paused) time += dt;
      const live = state.paused ? 0 : frame.pointer;
      // The scope sits in a window; it leans toward the pointer far less.
      const lean = live * blend(1, 1, 0.3, 1);
      const pointerX = (frame.pointerX / vw) * 2 - 1;
      const pointerY = 1 - (frame.pointerY / vh) * 2;
      const points = Math.floor(renderer.total * (POINT_SHARE[quality] ?? 1));
      // The small CPU-rasterized field keeps every strand: they are its shape.
      const strands = lite
        ? renderer.strands
        : Math.ceil(renderer.strands * (STRAND_SHARE[quality] ?? 1));
      // Cards and headings pass over the loop on small screens.
      const quiet = vw < 760 ? 0.7 : 1;
      // Scrolling fast shakes a little dust loose.
      const shake = state.reduced
        ? 0
        : Math.min(0.2, Math.abs(frame.velocity) / 10000);

      const x = blend(centerX[0]!, centerX[1]!, centerX[2]!, centerX[3]!);
      const y = blend(centerY[0]!, centerY[1]!, centerY[2]!, centerY[3]!);
      const unit = blend(unitPx[0]!, unitPx[1]!, unitPx[2]!, unitPx[3]!);

      uniforms.time = time;
      uniforms.morph = morph;
      uniforms.noise = Math.min(1, state.noise + shake + (1 - appear) * 0.6);
      uniforms.pulse = impulse.pulse;
      uniforms.fault = impulse.fault;
      uniforms.rotX =
        blend(
          0.35 + Math.sin(time * 0.13) * 0.25,
          0.82,
          0.9,
          Math.sin(time * 0.23) * 0.07,
        ) -
        pointerY * 0.1 * lean;
      uniforms.rotY =
        blend(
          time * 0.09,
          -0.36 + Math.sin(time * 0.17) * 0.14,
          Math.sin(time * 0.11) * 0.06,
          Math.sin(time * 0.19) * 0.32,
        ) +
        pointerX * 0.16 * lean;
      uniforms.rotZ = blend(0.1, -0.4 + time * 0.045, 0, 0);
      uniforms.anchorX = (x / vw) * 2 - 1;
      uniforms.anchorY = 1 - (y / vh) * 2;
      uniforms.unit = ((unit * 2) / vh) * (0.86 + 0.14 * appear);
      uniforms.aspect = vw / vh;
      uniforms.pointerX = pointerX;
      uniforms.pointerY = pointerY;
      uniforms.pointerForce = live;
      uniforms.px = dpr * Math.min(1.5, Math.max(0.85, vh / 900));
      uniforms.tone = blend(TONE[0], TONE[1], TONE[2], TONE[3]);
      uniforms.alpha =
        blend(
          ALPHA[0] * pointGain[0]!,
          ALPHA[1] * pointGain[1]! * quiet,
          ALPHA[2] * pointGain[2]!,
          ALPHA[3] * pointGain[3]!,
        ) *
        Math.sqrt(REFERENCE_POINTS / Math.max(1, points)) *
        appear;
      uniforms.lineAlpha =
        blend(
          LINE_ALPHA[0] * lineGain[0]!,
          LINE_ALPHA[1] * lineGain[1]! * quiet,
          LINE_ALPHA[2] * lineGain[2]!,
          LINE_ALPHA[3] * lineGain[3]!,
        ) *
        Math.min(1.6, Math.sqrt(72 / Math.max(1, strands))) *
        appear;
      uniforms.glow =
        blend(GLOW[0], GLOW[1] * quiet, GLOW[2], GLOW[3]) * appear;

      if (impulse.pulse > 0) {
        impulse.pulse = Math.max(0, impulse.pulse - dt / 1.7);
      }
      if (impulse.fault > 0) {
        impulse.fault = Math.max(0, impulse.fault - dt / 1.1);
      }

      const settled = Math.round(morph);
      if (settled !== formation) {
        formation = settled;
        host.dataset.formation = String(settled);
      }

      // While motion is stopped, redraw only when something actually changed.
      sinceDraw += dt;
      if (state.paused) {
        const next = [
          morph.toFixed(4),
          uniforms.anchorX.toFixed(4),
          uniforms.anchorY.toFixed(4),
          uniforms.unit.toFixed(4),
          uniforms.noise.toFixed(3),
          appear.toFixed(3),
          points,
          canvas.width,
          canvas.height,
        ].join('|');
        if (next === signature) return;
        signature = next;
      } else {
        signature = '';
        // A CPU-rasterized field is also capped near 20 frames a second.
        if (lite && sinceDraw < 0.045) return;
      }
      sinceDraw = 0;

      if (!renderer.draw(uniforms, points, strands, !lite)) {
        // The context was lost: show the still fallback until it returns.
        if (getField().status !== 'unavailable') {
          host.dataset.failure = 'The WebGL context was lost.';
          setField({ status: 'unavailable', points: 0 });
        }
        signature = '';
        return;
      }
      frames += 1;
      host.dataset.frames = String(frames);

      if (getField().status !== 'running' || getField().points !== points) {
        setField({ status: 'running', points });
      }

      // About a second of slow frames steps the detail down; it never steps
      // back up, so quality cannot oscillate.
      if (adaptive && !state.paused && quality < POINT_SHARE.length - 1) {
        slow = dt > 0.036 ? slow + dt : Math.max(0, slow - dt * 2);
        if (slow > 1.2) {
          quality += 1;
          slow = 0;
        }
      }
    });

    return () => {
      stop();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      className="field"
      ref={hostRef}
      aria-hidden="true"
      data-testid="field"
      data-renderer={field.status}
      data-motion={field.paused ? 'paused' : 'running'}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
