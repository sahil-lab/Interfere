import { useRef } from 'react';
import { getField, setField, useField } from './field/store';
import { Arrow, BrandMark } from './icons';
import { Magnetic, Marquee } from './kinetic';
import { clamp01, useFrame } from './motion';

export function Hero() {
  const field = useField();
  const unavailable = field.status === 'unavailable';

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="page hero-inner">
        <div className="hero-top mono" data-reveal="fade">
          <span>
            <i className="pip" aria-hidden="true" />A local experiment in
            reliable software
          </span>
          <span className="hero-edition">Independent edition / 001</span>
        </div>

        <h1
          id="hero-title"
          aria-label="Less noise. More proof."
          data-reveal="lines"
        >
          <span className="line" aria-hidden="true">
            <span className="line-inner">
              Less{' '}
              <span className="glitch" data-text="noise.">
                noise.
              </span>
            </span>
          </span>{' '}
          <span className="line" aria-hidden="true">
            <span className="line-inner">
              More <em>proof.</em>
            </span>
          </span>
        </h1>

        <div className="hero-lede" data-reveal="fade">
          <p>
            When software breaks, certainty matters. Start with the evidence.
            Keep humans in the loop.
          </p>
          <Magnetic>
            <a className="cta" href="#proof-lab">
              <span>Enter the proof lab</span>
              <span className="cta-orb" aria-hidden="true">
                <Arrow />
              </span>
            </a>
          </Magnetic>
        </div>

        <div className="hero-art" data-field-anchor="0" aria-hidden="true" />

        <div className="hero-hud" data-reveal="fade">
          <p className="mono">Phase 01 / Real connection. Synthetic data.</p>
          <div className="field-controls">
            <label className="field-slider mono">
              <span aria-hidden="true">Order</span>
              <input
                type="range"
                min="0"
                max="100"
                aria-label="Field noise"
                value={Math.round(field.noise * 100)}
                disabled={unavailable}
                onChange={(event) =>
                  setField({ noise: Number(event.target.value) / 100 })
                }
              />
              <span aria-hidden="true">Noise</span>
            </label>
            <button
              type="button"
              className="motion-toggle"
              aria-pressed={field.paused}
              aria-label={
                field.paused ? 'Resume field motion' : 'Pause field motion'
              }
              disabled={unavailable}
              onClick={() => setField({ paused: !field.paused })}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                {field.paused ? (
                  <path d="m7 4 9 6-9 6z" />
                ) : (
                  <path d="M5 4h3v12H5zm7 0h3v12h-3z" />
                )}
              </svg>
            </button>
          </div>
          <a className="scroll-cue mono" href="#principle">
            Scroll <span aria-hidden="true" />
          </a>
        </div>
        <p
          className="field-caption mono"
          role={unavailable ? 'status' : undefined}
        >
          {unavailable
            ? 'Interactive artwork is unavailable or switched off. The proof lab is unaffected.'
            : `Generative field / ${field.points.toLocaleString('en-US')} points / Art, not telemetry.`}
        </p>
      </div>
    </section>
  );
}

const STATEMENT = [
  { text: 'A' },
  { text: 'fix' },
  { text: 'should' },
  { text: 'start' },
  { text: 'with' },
  { text: 'evidence.', accent: true },
  { text: 'Not' },
  { text: 'a' },
  { text: 'leap' },
  { text: 'of' },
  { text: 'faith.' },
] as const;

const STEPS = [
  {
    title: 'Read the signal.',
    copy: 'One local request. One synthetic fixture. No borrowed data.',
    tag: 'Web / React + TypeScript',
  },
  {
    title: 'Question the input.',
    copy: 'Validate the contract. Reject everything that does not belong.',
    tag: 'API / Spring Boot + Java 21',
  },
  {
    title: 'Show the proof.',
    copy: 'Read PostgreSQL. Return the evidence. Never invent a success.',
    tag: 'Database / PostgreSQL + Flyway',
  },
] as const;

export function Idea() {
  const statementRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const words = useRef<(HTMLSpanElement | null)[]>([]);
  const lit = useRef<string[]>([]);
  const slide = useRef({ shown: 0, written: '' });

  useFrame((frame) => {
    const reduced = getField().reduced;

    // Words light up one by one as the pinned statement is scrolled through.
    const statement = statementRef.current;
    if (statement) {
      const rect = statement.getBoundingClientRect();
      const span = rect.height - frame.vh;
      const progress =
        reduced || span <= 1
          ? 1
          : clamp01(
              (frame.vh * 0.35 - rect.top) / (span * 0.8 + frame.vh * 0.35),
            );
      const head = progress * (STATEMENT.length + 1.5);
      words.current.forEach((word, index) => {
        if (!word) return;
        const opacity = (0.14 + 0.86 * clamp01(head - index)).toFixed(3);
        if (lit.current[index] === opacity) return;
        lit.current[index] = opacity;
        word.style.opacity = opacity;
      });
    }

    // Vertical scroll drives the pinned steps sideways on wide screens.
    const steps = stepsRef.current;
    const track = trackRef.current;
    if (steps && track) {
      let target = 0;
      if (!reduced && frame.vw > 760) {
        const rect = steps.getBoundingClientRect();
        const span = rect.height - frame.vh;
        const progress = span > 1 ? clamp01(-rect.top / span) : 0;
        target = -Math.max(0, track.scrollWidth - frame.vw) * progress;
      }
      const state = slide.current;
      state.shown += (target - state.shown) * (1 - Math.exp(-frame.dt * 12));
      if (Math.abs(target - state.shown) < 0.1 || reduced) state.shown = target;
      const transform = state.shown
        ? `translate3d(${state.shown.toFixed(1)}px, 0, 0)`
        : '';
      if (transform !== state.written) {
        state.written = transform;
        track.style.transform = transform;
      }
    }
  });

  return (
    <section className="idea" id="principle" aria-labelledby="idea-title">
      <div className="idea-backdrop" aria-hidden="true">
        <div className="idea-anchor" data-field-anchor="1" />
      </div>

      <div className="statement" ref={statementRef}>
        <div className="page statement-pin">
          <p className="mono statement-label">01 / The idea</p>
          <h2 id="idea-title">
            {STATEMENT.map((word, index) => (
              <span key={index}>
                <span
                  className={'accent' in word ? 'word is-accent' : 'word'}
                  ref={(node) => {
                    words.current[index] = node;
                  }}
                >
                  {word.text}
                </span>{' '}
              </span>
            ))}
          </h2>
          <p className="statement-note">
            That is the idea behind Interfere. Before the agents, the
            automation, and the promises, there is a simpler question:{' '}
            <strong>can we prove the foundation works?</strong>
          </p>
        </div>
      </div>

      <div className="steps" ref={stepsRef}>
        <div className="steps-pin">
          <div className="steps-track" ref={trackRef}>
            <div className="steps-lead">
              <p className="mono">Three moves. No magic.</p>
              <p className="steps-lead-title">
                How the first proof <em>works.</em>
              </p>
              <span className="steps-arrow" aria-hidden="true">
                <Arrow />
              </span>
            </div>
            <ol
              className="steps-list"
              aria-label="The current verification flow"
            >
              {STEPS.map((step, index) => (
                <li className="step-card" key={step.title}>
                  <span className="step-number" aria-hidden="true">
                    0{index + 1}
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                  <span className="mono step-tag">{step.tag}</span>
                </li>
              ))}
            </ol>
            <div className="steps-tail">
              <p className="steps-lead-title">
                A small foundation. A deliberate <em>first step.</em>
              </p>
              <div className="steps-tail-foot">
                <p className="mono">No AI agents are running.</p>
                <BrandMark />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Boundaries() {
  const stampRef = useRef<SVGSVGElement>(null);

  useFrame((frame) => {
    const stamp = stampRef.current;
    if (!stamp || getField().reduced) return;
    stamp.style.transform = `rotate(${(frame.smoothY * 0.05).toFixed(2)}deg)`;
  });

  return (
    <section
      className="boundaries"
      id="boundaries"
      aria-labelledby="boundaries-title"
    >
      <div className="page">
        <div className="section-top mono" data-reveal="fade">
          <span>03 / Human by design</span>
          <span>Restraint is a feature.</span>
        </div>

        <div className="boundaries-head">
          <h2 id="boundaries-title" data-reveal="lines">
            <span className="line">
              <span className="line-inner">The brakes are</span>
            </span>{' '}
            <span className="line">
              <span className="line-inner">
                part of the <em>engine.</em>
              </span>
            </span>
          </h2>
          <div
            className="stamp"
            role="img"
            aria-label="Human judgment is not optional."
          >
            <svg viewBox="0 0 200 200" ref={stampRef} aria-hidden="true">
              <defs>
                <path
                  id="stamp-circle"
                  d="M100 100m-80 0a80 80 0 1 1 160 0a80 80 0 1 1-160 0"
                />
              </defs>
              <text>
                <textPath href="#stamp-circle" textLength="496">
                  HUMAN JUDGMENT IS NOT OPTIONAL + HUMAN JUDGMENT IS NOT
                  OPTIONAL +
                </textPath>
              </text>
            </svg>
            <span className="stamp-core" aria-hidden="true">
              +
            </span>
          </div>
        </div>

        <div className="boundaries-grid">
          <div className="boundaries-side" data-reveal="fade">
            <div className="print" data-field-anchor="3" aria-hidden="true" />
            <p className="mono print-caption">
              Fig. 04 / Human in the loop. Generative art, not biometrics.
            </p>
            <p className="boundaries-copy">
              A good prototype is honest about its limits. This one does not
              collect your telemetry, change your code, or deploy behind your
              back.
            </p>
            <a className="text-link" href="/openapi.yaml">
              Inspect the actual API contract <Arrow />
            </a>
          </div>

          <div className="accordions" data-reveal="fade">
            <details open>
              <summary>
                <span className="mono">01</span>
                What works today
                <span className="disclosure" aria-hidden="true" />
              </summary>
              <div className="accordion-body">
                <p>
                  The local foundation: React and TypeScript, a Java 21 API,
                  PostgreSQL, migrations, health checks, validated requests, and
                  explicit errors.
                </p>
                <span className="mono scope-tag">
                  Phase 0 + 1 / Implemented
                </span>
              </div>
            </details>
            <details>
              <summary>
                <span className="mono">02</span>
                What comes next
                <span className="disclosure" aria-hidden="true" />
              </summary>
              <div className="accordion-body">
                <h3>The repair engine comes later</h3>
                <ol className="roadmap">
                  <li>
                    <span>02</span> Domain APIs, permissions, and idempotency
                  </li>
                  <li>
                    <span>03</span> Seeded bugs, clustering, and reproduction
                  </li>
                  <li>
                    <span>04</span> Explicitly approved agent integrations
                  </li>
                  <li>
                    <span>05</span> Reliability and observability
                  </li>
                  <li>
                    <span>06</span> Measured benchmarks and packaging
                  </li>
                </ol>
                <span className="mono scope-tag">
                  Not implemented / No results claimed
                </span>
              </div>
            </details>
            <details>
              <summary>
                <span className="mono">03</span>
                The lines we do not cross
                <span className="disclosure" aria-hidden="true" />
              </summary>
              <div className="accordion-body">
                <p>
                  Synthetic data only. No telemetry collection, cloud services,
                  Git actions, or autonomous production changes. Any future
                  patch requires explicit human review.
                </p>
                <p>
                  This is an unauthenticated, loopback-only prototype, not a
                  production-ready service or a completed security audit.
                </p>
              </div>
            </details>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <Marquee
        reverse
        items={[
          'Less speculation',
          <em key="understanding">More understanding</em>,
          'Evidence first',
          <em key="humans">Humans in the loop</em>,
        ]}
      />
      <div className="page">
        <div className="footer-top">
          <p>
            Less speculation.
            <br />
            More understanding.
          </p>
          <Magnetic>
            <a className="back-top" href="#top">
              <span>Back to the beginning</span>
              <span className="back-orb" aria-hidden="true">
                <Arrow up />
              </span>
            </a>
          </Magnetic>
        </div>
        <div className="footer-wordmark" aria-hidden="true" data-reveal="rise">
          {'interfere'.split('').map((letter, index) => (
            <span key={index}>{letter}</span>
          ))}
          <span className="footer-period">.</span>
        </div>
        <div className="footer-bottom mono">
          <span>Independent prototype. Not affiliated with Interfere.</span>
          <span>Local-first / Human-led / Phase 01</span>
        </div>
      </div>
    </footer>
  );
}
