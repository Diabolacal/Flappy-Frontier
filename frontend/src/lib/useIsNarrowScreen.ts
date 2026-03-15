import { useState, useEffect } from 'react';

const MIN_WIDTH = 600;

/** Heuristic: true when the device is a mobile browser on a narrow screen. */
function checkIsMobileNarrow(): boolean {
  if (window.innerWidth >= MIN_WIDTH) return false;
  return /Android|iPhone|iPad|iPod|Mobile|webOS/i.test(navigator.userAgent);
}

/**
 * Returns true only when the viewport is narrow AND the user-agent looks like
 * a mobile browser. Desktop browsers and CEF-based webviews (e.g. EVE Frontier
 * SSU) are never flagged, even if the window starts small.
 */
export function useIsMobileNarrow(): boolean {
  const [mobile, setMobile] = useState(checkIsMobileNarrow);

  useEffect(() => {
    const onResize = () => setMobile(checkIsMobileNarrow());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return mobile;
}
