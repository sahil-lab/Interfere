import { useEffect, useRef, useState } from 'react';
import { getField, useField } from './field/store';
import { Arrow, BrandMark } from './icons';
import { Magnetic } from './kinetic';
import { useFrame } from './motion';

/**
 * Opening curtain. The count follows real readiness (fonts loaded, the field
 * compiled and drawn) plus a short minimum, then lifts. It never blocks the
 * page for more than a few seconds, and is not rendered for reduced motion.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const fieldReady = useField().status !== 'starting';
  const [fontsReady, setFontsReady] = useState(false);
  const [phase, setPhase] = useState<'counting' | 'leaving' | 'gone'>(
    'counting',
  );
  const countRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const born = useRef(0);
  const done = useRef(onDone);

  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    let alive = true;
    void document.fonts.ready.then(() => {
      if (alive) setFontsReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'counting') return;
    let raf = 0;
    let previous = 0;
    const step = (now: number) => {
      if (!born.current) born.current = now;
      const elapsed = now - born.current;
      // Time-based, so a slow device is never held on the curtain for longer.
      const dt = previous ? Math.min((now - previous) / 1000, 0.5) : 1 / 60;
      previous = now;
      const goal =
        elapsed > 4500
          ? 100
          : (fontsReady ? 35 : 0) +
            (fieldReady ? 35 : 0) +
            Math.min(elapsed / 1000, 1) * 30;
      shown.current += (goal - shown.current) * (1 - Math.exp(-dt * 9));
      if (goal - shown.current < 0.5) shown.current = goal;
      if (countRef.current) {
        countRef.current.textContent = String(
          Math.round(shown.current),
        ).padStart(3, '0');
      }
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${(shown.current / 100).toFixed(3)})`;
      }
      if (shown.current >= 100) {
        setPhase('leaving');
        done.current();
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, fontsReady, fieldReady]);

  useEffect(() => {
    if (phase !== 'leaving') return;
    const timer = window.setTimeout(() => setPhase('gone'), 1200);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <div
      className={phase === 'leaving' ? 'intro is-leaving' : 'intro'}
      aria-hidden="true"
    >
      <div className="intro-wipe" />
      <div className="intro-panel">
        <div className="intro-top mono">
          <span className="intro-mark">
            <BrandMark />
            interfere.
          </span>
          <span>Local / Synthetic / Phase 01</span>
        </div>
        <span className="intro-count" ref={countRef}>
          000
        </span>
        <div>
          <div className="intro-foot mono">
            <ul className="intro-steps">
              <li className={fontsReady ? 'is-on' : undefined}>Type</li>
              <li className={fieldReady ? 'is-on' : undefined}>Field</li>
            </ul>
            <span>Less noise. More proof.</span>
          </div>
          <div className="intro-bar">
            <span ref={barRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A ring that trails the mouse and opens over interactive elements. */
export function Cursor() {
  const ringRef = useRef<HTMLDivElement>(null);
  const position = useRef({ x: 0, y: 0, seen: false });
  const reduced = useField().reduced;
  const [fine] = useState(
    () => window.matchMedia('(hover: hover) and (pointer: fine)').matches,
  );
  const enabled = fine && !reduced;

  useEffect(() => {
    if (!enabled) return;
    const over = (event: PointerEvent) => {
      const interactive =
        event.target instanceof Element &&
        event.target.closest('a, button, summary, input, [role="tab"]');
      ringRef.current?.classList.toggle('is-active', Boolean(interactive));
    };
    const down = () => ringRef.current?.classList.add('is-down');
    const up = () => ringRef.current?.classList.remove('is-down');
    document.addEventListener('pointerover', over, { passive: true });
    document.addEventListener('pointerdown', down, { passive: true });
    document.addEventListener('pointerup', up, { passive: true });
    return () => {
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
    };
  }, [enabled]);

  useFrame((frame) => {
    const ring = ringRef.current;
    if (!ring) return;
    const at = position.current;
    if (!at.seen) {
      if (frame.pointer < 0.001) return;
      at.x = frame.pointerX;
      at.y = frame.pointerY;
      at.seen = true;
    }
    const follow = 1 - Math.exp(-frame.dt * 16);
    at.x += (frame.pointerX - at.x) * follow;
    at.y += (frame.pointerY - at.y) * follow;
    ring.style.transform = `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0)`;
    ring.style.opacity = Math.min(1, frame.pointer * 1.5).toFixed(2);
  });

  if (!enabled) return null;
  return (
    <div className="cursor-ring" ref={ringRef} aria-hidden="true">
      <span />
    </div>
  );
}

export function Header() {
  const ref = useRef<HTMLElement>(null);
  const mark = useRef(0);

  useFrame((frame) => {
    const header = ref.current;
    if (!header) return;
    const y = frame.scrollY;
    header.classList.toggle('is-scrolled', y > 40);
    // Leave on scroll down, return on scroll up; never hide a focused header.
    if (
      getField().reduced ||
      y < 160 ||
      header.contains(document.activeElement)
    ) {
      header.classList.remove('is-hidden');
      mark.current = y;
    } else if (y > mark.current + 12) {
      header.classList.add('is-hidden');
      mark.current = y;
    } else if (y < mark.current - 12) {
      header.classList.remove('is-hidden');
      mark.current = y;
    }
  });

  return (
    <header className="site-header" ref={ref}>
      <div className="page header-inner">
        <a className="wordmark" href="#top" aria-label="Interfere home">
          <BrandMark />
          <span>
            interfere<i>.</i>
          </span>
        </a>
        <nav className="main-nav" aria-label="Primary navigation">
          <a href="#principle">
            The idea <sup>01</sup>
          </a>
          <a href="#proof-lab">
            Live proof <sup>02</sup>
          </a>
          <a href="#boundaries">
            Boundaries <sup>03</sup>
          </a>
        </nav>
        <Magnetic>
          <a className="header-cta" href="#proof-lab">
            Open console <Arrow />
          </a>
        </Magnetic>
      </div>
    </header>
  );
}

const CHAPTERS = [
  { href: '#top', label: 'Noise' },
  { href: '#principle', label: 'Signal' },
  { href: '#proof-lab', label: 'Evidence' },
  { href: '#boundaries', label: 'Human' },
] as const;

/** Chapter index at the screen edge, named after the field's formations. */
export function ChapterRail() {
  const ref = useRef<HTMLElement>(null);
  const current = useRef(-1);
  const targets = useRef<(Element | null)[] | null>(null);

  useFrame((frame) => {
    const rail = ref.current;
    if (!rail) return;
    targets.current ??= [
      ...CHAPTERS.map((chapter) => document.querySelector(chapter.href)),
      document.querySelector('.site-footer'),
    ];
    const marks = targets.current;
    let active = 0;
    CHAPTERS.forEach((_, index) => {
      const section = marks[index];
      if (section && section.getBoundingClientRect().top <= frame.vh * 0.5) {
        active = index;
      }
    });
    // The rail would sit on top of the footer's own type.
    const footer = marks[CHAPTERS.length];
    rail.classList.toggle(
      'is-hidden',
      Boolean(footer && footer.getBoundingClientRect().top < frame.vh * 0.75),
    );
    if (active === current.current) return;
    current.current = active;
    rail.querySelectorAll('a').forEach((link, index) => {
      if (index === active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  });

  return (
    <nav className="rail" aria-label="Chapters" ref={ref}>
      {CHAPTERS.map((chapter, index) => (
        <a href={chapter.href} key={chapter.href}>
          <span>
            0{index} {chapter.label}
          </span>
        </a>
      ))}
    </nav>
  );
}
