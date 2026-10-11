import React, { useEffect, useRef, useState } from "react";

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// Animated number that counts up/down smoothly whenever its `value` changes,
// with a subtle live "tick" flicker to mimic a live trading ticker (e.g. NSE).
// Always settles back to the true value.
export default function AnimatedCounter({
  value = 0,
  format,
  duration = 900,
  live = true,
  flickerInterval = 1900,
  className,
}) {
  const fmt = format || ((v) => v.toLocaleString());
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);
  const toRef = useRef(value);
  const fromRef = useRef(0);
  const startRef = useRef(0);

  const animateTo = (to, from) => {
    cancelAnimationFrame(rafRef.current);
    fromRef.current = from;
    toRef.current = to;
    startRef.current = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - startRef.current) / duration);
      const v = from + (to - from) * easeOut(t);
      setDisplay(v);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Animate on real value changes (incl. the initial count-up from 0).
  useEffect(() => {
    animateTo(value, display);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Live flicker: briefly nudge then settle back to the true value.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      const base = toRef.current;
      const jitter = (Math.random() - 0.5) * 2 * Math.max(1, Math.abs(base) * 0.0016);
      animateTo(base, base + jitter);
    }, flickerInterval);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, flickerInterval]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return <span className={className}>{fmt(display)}</span>;
}