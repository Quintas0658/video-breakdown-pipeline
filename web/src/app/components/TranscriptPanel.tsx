"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { TranscriptSegment, Chapter, ContextNote } from "@/lib/types";
import WordTooltip from "./WordTooltip";
import { ContextNoteIcon, ContextNoteExpanded } from "./ContextNoteCard";

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  chapters: Chapter[];
  contextNotes: ContextNote[];
  currentTime: number;
  onSeek: (time: number) => void;
  isGeneratingToc: boolean;
  isGeneratingNotes: boolean;
  isGeneratingHighlights?: boolean;
  highlightsResult?: { count: number; seconds: number } | null;
  highlightsProgress?: string;
  onSaveExpression?: (data: Record<string, unknown>) => Promise<void>;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function renderHighlightedText(
  segment: TranscriptSegment,
  onSave?: (data: Record<string, unknown>) => Promise<void>,
) {
  const { text, highlights } = segment;
  if (!highlights || highlights.length === 0) {
    return <span>{text}</span>;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const h of highlights) {
    if (h.start > lastIndex) {
      parts.push(
        <span key={`t-${lastIndex}`}>{text.slice(lastIndex, h.start)}</span>
      );
    }
    parts.push(
      <WordTooltip
        key={`h-${h.start}`}
        phrase={text.slice(h.start, h.end)}
        translation={h.translation}
        level={h.level}
        color={h.color}
        register={h.register}
        frequency={h.frequency}
        alternative={h.alternative}
        onSave={onSave}
        contextSentence={text}
      />
    );
    lastIndex = h.end;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

function SegmentRow({
  seg,
  segIndex,
  isActive,
  activeRef,
  onSeek,
  notes,
  expandedNoteIdx,
  onToggleNote,
  onSaveExpression,
}: {
  seg: TranscriptSegment;
  segIndex: number;
  isActive: boolean;
  activeRef: React.RefObject<HTMLDivElement | null>;
  onSeek: (time: number) => void;
  notes: ContextNote[];
  expandedNoteIdx: number | null;
  onToggleNote: (idx: number) => void;
  onSaveExpression?: (data: Record<string, unknown>) => Promise<void>;
}) {
  const hasNotes = notes.length > 0;
  const isNoteExpanded = expandedNoteIdx === segIndex;

  return (
    <>
      <div
        ref={isActive ? activeRef : null}
        onClick={() => onSeek(seg.start)}
        style={{
          display: "flex",
          gap: "10px",
          padding: "6px 12px",
          borderRadius: "6px",
          cursor: "pointer",
          marginBottom: isNoteExpanded ? "0px" : "4px",
          transition: "background 0.15s",
          background: isActive ? "rgba(217,168,143,0.08)" : "transparent",
          borderLeft: isActive ? "2px solid #d9a88f" : "2px solid transparent",
        }}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(217,168,143,0.04)";
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <span style={{ fontSize: "10px", color: "#bfb5a8", fontFamily: "var(--font-geist-mono, monospace)", marginTop: "3px", flexShrink: 0, width: "36px" }}>
          {formatTime(seg.start)}
        </span>
        <span
          style={{
            fontSize: "13px",
            lineHeight: "1.6",
            color: isActive ? "#3a3229" : "#6b6259",
            fontWeight: isActive ? 500 : 400,
            transition: "color 0.15s",
            flex: 1,
          }}
        >
          {renderHighlightedText(seg, onSaveExpression)}
        </span>
        {hasNotes && (
          <ContextNoteIcon
            notes={notes}
            onToggle={() => onToggleNote(segIndex)}
            isExpanded={isNoteExpanded}
          />
        )}
      </div>
      {isNoteExpanded && <ContextNoteExpanded notes={notes} />}
    </>
  );
}

function ChapterSection({
  chapter,
  segments,
  currentTime,
  isExpanded,
  isCurrentChapter,
  onToggle,
  onSeek,
  activeRef,
  notesBySegment,
  expandedNoteIdx,
  onToggleNote,
  onSaveExpression,
}: {
  chapter: Chapter;
  segments: TranscriptSegment[];
  currentTime: number;
  isExpanded: boolean;
  isCurrentChapter: boolean;
  onToggle: () => void;
  onSeek: (time: number) => void;
  activeRef: React.RefObject<HTMLDivElement | null>;
  notesBySegment: Map<number, ContextNote[]>;
  expandedNoteIdx: number | null;
  onToggleNote: (idx: number) => void;
  onSaveExpression?: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [startIdx, endIdx] = chapter.segmentRange;
  const chapterSegments = segments.slice(startIdx, endIdx + 1);

  // Count notes in this chapter
  let noteCount = 0;
  for (let i = startIdx; i <= endIdx; i++) {
    noteCount += (notesBySegment.get(i) || []).length;
  }

  return (
    <div style={{ marginBottom: "4px" }}>
      {/* Chapter header */}
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          padding: "10px 14px",
          borderRadius: "8px",
          cursor: "pointer",
          background: isCurrentChapter ? "rgba(217,168,143,0.06)" : "transparent",
          borderLeft: isCurrentChapter ? "3px solid #d9a88f" : "3px solid transparent",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(217,168,143,0.06)";
        }}
        onMouseLeave={(e) => {
          if (!isCurrentChapter) (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <span style={{ fontSize: "12px", color: "#bfb5a8", marginTop: "2px", flexShrink: 0, transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>
          ▶
        </span>
        <span
          onClick={(e) => { e.stopPropagation(); onSeek(chapter.start_time); }}
          style={{ fontSize: "11px", color: "#d9a88f", fontFamily: "var(--font-geist-mono, monospace)", marginTop: "2px", flexShrink: 0, width: "36px" }}
        >
          {formatTime(chapter.start_time)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#3a3229", lineHeight: "1.4" }}>
            {chapter.title}
            {noteCount > 0 && (
              <span style={{ fontSize: "10px", color: "#a09585", fontWeight: 400, marginLeft: "8px" }}>
                💡{noteCount}
              </span>
            )}
          </div>
          {chapter.summary && (
            <div style={{ fontSize: "11px", color: "#a09585", marginTop: "2px", lineHeight: "1.4" }}>
              {chapter.summary}
            </div>
          )}
        </div>
      </div>

      {/* Expanded segments */}
      {isExpanded && (
        <div style={{ paddingLeft: "16px", marginTop: "4px", borderLeft: "1px solid rgba(217,168,143,0.15)", marginLeft: "22px" }}>
          {chapterSegments.map((seg, i) => {
            const globalIdx = startIdx + i;
            const isActive = currentTime >= seg.start && currentTime < seg.start + seg.duration;
            return (
              <SegmentRow
                key={globalIdx}
                seg={seg}
                segIndex={globalIdx}
                isActive={isActive}
                activeRef={activeRef}
                onSeek={onSeek}
                notes={notesBySegment.get(globalIdx) || []}
                expandedNoteIdx={expandedNoteIdx}
                onToggleNote={onToggleNote}
                onSaveExpression={onSaveExpression}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TranscriptPanel({
  segments,
  chapters,
  contextNotes,
  currentTime,
  onSeek,
  isGeneratingToc,
  isGeneratingNotes,
  isGeneratingHighlights,
  highlightsResult,
  highlightsProgress,
  onSaveExpression,
}: TranscriptPanelProps) {
  const activeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [showFullText, setShowFullText] = useState(false);
  const [expandedNoteIdx, setExpandedNoteIdx] = useState<number | null>(null);

  const hasChapters = chapters.length > 0;

  // Live elapsed timer for highlights generation
  const [hlElapsed, setHlElapsed] = useState(0);
  useEffect(() => {
    if (!isGeneratingHighlights) { setHlElapsed(0); return; }
    const t0 = Date.now();
    const interval = setInterval(() => setHlElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [isGeneratingHighlights]);

  // Build a map: segmentIndex → ContextNote[]
  const notesBySegment = useMemo(() => {
    const map = new Map<number, ContextNote[]>();
    for (const note of contextNotes) {
      const existing = map.get(note.segment_index) || [];
      existing.push(note);
      map.set(note.segment_index, existing);
    }
    return map;
  }, [contextNotes]);

  const toggleNote = (idx: number) => {
    setExpandedNoteIdx((prev) => (prev === idx ? null : idx));
  };

  // Find current chapter based on playback time
  const currentChapterIdx = hasChapters
    ? chapters.findIndex((ch, idx) => {
        const nextStart = idx + 1 < chapters.length ? chapters[idx + 1].start_time : Infinity;
        return currentTime >= ch.start_time && currentTime < nextStart;
      })
    : -1;

  // Auto-expand current chapter during playback
  useEffect(() => {
    if (currentChapterIdx >= 0 && !showFullText) {
      setExpandedChapters((prev) => {
        if (prev.has(currentChapterIdx)) return prev;
        const next = new Set(prev);
        next.add(currentChapterIdx);
        return next;
      });
    }
  }, [currentChapterIdx, showFullText]);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeRef.current && !userScrolledRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentTime]);

  // Detect user scroll to pause auto-scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      userScrolledRef.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = window.setTimeout(() => {
        userScrolledRef.current = false;
      }, 3000);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleChapter = (idx: number) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  if (segments.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#8b7e70", fontSize: "13px" }}>
        Load a video to see the transcript
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto" style={{ padding: "8px 12px", background: "#fdfcfb" }}>
      {/* Status bar */}
      {(hasChapters || isGeneratingToc || isGeneratingNotes || isGeneratingHighlights || highlightsResult) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", marginBottom: "8px" }}>
          <div style={{ display: "flex", gap: "12px", fontSize: "11px", color: "#a09585", flexWrap: "wrap" }}>
            {isGeneratingToc && !hasChapters ? (
              <span>Generating chapters...</span>
            ) : hasChapters ? (
              <span>{chapters.length} chapters</span>
            ) : null}
            {isGeneratingNotes && contextNotes.length === 0 ? (
              <span>Generating context notes...</span>
            ) : contextNotes.length > 0 ? (
              <span>💡 {contextNotes.length} notes</span>
            ) : null}
            {isGeneratingHighlights ? (
              <span>{highlightsProgress || "Analyzing expressions..."} ({hlElapsed}s)</span>
            ) : highlightsResult ? (
              <span style={{ color: "#7a9e7a" }}>✓ {highlightsResult.count} expressions ({highlightsResult.seconds}s)</span>
            ) : null}
          </div>
          {hasChapters && (
            <button
              onClick={() => setShowFullText(!showFullText)}
              style={{
                fontSize: "11px",
                color: "#d9a88f",
                background: "none",
                border: "1px solid rgba(217,168,143,0.3)",
                borderRadius: "4px",
                padding: "2px 8px",
                cursor: "pointer",
              }}
            >
              {showFullText ? "Chapters" : "Full text"}
            </button>
          )}
        </div>
      )}

      {/* Chapter mode */}
      {hasChapters && !showFullText ? (
        chapters.map((ch, idx) => (
          <ChapterSection
            key={idx}
            chapter={ch}
            segments={segments}
            currentTime={currentTime}
            isExpanded={expandedChapters.has(idx)}
            isCurrentChapter={currentChapterIdx === idx}
            onToggle={() => toggleChapter(idx)}
            onSeek={onSeek}
            activeRef={activeRef}
            notesBySegment={notesBySegment}
            expandedNoteIdx={expandedNoteIdx}
            onToggleNote={toggleNote}
            onSaveExpression={onSaveExpression}
          />
        ))
      ) : (
        /* Full text mode */
        segments.map((seg, i) => {
          const isActive = currentTime >= seg.start && currentTime < seg.start + seg.duration;
          return (
            <SegmentRow
              key={i}
              seg={seg}
              segIndex={i}
              isActive={isActive}
              activeRef={activeRef}
              onSeek={onSeek}
              notes={notesBySegment.get(i) || []}
              expandedNoteIdx={expandedNoteIdx}
              onToggleNote={toggleNote}
              onSaveExpression={onSaveExpression}
            />
          );
        })
      )}
    </div>
  );
}
