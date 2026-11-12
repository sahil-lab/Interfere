import SignalField from './SignalField';
import VerificationLab from './VerificationLab';

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={diagonal ? 'M5 19 19 5M5 5h14v14' : 'M4 12h16m-7-7 7 7-7 7'}
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M3 9h10V3h6v10h10v6H19v10h-6V19H3z" fill="currentColor" />
      <path d="m5 27 22-22" stroke="var(--paper)" strokeWidth="3" />
    </svg>
  );
}

export default function App() {
  return (
    <div className="site" id="top">
      <a className="skip-link" href="#proof-lab">
        Skip to the live console
      </a>

      <header className="site-header">
        <div className="page-width header-inner">
          <a className="wordmark" href="#top" aria-label="Interfere home">
            <BrandMark />
            interfere<span className="wordmark-period">.</span>
          </a>
          <nav aria-label="Primary navigation" className="main-nav">
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
          <a href="#proof-lab" className="header-cta">
            Open console <Arrow diagonal />
          </a>
        </div>
      </header>

      <main>
        <section className="hero page-width" aria-labelledby="hero-title">
          <div className="hero-mastline mono">
            <span>
              <span className="square-mark" /> A LOCAL EXPERIMENT IN RELIABLE
              SOFTWARE
            </span>
            <span className="edition">INDEPENDENT EDITION / 001</span>
          </div>

          <div className="hero-layout">
            <div className="hero-copy">
              <h1 id="hero-title">
                <span className="hero-line">Less noise.</span>
                <span className="hero-line accent-line">More proof.</span>
              </h1>
              <p className="hero-description">
                When software breaks, certainty matters.
                <br />
                Start with the evidence.
                <br />
                Keep humans in the loop.
              </p>
              <a href="#proof-lab" className="button-primary hero-button">
                Enter the proof lab
                <span className="button-arrow">
                  <Arrow diagonal />
                </span>
              </a>
              <p className="hero-disclaimer mono">
                PHASE 01 / REAL CONNECTION. SYNTHETIC DATA.
              </p>
            </div>
            <SignalField />
          </div>

          <div className="hero-footline mono">
            <span>BUILT TO QUESTION. DESIGNED TO VERIFY.</span>
            <a href="#principle">
              SCROLL TO EXPLORE <span aria-hidden="true">&#8595;</span>
            </a>
          </div>
        </section>

        <section
          className="principle"
          id="principle"
          aria-labelledby="idea-title"
        >
          <div className="page-width">
            <div className="principle-intro">
              <div className="chapter-label mono">
                <span className="chapter-index">01 /</span>
                THE IDEA
                <span className="principle-glyph" aria-hidden="true">
                  <BrandMark />
                </span>
              </div>
              <div className="principle-copy">
                <h2 id="idea-title">
                  A fix should start
                  <br />
                  with <span>evidence.</span>
                  <br />
                  Not a leap of faith.
                </h2>
                <p>
                  That is the idea behind Interfere. Before the agents, the
                  automation, and the promises, there is a simpler question:
                  <em> can we prove the foundation works?</em>
                </p>
              </div>
            </div>
            <ol
              className="principle-steps"
              aria-label="The current verification flow"
            >
              <li>
                <span className="step-index mono">01</span>
                <div>
                  <h3>Read the signal.</h3>
                  <p>
                    One local request. One synthetic fixture. No borrowed data.
                  </p>
                </div>
                <Arrow />
              </li>
              <li>
                <span className="step-index mono">02</span>
                <div>
                  <h3>Question the input.</h3>
                  <p>
                    Validate the contract. Reject everything that does not
                    belong.
                  </p>
                </div>
                <Arrow />
              </li>
              <li>
                <span className="step-index mono">03</span>
                <div>
                  <h3>Show the proof.</h3>
                  <p>
                    Read PostgreSQL. Return the evidence. Never invent a
                    success.
                  </p>
                </div>
                <span className="step-complete" aria-hidden="true">
                  &#10003;
                </span>
              </li>
            </ol>
            <div className="principle-foot mono">
              <span>A SMALL FOUNDATION. A DELIBERATE FIRST STEP.</span>
              <span>NO AI AGENTS ARE RUNNING.</span>
            </div>
          </div>
        </section>

        <VerificationLab />

        <section
          className="boundaries page-width"
          id="boundaries"
          aria-labelledby="boundaries-title"
        >
          <div className="section-topline mono">
            <span>03 / HUMAN BY DESIGN</span>
            <span>RESTRAINT IS A FEATURE.</span>
          </div>
          <div className="boundaries-layout">
            <div className="boundaries-statement">
              <h2 id="boundaries-title">
                The brakes are
                <br />
                part of the engine.
              </h2>
              <p>
                A good prototype is honest about its limits. This one does not
                collect your telemetry, change your code, or deploy behind your
                back.
              </p>
              <a className="text-link" href="/openapi.yaml">
                Inspect the actual API contract <Arrow diagonal />
              </a>
              <div className="human-stamp">
                <span className="stamp-symbol" aria-hidden="true">
                  +
                </span>
                <span className="mono">
                  HUMAN JUDGMENT
                  <br />
                  IS NOT OPTIONAL.
                </span>
              </div>
            </div>
            <div className="boundary-accordions">
              <details open>
                <summary>
                  <span className="mono">01</span>
                  What works today
                  <span className="disclosure-icon" aria-hidden="true" />
                </summary>
                <div className="boundary-content">
                  <p>
                    The local foundation: React and TypeScript, a Java 21 API,
                    PostgreSQL, migrations, health checks, validated requests,
                    and explicit errors.
                  </p>
                  <span className="scope-tag mono">
                    PHASE 0 + 1 / IMPLEMENTED
                  </span>
                </div>
              </details>
              <details>
                <summary>
                  <span className="mono">02</span>
                  What comes next
                  <span className="disclosure-icon" aria-hidden="true" />
                </summary>
                <div className="boundary-content">
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
                  <span className="scope-tag mono">
                    NOT IMPLEMENTED / NO RESULTS CLAIMED
                  </span>
                </div>
              </details>
              <details>
                <summary>
                  <span className="mono">03</span>
                  The lines we do not cross
                  <span className="disclosure-icon" aria-hidden="true" />
                </summary>
                <div className="boundary-content">
                  <p>
                    Synthetic data only. No telemetry collection, cloud
                    services, Git actions, or autonomous production changes. Any
                    future patch requires explicit human review.
                  </p>
                  <p>
                    This is an unauthenticated, loopback-only prototype, not a
                    production-ready service or a completed security audit.
                  </p>
                </div>
              </details>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="page-width">
          <div className="footer-top">
            <p>
              Less speculation.
              <br />
              More understanding.
            </p>
            <a href="#top" className="back-top">
              Back to the beginning <span aria-hidden="true">&#8593;</span>
            </a>
          </div>
          <div className="footer-wordmark" aria-hidden="true">
            interfere<span>.</span>
          </div>
          <div className="footer-bottom mono">
            <span>INDEPENDENT PROTOTYPE. NOT AFFILIATED WITH INTERFERE.</span>
            <span>LOCAL-FIRST / HUMAN-LED / PHASE 01</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
