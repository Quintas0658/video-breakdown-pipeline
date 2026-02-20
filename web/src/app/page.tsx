"use client";

import { useState, useCallback, useRef } from "react";
import YouTubePlayer, { seekTo } from "./components/YouTubePlayer";
import TranscriptPanel from "./components/TranscriptPanel";
import AnalysisPanel from "./components/AnalysisPanel";
import DeckPanel from "./components/DeckPanel";
import TabBar from "./components/TabBar";
import UrlInput from "./components/UrlInput";
import { fetchTranscript, startAnalysis, generateToc, generateContextNotes, startHighlightsStream, saveToDeck } from "@/lib/api";
import type { TranscriptSegment, Chapter, ContextNote, Highlight } from "@/lib/types";

function extractVideoId(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    return u.searchParams.get("v") || "";
  } catch {
    return "";
  }
}

const TABS = [
  { id: "transcript", label: "Subtitles" },
  { id: "analysis", label: "Deep Analysis" },
  { id: "deck", label: "My Deck" },
];

export default function Home() {
  const [videoId, setVideoId] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState("transcript");
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Chapters (ToC) state
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isGeneratingToc, setIsGeneratingToc] = useState(false);

  // Context Notes state
  const [contextNotes, setContextNotes] = useState<ContextNote[]>([]);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);

  // Highlights state
  const [isGeneratingHighlights, setIsGeneratingHighlights] = useState(false);
  const [highlightsResult, setHighlightsResult] = useState<{ count: number; seconds: number } | null>(null);
  const [highlightsProgress, setHighlightsProgress] = useState("");
  const hlCountRef = useRef(0);

  // Analysis state
  const [layer0, setLayer0] = useState("");
  const [breakdown, setBreakdown] = useState("");
  const [analysisProgress, setAnalysisProgress] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  const playerRef = useRef<YT.Player | null>(null);

  const handleLoad = useCallback(async (url: string, persona: string) => {
    const vid = extractVideoId(url);
    if (!vid) {
      setLoadError("Invalid YouTube URL");
      return;
    }

    setIsLoading(true);
    setLoadError("");
    setSegments([]);
    setChapters([]);
    setContextNotes([]);
    setLayer0("");
    setBreakdown("");
    setAnalysisError("");

    try {
      // Load video
      setVideoId(vid);

      // Fetch transcript
      const data = await fetchTranscript(url);
      setSegments(data.segments);

      // Helper: start highlights streaming (called after ToC completes)
      const launchHighlights = (chaptersData?: Chapter[]) => {
        setIsGeneratingHighlights(true);
        setHighlightsResult(null);
        setHighlightsProgress("");
        hlCountRef.current = 0;
        const hlStartTime = Date.now();
        let totalChunks = chaptersData?.length || 0;
        let completedChunks = 0;

        startHighlightsStream(
          data.segments,
          vid,
          chaptersData,
          // onChunkResult — merge highlights incrementally
          (chunkHighlights, count, chapterTitle) => {
            hlCountRef.current += count;
            completedChunks++;
            if (totalChunks > 0) {
              setHighlightsProgress(
                chapterTitle
                  ? `Done: ${chapterTitle} (${completedChunks}/${totalChunks})`
                  : `${completedChunks}/${totalChunks} chunks done`
              );
            }
            setSegments((prev) => {
              const updated = [...prev];
              for (const [segIdxStr, aiHighlights] of Object.entries(chunkHighlights)) {
                const idx = Number(segIdxStr);
                if (idx < 0 || idx >= updated.length || !aiHighlights.length) continue;
                const seg = updated[idx];
                const existing = seg.highlights || [];
                const existingRanges = existing.map((h) => [h.start, h.end] as [number, number]);
                const newHighlights = [...existing];
                for (const ah of aiHighlights) {
                  const overlaps = existingRanges.some(([s, e]) => ah.start < e && ah.end > s);
                  if (!overlaps) {
                    newHighlights.push(ah);
                    existingRanges.push([ah.start, ah.end]);
                  }
                }
                newHighlights.sort((a, b) => a.start - b.start);
                updated[idx] = { ...seg, highlights: newHighlights };
              }
              return updated;
            });
          },
          // onProgress
          (info) => {
            if (info.remaining_chunks !== undefined) {
              totalChunks = info.total_chunks || totalChunks;
              setHighlightsProgress(
                info.cached_chunks
                  ? `${info.cached_chunks} cached, analyzing ${info.remaining_chunks} chapters...`
                  : `Analyzing ${info.remaining_chunks} chapters...`
              );
            }
          },
          // onDone
          () => {
            const elapsed = Math.round((Date.now() - hlStartTime) / 1000);
            setHighlightsResult({ count: hlCountRef.current, seconds: elapsed });
            setIsGeneratingHighlights(false);
            setHighlightsProgress("");
          },
          // onError
          (err) => {
            console.warn("AI highlights streaming failed:", err);
            setIsGeneratingHighlights(false);
            setHighlightsProgress("");
          },
        );
      };

      // Generate ToC in background, then start highlights with chapter data
      setIsGeneratingToc(true);
      generateToc(data.segments, vid)
        .then((tocData) => {
          setChapters(tocData.chapters);
          // Start highlights with chapter-based chunking
          launchHighlights(tocData.chapters);
        })
        .catch((err) => {
          console.error("ToC generation failed:", err);
          // Fallback: start highlights without chapters (fixed-size chunking)
          launchHighlights();
        })
        .finally(() => {
          setIsGeneratingToc(false);
        });

      // Generate Context Notes in background (parallel with ToC)
      setIsGeneratingNotes(true);
      generateContextNotes(data.segments, vid)
        .then((notesData) => {
          setContextNotes(notesData.notes);
        })
        .catch((err) => {
          console.warn("Context notes generation failed:", err);
        })
        .finally(() => {
          setIsGeneratingNotes(false);
        });

      // Start analysis automatically
      setIsAnalyzing(true);
      setAnalysisProgress("Starting analysis...");
      setActiveTab("transcript"); // Show transcript first

      const transcriptText = data.segments
        .map((s: TranscriptSegment) => s.text)
        .join(" ");

      startAnalysis(
        transcriptText,
        persona,
        (event, eventData) => {
          if (event === "progress") {
            setAnalysisProgress(eventData);
          } else if (event === "layer0") {
            const parsed = JSON.parse(eventData);
            setLayer0(parsed.content);
          } else if (event === "breakdown") {
            const parsed = JSON.parse(eventData);
            setBreakdown(parsed.content);
          } else if (event === "error") {
            setAnalysisError(eventData);
          }
        },
        () => {
          setIsAnalyzing(false);
          setAnalysisProgress("");
        },
        (error) => {
          setIsAnalyzing(false);
          setAnalysisError(error);
        }
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load video");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSeek = useCallback((time: number) => {
    seekTo(playerRef.current, time);
  }, []);

  const handlePlayerReady = useCallback((player: YT.Player) => {
    playerRef.current = player;
  }, []);

  const handleSaveExpression = useCallback(async (data: Record<string, unknown>) => {
    await saveToDeck({ ...data, video_id: videoId } as Parameters<typeof saveToDeck>[0]);
  }, [videoId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f5f0ea", position: "relative", zIndex: 1 }}>
      {/* Top bar */}
      <UrlInput onLoad={handleLoad} isLoading={isLoading} />

      {loadError && (
        <div className="animate-fade-in" style={{ padding: "8px 24px", fontSize: "12px", color: "#d8a5a0", background: "rgba(216,165,160,0.08)", borderBottom: "1px solid rgba(216,165,160,0.2)" }}>
          {loadError}
        </div>
      )}

      {/* Main split layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: Video Player */}
        <div style={{ width: "50%", display: "flex", flexDirection: "column", background: "#2a2420" }}>
          {videoId ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
              <div style={{ width: "100%", maxWidth: "720px" }}>
                <YouTubePlayer
                  videoId={videoId}
                  onTimeUpdate={setCurrentTime}
                  onReady={handlePlayerReady}
                />
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.15, color: "#8b7e70" }}>▶</div>
                <p style={{ fontSize: "13px", color: "#8b7e70" }}>Paste a YouTube URL to start</p>
                <a
                  href="/playground"
                  style={{ display: "inline-block", marginTop: "16px", fontSize: "12px", color: "#8b7e70", textDecoration: "none", borderBottom: "1px solid #8b7e70", paddingBottom: "1px", transition: "color 0.15s, border-color 0.15s" }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#d9a88f"; (e.target as HTMLElement).style.borderColor = "#d9a88f"; }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#8b7e70"; (e.target as HTMLElement).style.borderColor = "#8b7e70"; }}
                >
                  View animation playground →
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Right: Tabs */}
        <div style={{ width: "50%", display: "flex", flexDirection: "column", borderLeft: "1px solid #e8dfd6" }}>
          <TabBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={TABS}
          />
          <div style={{ flex: 1, overflow: "hidden" }}>
            {activeTab === "transcript" ? (
              <TranscriptPanel
                segments={segments}
                chapters={chapters}
                contextNotes={contextNotes}
                currentTime={currentTime}
                onSeek={handleSeek}
                isGeneratingToc={isGeneratingToc}
                isGeneratingNotes={isGeneratingNotes}
                isGeneratingHighlights={isGeneratingHighlights}
                highlightsResult={highlightsResult}
                highlightsProgress={highlightsProgress}
                onSaveExpression={handleSaveExpression}
              />
            ) : activeTab === "analysis" ? (
              <AnalysisPanel
                layer0={layer0}
                breakdown={breakdown}
                progress={analysisProgress}
                isLoading={isAnalyzing}
                error={analysisError}
              />
            ) : (
              <DeckPanel />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
