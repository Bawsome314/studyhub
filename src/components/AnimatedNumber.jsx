import { useState, useEffect, useRef } from 'react';

export default function AnimatedNumber({ value, duration = 600 }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const numVal = typeof value === 'number' ? value : parseInt(value) || 0;
    const start = prevRef.current;
    const diff = numVal - start;
    if (diff === 0) { setDisplay(numVal); return; }

    const startTime = performance.now();
    let raf;

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevRef.current = numVal;
      }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}
