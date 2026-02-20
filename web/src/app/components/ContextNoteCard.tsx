"use client";

import { useState } from "react";
import type { ContextNote } from "@/lib/types";

interface ContextNoteCardProps {
  notes: ContextNote[];
}

const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  cultural: { icon: "🌍", label: "Cultural", color: "#e8a87c", bg: "rgba(232,168,124,0.06)" },
  knowledge: { icon: "📚", label: "Knowledge", color: "#7cb8d4", bg: "rgba(124,184,212,0.06)" },
  social_connotation: { icon: "💬", label: "Social", color: "#c4a0d4", bg: "rgba(196,160,212,0.06)" },
  dialect_warning: { icon: "⚠️", label: "Dialect", color: "#d4a86a", bg: "rgba(212,168,106,0.06)" },
};

export function ContextNoteIcon({ notes, onToggle, isExpanded }: { notes: ContextNote[]; onToggle: () => void; isExpanded: boolean }) {
  if (!notes || notes.length === 0) return null;

  // Show icon for first note's type, or mixed if multiple types
  const types = new Set(notes.map((n) => n.type));
  const hasMultiple = types.size > 1;

  return (
    <span
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "2px",
        fontSize: "12px",
        cursor: "pointer",
        opacity: isExpanded ? 1 : 0.6,
        transition: "opacity 0.15s",
        flexShrink: 0,
        marginLeft: "6px",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      onMouseLeave={(e) => { if (!isExpanded) (e.currentTarget as HTMLElement).style.opacity = "0.6"; }}
      title={`${notes.length} context note${notes.length > 1 ? "s" : ""}`}
    >
      {hasMultiple ? "💡" : (TYPE_CONFIG[notes[0].type]?.icon || "💡")}
      {notes.length > 1 && (
        <span style={{ fontSize: "9px", color: "#a09585" }}>{notes.length}</span>
      )}
    </span>
  );
}

export function ContextNoteExpanded({ notes }: ContextNoteCardProps) {
  return (
    <div style={{ padding: "4px 12px 8px 48px" }}>
      {notes.map((note, i) => {
        const config = TYPE_CONFIG[note.type] || TYPE_CONFIG.knowledge;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              gap: "8px",
              padding: "8px 12px",
              marginBottom: "4px",
              borderRadius: "6px",
              background: config.bg,
              borderLeft: `2px solid ${config.color}`,
              fontSize: "12px",
              lineHeight: "1.5",
            }}
          >
            <span style={{ flexShrink: 0, fontSize: "14px" }}>{config.icon}</span>
            <div>
              <div style={{ fontWeight: 600, color: "#3a3229", fontSize: "12px", marginBottom: "2px" }}>
                {note.title}
              </div>
              <div style={{ color: "#6b6259" }}>
                {note.note}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
