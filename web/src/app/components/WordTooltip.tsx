"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface WordTooltipProps {
  phrase: string;
  translation: string;
  level: string;
  color: string;
  register?: string;
  frequency?: string;
  alternative?: string | null;
  category?: string; // legacy compat
}

// Register-based colors (primary system in v1.2)
const colorMap: Record<string, React.CSSProperties> = {
  green: {
    background: "rgba(181,196,168,0.25)",
    color: "#7a8f6d",
    borderBottom: "1px solid rgba(181,196,168,0.6)",
  },
  blue: {
    background: "rgba(164,184,196,0.25)",
    color: "#7596a8",
    borderBottom: "1px solid rgba(164,184,196,0.6)",
  },
  yellow: {
    background: "rgba(212,186,130,0.25)",
    color: "#a08840",
    borderBottom: "1px solid rgba(212,186,130,0.6)",
  },
  gray: {
    background: "rgba(180,180,180,0.18)",
    color: "#8a8a8a",
    borderBottom: "1px dashed rgba(180,180,180,0.6)",
  },
  purple: {
    background: "rgba(196,181,201,0.25)",
    color: "#927a9e",
    borderBottom: "1px solid rgba(196,181,201,0.6)",
  },
};

const levelLabels: Record<string, string> = {
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
};

const registerLabels: Record<string, { icon: string; label: string; warning?: string }> = {
  general_spoken: { icon: "🟢", label: "General Spoken" },
  professional_spoken: { icon: "🔵", label: "Professional Spoken" },
  regional_cultural: { icon: "🟡", label: "Regional / Cultural" },
  formal_written: { icon: "⚪", label: "Formal Written", warning: "不建议口语使用" },
};

const frequencyLabels: Record<string, string> = {
  very_high: "口语极高频",
  high: "口语高频",
  medium: "口语中频",
  low: "口语低频",
};

function TooltipPortal({
  anchorRef,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  anchorRef: React.RefObject<HTMLSpanElement | null>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  children: React.ReactNode;
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; arrowDir: "down" | "up" }>({ top: 0, left: 0, arrowDir: "down" });

  const updatePosition = useCallback(() => {
    if (!anchorRef.current || !tooltipRef.current) return;

    const anchor = anchorRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const gap = 8;

    // Vertical: prefer above, fallback below
    let top: number;
    let arrowDir: "down" | "up";
    if (anchor.top - tooltip.height - gap > 0) {
      top = anchor.top - tooltip.height - gap;
      arrowDir = "down";
    } else {
      top = anchor.bottom + gap;
      arrowDir = "up";
    }

    // Horizontal: center, clamp to viewport
    let left = anchor.left + anchor.width / 2 - tooltip.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tooltip.width - 8));

    setPos({ top, left, arrowDir });
  }, [anchorRef]);

  useEffect(() => {
    // Initial position + update on scroll/resize
    updatePosition();
    // Use requestAnimationFrame for a second measurement after render
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [updatePosition]);

  return createPortal(
    <div
      ref={tooltipRef}
      className="tooltip-enter"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: "fixed",
        zIndex: 9999,
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        width: "max-content",
        maxWidth: "280px",
        padding: "8px 12px",
        borderRadius: "8px",
        background: "#3a3229",
        border: "1px solid #8b7e70",
        boxShadow: "0 8px 24px rgba(58,50,41,0.3)",
        pointerEvents: "auto",
      }}
    >
      {children}
      {/* Arrow */}
      <span
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          ...(pos.arrowDir === "down"
            ? { top: "100%", borderTop: "5px solid #3a3229" }
            : { bottom: "100%", borderBottom: "5px solid #3a3229" }),
        }}
      />
    </div>,
    document.body
  );
}

export default function WordTooltip({ phrase, translation, level, color, register, frequency, alternative }: WordTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = window.setTimeout(() => setShowTooltip(false), 200);
  };

  const phraseStyle = colorMap[color] || colorMap.blue;
  const regInfo = register ? registerLabels[register] : null;

  return (
    <span
      ref={anchorRef}
      style={{ position: "relative", display: "inline" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span
        style={{
          ...phraseStyle,
          borderRadius: "3px",
          padding: "0 2px",
          cursor: "help",
          transition: "background 0.15s",
        }}
      >
        {phrase}
      </span>
      {showTooltip && (
        <TooltipPortal
          anchorRef={anchorRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Register tag */}
          {regInfo && (
            <span style={{ display: "block", marginBottom: "4px", fontSize: "10px", color: "#bfb5a8" }}>
              {regInfo.icon} {regInfo.label}
            </span>
          )}
          {/* Translation */}
          <span style={{ display: "block", fontWeight: 500, fontSize: "13px", color: "#f5f0ea" }}>
            {translation}
          </span>
          {/* Alternative */}
          {alternative && (
            <span style={{ display: "block", marginTop: "3px", fontSize: "11px", color: "#d9a88f" }}>
              教科书说法: {alternative}
            </span>
          )}
          {/* Formal written warning */}
          {regInfo?.warning && (
            <span style={{ display: "block", marginTop: "3px", fontSize: "10px", color: "#d8a5a0", fontStyle: "italic" }}>
              ⚠ {regInfo.warning}
            </span>
          )}
          {/* Footer: CEFR + frequency */}
          <span style={{ display: "flex", gap: "6px", marginTop: "4px", fontSize: "10px", color: "#a09585" }}>
            <span>{levelLabels[level] || level}</span>
            {frequency && frequencyLabels[frequency] && (
              <span>· {frequencyLabels[frequency]}</span>
            )}
          </span>
        </TooltipPortal>
      )}
    </span>
  );
}
