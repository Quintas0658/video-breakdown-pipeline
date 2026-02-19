"use client";

import { useEffect, useRef } from "react";

interface AnalysisPanelProps {
  layer0: string;
  breakdown: string;
  progress: string;
  isLoading: boolean;
  error: string;
}

function renderMarkdown(md: string): string {
  let html = md;

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre class="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 overflow-x-auto my-4 text-sm"><code>${escapeHtml(code.trim())}</code></pre>`;
  });

  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm">$1</code>'
  );

  // Headers
  html = html.replace(
    /^#### (.+)$/gm,
    '<h4 class="text-base font-semibold mt-4 mb-2">$1</h4>'
  );
  html = html.replace(
    /^### (.+)$/gm,
    '<h3 class="text-lg font-semibold mt-6 mb-3">$1</h3>'
  );
  html = html.replace(
    /^## (.+)$/gm,
    '<h2 class="text-xl font-bold mt-8 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-700">$1</h2>'
  );
  html = html.replace(
    /^# (.+)$/gm,
    '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>'
  );

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Tables
  html = html.replace(
    /^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n)*)/gm,
    (_match, header, body) => {
      const headers = header
        .split("|")
        .map((h: string) => h.trim())
        .filter(Boolean);
      const rows = body
        .trim()
        .split("\n")
        .map((row: string) =>
          row
            .split("|")
            .map((c: string) => c.trim())
            .filter(Boolean)
        );

      let table =
        '<div class="overflow-x-auto my-4"><table class="w-full text-sm border-collapse">';
      table += "<thead><tr>";
      for (const h of headers) {
        table += `<th class="text-left px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-medium">${h}</th>`;
      }
      table += "</tr></thead><tbody>";
      for (const row of rows) {
        table += "<tr>";
        for (const cell of row) {
          table += `<td class="px-3 py-2 border border-zinc-200 dark:border-zinc-700">${cell}</td>`;
        }
        table += "</tr>";
      }
      table += "</tbody></table></div>";
      return table;
    }
  );

  // Blockquotes
  html = html.replace(
    /^> (.+)$/gm,
    '<blockquote class="border-l-4 border-blue-400 pl-4 my-3 text-zinc-600 dark:text-zinc-400 italic">$1</blockquote>'
  );

  // Unordered lists
  html = html.replace(
    /^- (.+)$/gm,
    '<li class="ml-4 list-disc text-sm leading-relaxed">$1</li>'
  );

  // Paragraphs (lines not starting with HTML tags)
  html = html.replace(
    /^(?!<[a-z]|$)(.+)$/gm,
    '<p class="my-2 text-sm leading-relaxed">$1</p>'
  );

  // Emojis in headings get preserved naturally

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function AnalysisPanel({
  layer0,
  breakdown,
  progress,
  isLoading,
  error,
}: AnalysisPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to top when new content arrives
    if (containerRef.current && (layer0 || breakdown)) {
      containerRef.current.scrollTop = 0;
    }
  }, [layer0, breakdown]);

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: "24px", background: "#fdfcfb" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ color: "#d8a5a0", fontSize: "14px", marginBottom: "6px" }}>Analysis Error</div>
          <div style={{ color: "#8b7e70", fontSize: "13px" }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!layer0 && !breakdown && !isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "#fdfcfb" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: "#8b7e70", marginBottom: "6px" }}>Deep Analysis</p>
          <p style={{ fontSize: "12px", color: "#bfb5a8" }}>
            Load a video to start analysis with your persona
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto" style={{ padding: "20px 24px", background: "#fdfcfb" }}>
      {isLoading && (
        <div
          className="animate-fade-in"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "20px",
            padding: "12px 16px",
            borderRadius: "8px",
            background: "rgba(217,168,143,0.06)",
            border: "1px solid #e8dfd6",
          }}
        >
          <div
            style={{
              width: "14px",
              height: "14px",
              border: "1.5px solid #e8dfd6",
              borderTopColor: "#d9a88f",
              borderRadius: "50%",
              animation: "spin-smooth 0.8s linear infinite",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: "13px", color: "#8b7e70" }}>
            {progress || "Analyzing…"}
          </span>
        </div>
      )}

      {layer0 && (
        <div className="animate-fade-slide" style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <span style={{
              fontSize: "11px",
              fontWeight: 500,
              padding: "3px 8px",
              borderRadius: "4px",
              background: "rgba(230,197,160,0.2)",
              color: "#c9a88f",
              border: "1px solid rgba(230,197,160,0.4)",
            }}>
              Layer 0
            </span>
            <span style={{ fontSize: "11px", color: "#bfb5a8" }}>Value Bridge</span>
          </div>
          <div
            className="prose-custom"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(layer0) }}
          />
        </div>
      )}

      {breakdown && (
        <div className="animate-fade-slide">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <span style={{
              fontSize: "11px",
              fontWeight: 500,
              padding: "3px 8px",
              borderRadius: "4px",
              background: "rgba(164,184,196,0.2)",
              color: "#a4b8c4",
              border: "1px solid rgba(164,184,196,0.4)",
            }}>
              4-Layer Breakdown
            </span>
          </div>
          <div
            className="prose-custom"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(breakdown) }}
          />
        </div>
      )}
    </div>
  );
}
