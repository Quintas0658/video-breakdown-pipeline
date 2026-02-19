"use client";

import { useEffect } from "react";

/**
 * MouseGlow — writes --mouse-x / --mouse-y CSS vars to <html>.
 * The body::before in globals.css uses these to create a subtle
 * radial gradient that follows the cursor.
 * Zero DOM overhead, purely declarative via CSS custom properties.
 */
export default function MouseGlow() {
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      document.documentElement.style.setProperty("--mouse-x", `${e.clientX}px`);
      document.documentElement.style.setProperty("--mouse-y", `${e.clientY}px`);
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  return null;
}
