import { useState, useEffect, useRef } from 'react';

export function useActiveSection(sectionIds) {
  const [activeSection, setActiveSection] = useState('');
  const ratios = useRef({});

  useEffect(() => {
    if (!sectionIds.length) return;

    ratios.current = {};

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.current[entry.target.id] = entry.intersectionRatio;
        }
        let best = '';
        let bestRatio = 0;
        for (const id of sectionIds) {
          const r = ratios.current[id] || 0;
          if (r > bestRatio) {
            bestRatio = r;
            best = id;
          }
        }
        if (best) setActiveSection(best);
      },
      {
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
        rootMargin: '-10% 0px -50% 0px',
      }
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sectionIds]);

  return activeSection;
}
