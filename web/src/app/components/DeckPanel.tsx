"use client";

import { useEffect, useState } from "react";
import type { SavedExpression } from "@/lib/types";
import { getSavedDeck, deleteFromDeck } from "@/lib/api";

const REGISTER_LABELS: Record<string, { icon: string; label: string }> = {
  general_spoken: { icon: "🟢", label: "General" },
  professional_spoken: { icon: "🔵", label: "Professional" },
  regional_cultural: { icon: "🟡", label: "Regional" },
  formal_written: { icon: "⚪", label: "Formal" },
};

export default function DeckPanel() {
  const [expressions, setExpressions] = useState<SavedExpression[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDeck = async () => {
    try {
      const data = await getSavedDeck();
      setExpressions(data.expressions);
    } catch (err) {
      console.error("Failed to load deck:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDeck();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await deleteFromDeck(id);
      setExpressions((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  // Group by video_id
  const grouped = expressions.reduce<Record<string, SavedExpression[]>>((acc, expr) => {
    const key = expr.video_id || "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(expr);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#a09585", fontSize: "13px" }}>
        Loading deck...
      </div>
    );
  }

  if (expressions.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px" }}>
        <div style={{ fontSize: "28px", opacity: 0.15 }}>📚</div>
        <p style={{ fontSize: "13px", color: "#a09585", textAlign: "center", maxWidth: "240px", lineHeight: 1.6 }}>
          Save expressions from video subtitles to build your personal deck
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" style={{ padding: "12px 16px", background: "#fdfcfb" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", padding: "0 4px" }}>
        <span style={{ fontSize: "11px", color: "#a09585" }}>
          {expressions.length} expression{expressions.length !== 1 ? "s" : ""} saved
        </span>
        <span
          style={{
            fontSize: "11px",
            color: "#bfb5a8",
            border: "1px solid rgba(191,181,168,0.3)",
            borderRadius: "4px",
            padding: "2px 8px",
            cursor: "default",
          }}
          title="Coming soon with premium"
        >
          Export (Coming Soon)
        </span>
      </div>

      {/* Grouped by video */}
      {Object.entries(grouped).map(([videoId, exprs]) => (
        <div key={videoId} style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "10px", color: "#bfb5a8", marginBottom: "6px", padding: "0 4px", fontFamily: "var(--font-geist-mono, monospace)" }}>
            {videoId}
          </div>
          {exprs.map((expr) => {
            const reg = expr.register ? REGISTER_LABELS[expr.register] : null;
            return (
              <div
                key={expr.id}
                style={{
                  display: "flex",
                  gap: "10px",
                  padding: "8px 12px",
                  marginBottom: "4px",
                  borderRadius: "6px",
                  background: "rgba(217,168,143,0.04)",
                  border: "1px solid rgba(217,168,143,0.1)",
                  fontSize: "12px",
                  lineHeight: 1.5,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Phrase + register */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                    <span style={{ fontWeight: 600, color: "#3a3229", fontSize: "13px" }}>
                      {expr.phrase}
                    </span>
                    {reg && (
                      <span style={{ fontSize: "10px", color: "#a09585" }}>
                        {reg.icon} {reg.label}
                      </span>
                    )}
                    {expr.level && (
                      <span style={{ fontSize: "9px", color: "#bfb5a8", border: "1px solid rgba(191,181,168,0.3)", borderRadius: "3px", padding: "0 3px" }}>
                        {expr.level}
                      </span>
                    )}
                  </div>
                  {/* Translation */}
                  <div style={{ color: "#6b6259" }}>
                    {expr.translation}
                  </div>
                  {/* Alternative */}
                  {expr.alternative && (
                    <div style={{ color: "#a09585", fontSize: "11px", marginTop: "2px" }}>
                      教科书说法: {expr.alternative}
                    </div>
                  )}
                  {/* Context */}
                  {expr.context_sentence && (
                    <div style={{ color: "#bfb5a8", fontSize: "10px", marginTop: "3px", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      &quot;{expr.context_sentence}&quot;
                    </div>
                  )}
                </div>
                {/* Delete button */}
                <span
                  onClick={() => handleDelete(expr.id)}
                  style={{
                    cursor: "pointer",
                    fontSize: "14px",
                    color: "#bfb5a8",
                    flexShrink: 0,
                    padding: "2px",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#d8a5a0"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#bfb5a8"; }}
                  title="Remove from deck"
                >
                  ×
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
