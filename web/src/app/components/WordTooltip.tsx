"use client";

import { useState, useRef } from "react";

interface WordTooltipProps {
  phrase: string;
  translation: string;
  level: string;
  color: string;
}

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
  purple: {
    background: "rgba(196,181,201,0.25)",
    color: "#927a9e",
    borderBottom: "1px solid rgba(196,181,201,0.6)",
  },
};

const levelLabels: Record<string, string> = {
  A2: "Basic",
  B1: "Intermediate",
  B2: "Upper-Intermediate",
  C1: "Advanced",
};

export default function WordTooltip({ phrase, translation, level, color }: WordTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = window.setTimeout(() => setShowTooltip(false), 200);
  };

  const phraseStyle = colorMap[color] || colorMap.blue;

  return (
    <span
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
        <span
          className="tooltip-enter"
          style={{
            position: "absolute",
            zIndex: 50,
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: "max-content",
            maxWidth: "200px",
            padding: "8px 12px",
            borderRadius: "8px",
            background: "#3a3229",
            border: "1px solid #8b7e70",
            boxShadow: "0 8px 24px rgba(58,50,41,0.3)",
          }}
        >
          <span style={{ display: "block", fontWeight: 500, fontSize: "13px", color: "#f5f0ea" }}>
            {translation}
          </span>
          <span style={{ display: "block", marginTop: "2px", fontSize: "11px", color: "#bfb5a8" }}>
            {levelLabels[level] || level}
          </span>
          <span
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid #3a3229",
            }}
          />
        </span>
      )}
    </span>
  );
}
