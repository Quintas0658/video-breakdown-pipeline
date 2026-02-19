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
  segments: { text: string; start: number; duration: number }[]
) {
  const res = await fetch(`${API_BASE}/api/generate-toc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segments }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "ToC generation failed" }));
    throw new Error(err.detail || "Failed to generate table of contents");
  }
  return res.json();
}

export async function generateContextNotes(
  segments: { text: string; start: number; duration: number }[]
) {
  const res = await fetch(`${API_BASE}/api/generate-context-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segments }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Context notes generation failed" }));
    throw new Error(err.detail || "Failed to generate context notes");
  }
  return res.json();
}
