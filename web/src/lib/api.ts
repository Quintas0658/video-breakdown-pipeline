const API_BASE = "http://localhost:8000";

export async function fetchTranscript(url: string) {
  const res = await fetch(
    `${API_BASE}/api/transcript?url=${encodeURIComponent(url)}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to fetch transcript");
  }
  return res.json();
}

export async function fetchPersonas() {
  const res = await fetch(`${API_BASE}/api/personas`);
  if (!res.ok) throw new Error("Failed to fetch personas");
  return res.json();
}

export function startAnalysis(
  transcript: string,
  persona: string,
  onEvent: (event: string, data: string) => void,
  onDone: () => void,
  onError: (error: string) => void
) {
  const controller = new AbortController();

  fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, persona }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Analysis failed" }));
        onError(err.detail);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventName = "";
        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const data = line.slice(5).trim();
            if (eventName && data) {
              onEvent(eventName, data);
            }
            if (eventName === "done") {
              onDone();
              return;
            }
          }
        }
      }
      onDone();
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        onError(err.message);
      }
    });

  return () => controller.abort();
}

export async function generateToc(
  segments: { text: string; start: number; duration: number }[],
  videoId?: string
) {
  const res = await fetch(`${API_BASE}/api/generate-toc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segments, video_id: videoId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "ToC generation failed" }));
    throw new Error(err.detail || "Failed to generate table of contents");
  }
  return res.json();
}

export async function generateHighlights(
  segments: { text: string; start: number; duration: number }[],
  videoId?: string
) {
  const res = await fetch(`${API_BASE}/api/generate-highlights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segments, video_id: videoId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Highlights generation failed" }));
    throw new Error(err.detail || "Failed to generate highlights");
  }
  return res.json();
}

export async function generateContextNotes(
  segments: { text: string; start: number; duration: number }[],
  videoId?: string
) {
  const res = await fetch(`${API_BASE}/api/generate-context-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segments, video_id: videoId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Context notes generation failed" }));
    throw new Error(err.detail || "Failed to generate context notes");
  }
  return res.json();
}

// --------------- Streaming Highlights ---------------

import type { Chapter, Highlight } from "./types";

export function startHighlightsStream(
  segments: { text: string; start: number; duration: number }[],
  videoId: string | undefined,
  chapters: Chapter[] | undefined,
  onChunkResult: (highlights: Record<string, Highlight[]>, count: number, chapterTitle?: string) => void,
  onProgress: (info: { cached_chunks?: number; remaining_chunks?: number; total_chunks?: number; chapter_title?: string }) => void,
  onDone: (info: { total: number; failed_chunks: string[]; cached: boolean }) => void,
  onError: (error: string) => void
) {
  const controller = new AbortController();

  fetch(`${API_BASE}/api/generate-highlights-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segments, video_id: videoId, chapters }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Highlights streaming failed" }));
        onError(err.detail);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventName = "";
        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const data = line.slice(5).trim();
            if (!eventName || !data) continue;
            try {
              if (eventName === "chunk_result") {
                const parsed = JSON.parse(data);
                onChunkResult(parsed.highlights, parsed.count ?? parsed.total ?? 0, parsed.chapter_title);
              } else if (eventName === "progress") {
                onProgress(JSON.parse(data));
              } else if (eventName === "done") {
                onDone(JSON.parse(data));
                return;
              }
            } catch (e) {
              console.warn("Failed to parse SSE data:", e);
            }
            eventName = "";
          }
        }
      }
      // Stream ended without explicit done event
      onDone({ total: 0, failed_chunks: [], cached: false });
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        onError(err.message);
      }
    });

  return () => controller.abort();
}

// --------------- Deck API ---------------

export async function saveToDeck(expression: {
  phrase: string;
  register?: string;
  level?: string;
  frequency?: string;
  translation?: string;
  alternative?: string | null;
  context_sentence?: string;
  video_id?: string;
  segment_start?: number;
}) {
  const res = await fetch(`${API_BASE}/api/deck/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(expression),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Save failed" }));
    throw new Error(err.detail || "Failed to save expression");
  }
  return res.json();
}

export async function getSavedDeck() {
  const res = await fetch(`${API_BASE}/api/deck`);
  if (!res.ok) throw new Error("Failed to fetch deck");
  return res.json();
}

export async function deleteFromDeck(id: number) {
  const res = await fetch(`${API_BASE}/api/deck/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete expression");
  return res.json();
}
