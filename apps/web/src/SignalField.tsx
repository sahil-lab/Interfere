import { useEffect, useRef, useState } from 'react';

const TAU = Math.PI * 2;
const STRANDS = 64;
const SEGMENTS = 160;

function createSculpture(context: CanvasRenderingContext2D) {
  const strands = Array.from({ length: STRANDS }, (_, index) => ({
    index,
    depth: 0,
    points: Array.from({ length: SEGMENTS + 1 }, () => ({ x: 0, y: 0 })),
  }));

  return (
    width: number,
    height: number,
    time: number,
    interference: number,
    pointer: { x: number; y: number },
  ) => {
    const size = Math.min(width, height);
    const scale = size / 540;
    const tiltX = 0.76 + pointer.y * 0.16;
    const tiltY = -0.38 + pointer.x * 0.2;
    const rotation = -0.45 + Math.sin(time * 0.16) * 0.1;
    const sinX = Math.sin(tiltX);
    const cosX = Math.cos(tiltX);
    const sinY = Math.sin(tiltY);
    const cosY = Math.cos(tiltY);
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);

    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(width / 2, height * 0.49);
    context.scale(scale, scale);

    for (const strand of strands) {
      const phi = (strand.index / STRANDS) * TAU;
      strand.depth = 0;
      for (const [segment, point] of strand.points.entries()) {
        const theta = (segment / SEGMENTS) * TAU;
        const wave = interference * Math.sin(theta * 3 + time * 0.55);
        const radius = 151 + wave * 28;
        const tube = 64 + Math.sin(theta * 2 - time * 0.22) * 9;
        const cross = phi + theta * 2;
        const x = (radius + tube * Math.cos(cross)) * Math.cos(theta);
        const y = (radius + tube * Math.cos(cross)) * Math.sin(theta);
        const z = tube * Math.sin(cross) + wave * 48;
        const tiltedY = y * cosX - z * sinX;
        const tiltedZ = y * sinX + z * cosX;
        const tiltedX = x * cosY + tiltedZ * sinY;
        const depth = -x * sinY + tiltedZ * cosY;
        const perspective = 730 / (730 + depth);

        point.x = (tiltedX * cosR - tiltedY * sinR) * perspective;
        point.y = (tiltedX * sinR + tiltedY * cosR) * perspective;
        strand.depth += depth;
      }
      strand.depth /= SEGMENTS + 1;
    }

    strands.sort((a, b) => b.depth - a.depth);
    for (const strand of strands) {
      const front = Math.max(0, Math.min(1, (55 - strand.depth) / 110));
      context.beginPath();
      for (const [segment, point] of strand.points.entries()) {
        if (segment === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      }
      context.strokeStyle = `rgba(${180 + front * 48}, ${49 + front * 20}, 24, ${0.22 + front * 0.65})`;
      context.lineWidth = 0.7 + front * 0.4;
      context.stroke();
    }
    context.restore();
  };
}

export default function SignalField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const interferenceRef = useRef(0.38);
  const phase = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const redraw = useRef<(() => void) | null>(null);
  const [interference, setInterference] = useState(38);
  const [paused, setPaused] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setPaused(preference.matches);
    preference.addEventListener('change', onChange);
    return () => preference.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const field = fieldRef.current;
    if (!canvas || !field) return;
    const context = canvas.getContext('2d');
    if (!context) {
      setAvailable(false);
      return;
    }
    const render = createSculpture(context);
    let frame = 0;
    let width = 0;
    let height = 0;
    let lastTime = 0;
    let visible = true;
    const draw = () =>
      render(
        width,
        height,
        phase.current,
        interferenceRef.current,
        pointer.current,
      );

    // Cap drawing at 20fps; do not spend frames on a hidden or offscreen canvas.
    const animate = (now: number) => {
      if (now - lastTime >= 50) {
        phase.current += lastTime ? Math.min((now - lastTime) / 1000, 0.1) : 0;
        lastTime = now;
        draw();
      }
      frame = requestAnimationFrame(animate);
    };
    const syncMotion = () => {
      cancelAnimationFrame(frame);
      lastTime = 0;
      draw();
      if (!paused && visible && !document.hidden) {
        frame = requestAnimationFrame(animate);
      }
    };
    const resize = () => {
      const rect = field.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting === true;
      syncMotion();
    });
    const resizeObserver = new ResizeObserver(resize);
    observer.observe(field);
    resizeObserver.observe(field);
    document.addEventListener('visibilitychange', syncMotion);
    redraw.current = draw;
    resize();
    syncMotion();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', syncMotion);
      redraw.current = null;
    };
  }, [paused]);

  return (
    <figure className="signal-figure">
      <div
        className="signal-stage"
        ref={fieldRef}
        onPointerMove={(event) => {
          if (paused || event.pointerType === 'touch') return;
          const rect = event.currentTarget.getBoundingClientRect();
          pointer.current = {
            x: (event.clientX - rect.left) / rect.width - 0.5,
            y: (event.clientY - rect.top) / rect.height - 0.5,
          };
        }}
        onPointerLeave={() => {
          pointer.current = { x: 0, y: 0 };
        }}
      >
        <div className="field-registration mono" aria-hidden="true">
          <span>IF / 001</span>
          <span>
            +<br />+<br />+
          </span>
        </div>
        <svg
          className="field-axis"
          viewBox="0 0 100 100"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12 82 87 16M22 9 79 91"
            stroke="currentColor"
            strokeWidth="0.2"
            strokeDasharray="0.6 0.6"
          />
        </svg>
        <div className="field-shadow" aria-hidden="true" />
        <canvas
          ref={canvasRef}
          aria-label="An orange, woven signal loop. Decorative artwork, not live telemetry."
          role="img"
          data-motion={paused ? 'paused' : 'running'}
        />
        {!available && (
          <p className="art-unavailable" role="status">
            Interactive artwork is unavailable. The proof lab is still usable.
          </p>
        )}
        <span className="field-coordinate mono" aria-hidden="true">
          [ SIGNAL / FORM ]
        </span>
      </div>
      <div className="signal-controls">
        <label className="signal-slider mono">
          <span>ORDER</span>
          <input
            aria-label="Sculpture interference"
            type="range"
            min="0"
            max="100"
            value={interference}
            onChange={(event) => {
              const value = Number(event.target.value);
              setInterference(value);
              interferenceRef.current = value / 100;
              redraw.current?.();
            }}
          />
          <span>NOISE</span>
        </label>
        <button
          className="motion-button"
          onClick={() => setPaused((value) => !value)}
          type="button"
          aria-label={
            paused ? 'Resume sculpture motion' : 'Pause sculpture motion'
          }
          aria-pressed={paused}
          disabled={!available}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            {paused ? (
              <path d="m7 4 9 6-9 6z" />
            ) : (
              <path d="M5 4h3v12H5zm7 0h3v12h-3z" />
            )}
          </svg>
        </button>
      </div>
      <figcaption className="signal-caption mono">
        FIG. 01 &mdash; AN INTERFERENCE STUDY. ART, NOT TELEMETRY.
      </figcaption>
    </figure>
  );
}
