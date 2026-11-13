import { useEffect, useState } from 'react';
import { ChapterRail, Cursor, Header, Intro } from './chrome';
import Field from './field/Field';
import { getField, revealField, useField } from './field/store';
import { Marquee, useReveal } from './kinetic';
import { Boundaries, Footer, Hero, Idea } from './sections';
import VerificationLab from './VerificationLab';

export default function App() {
  const { paused } = useField();
  // Reduced motion skips the opening curtain and shows the page at once.
  const [intro] = useState(() => !getField().reduced);
  const [ready, setReady] = useState(!intro);
  useReveal(ready);

  useEffect(() => {
    if (ready) revealField();
  }, [ready]);

  useEffect(() => {
    document.documentElement.classList.toggle('is-paused', paused);
  }, [paused]);

  return (
    <div className="site" id="top">
      <a className="skip-link" href="#proof-lab">
        Skip to the live console
      </a>
      <Field />
      {intro && <Intro onDone={() => setReady(true)} />}
      <Cursor />
      <Header />
      <ChapterRail />
      <main>
        <Hero />
        <Marquee
          items={[
            'Less noise',
            <em key="proof">More proof</em>,
            'Evidence first',
            <em key="humans">Humans in the loop</em>,
          ]}
        />
        <Idea />
        <VerificationLab />
        <Boundaries />
      </main>
      <Footer />
    </div>
  );
}
