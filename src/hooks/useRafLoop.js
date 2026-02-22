import { useEffect, useRef } from 'react';

export function useRafLoop(callback, enabled) {
  const callbackRef = useRef(callback);
  const rafRef = useRef(0);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    function loop(now) {
      callbackRef.current(now);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled]);
}
