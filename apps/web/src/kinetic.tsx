import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { getField } from './field/store';
import { BrandMark } from './icons';
import { useFrame } from './motion';

/** Pulls its child a little toward a nearby mouse pointer. */
export function Magnetic({
  children,
  strength = 0.28,
}: {
  children: ReactNode;
  strength?: number;
}) {
  const innerRef = useRef<HTMLSpanElement>(null);

  function move(event: PointerEvent<HTMLSpanElement>) {
    const inner = innerRef.current;
    if (!inner || event.pointerType !== 'mouse' || getField().reduced) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - (rect.left + rect.width / 2)) * strength;
    const y = (event.clientY - (rect.top + rect.height / 2)) * strength;
    inner.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  function release() {
    if (innerRef.current) innerRef.current.style.transform = '';
  }

  return (
    <span className="magnetic" onPointerMove={move} onPointerLeave={release}>
      <span className="magnetic-inner" ref={innerRef}>
        {children}
      </span>
    </span>
  );
}

/** A decorative band of type that drifts, and leans into the scroll. */
export function Marquee({
  items,
  reverse = false,
}: {
  items: readonly ReactNode[];
  reverse?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const offset = useRef(0);

  useFrame((frame) => {
    const track = trackRef.current;
    if (!track) return;
    const field = getField();
    if (field.reduced) {
      if (track.style.transform) track.style.transform = '';
      return;
    }
    const half = track.offsetWidth / 2;
    if (half < 1) return;
    // Paused motion stops the drift; scrolling still moves the band.
    const speed = (field.paused ? 0 : 46) + Math.abs(frame.velocity) * 0.32;
    offset.current = (offset.current + speed * frame.dt) % half;
    const x = reverse ? offset.current - half : -offset.current;
    const lean = Math.max(-6, Math.min(6, frame.velocity * -0.0035));
    track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0) skewX(${lean.toFixed(2)}deg)`;
  });

  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track" ref={trackRef}>
        {[...items, ...items].map((item, index) => (
          <span className="marquee-item" key={index}>
            {item}
            <BrandMark />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Reveals `[data-reveal]` elements as they scroll into view. Content is only
 * hidden beforehand when `main.tsx` opted in with the `has-reveal` class, so
 * it stays visible without JavaScript or with reduced motion.
 */
export function useReveal(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const nodes = document.querySelectorAll<HTMLElement>('[data-reveal]');
    if (
      !document.documentElement.classList.contains('has-reveal') ||
      !('IntersectionObserver' in window)
    ) {
      nodes.forEach((node) => node.classList.add('is-in'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.01 },
    );
    nodes.forEach((node) => {
      // Whatever is on screen when the page opens appears together.
      if (node.getBoundingClientRect().top < window.innerHeight) {
        node.classList.add('is-in');
      } else {
        observer.observe(node);
      }
    });
    return () => observer.disconnect();
  }, [active]);
}
