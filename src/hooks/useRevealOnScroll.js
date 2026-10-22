import { useEffect } from 'react';

// Fades sections in as they scroll into view. Elements matching `selector`
// inside `rootRef` get data-reveal; the root gets data-reveal-ready only once
// the observer is running, so content is never hidden if JS fails, and
// reduced-motion users see everything immediately.
export function useRevealOnScroll(rootRef, selector) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const targets = Array.from(root.querySelectorAll(selector));
    targets.forEach((el) => el.setAttribute('data-reveal', ''));
    root.setAttribute('data-reveal-ready', '');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-revealed', '');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    targets.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      root.removeAttribute('data-reveal-ready');
    };
  }, [rootRef, selector]);
}

export default useRevealOnScroll;
