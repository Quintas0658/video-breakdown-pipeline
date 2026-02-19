"use client";

import { useEffect, useRef, useState } from "react";
import type { TranscriptSegment, Chapter } from "@/lib/types";
import WordTooltip from "./WordTooltip";

interface TranscriptPanelProps {
  segments: TranscriptSegment[];
  chapters: Chapter[];
  currentTime: number;
  onSeek: (time: number) => void;
  isGeneratingToc: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function renderHighlightedText(segment: TranscriptSegment) {
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
  isActive,
  activeRef,
  onSeek,
}: {
  seg: TranscriptSegment;
  isActive: boolean;
  activeRef: React.RefObject<HTMLDivElement | null>;
  onSeek: (time: number) => void;
}) {
  return (
    <div
      ref={isActive ? activeRef : null}
      onClick={() => onSeek(seg.start)}
      style={{
        display: "flex",
        gap: "10px",
        padding: "6px 12px",
        borderRadius: "6px",
        cursor: "pointer",
        marginBottom: "4px",
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
        }}
      >
        {renderHighlightedText(seg)}
      </span>
    </div>
  );
}

function ChapterSection({
  chapter,
  chapterIndex,
  segments,
  currentTime,
  isExpanded,
  isCurrentChapter,
  onToggle,
  onSeek,
  activeRef,
}: {
  chapter: Chapter;
  chapterIndex: number;
  segments: TranscriptSegment[];
  currentTime: number;
  isExpanded: boolean;
  isCurrentChapter: boolean;
  onToggle: () => void;
  onSeek: (time: number) => void;
  activeRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [startIdx, endIdx] = chapter.segmentRange;
  const chapterSegments = segments.slice(startIdx, endIdx + 1);

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
        {/* Expand/collapse arrow */}
        <span style={{ fontSize: "12px", color: "#bfb5a8", marginTop: "2px", flexShrink: 0, transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>
          ▶
        </span>
        {/* Timestamp */}
        <span
          onClick={(e) => { e.stopPropagation(); onSeek(chapter.start_time); }}
          style={{ fontSize: "11px", color: "#d9a88f", fontFamily: "var(--font-geist-mono, monospace)", marginTop: "2px", flexShrink: 0, width: "36px" }}
        >
          {formatTime(chapter.start_time)}
        </span>
        {/* Title and summary */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#3a3229", lineHeight: "1.4" }}>
            {chapter.title}
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
                isActive={isActive}
                activeRef={activeRef}
                onSeek={onSeek}
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
  currentTime,
  onSeek,
  isGeneratingToc,
}: TranscriptPanelProps) {
  const activeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [showFullText, setShowFullText] = useState(false);

  const hasChapters = chapters.length > 0;

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
      {/* Mode toggle + ToC loading indicator */}
      {(hasChapters || isGeneratingToc) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", marginBottom: "8px" }}>
          {isGeneratingToc && !hasChapters ? (
            <span style={{ fontSize: "11px", color: "#a09585" }}>
              Generating chapters...
            </span>
          ) : (
            <span style={{ fontSize: "11px", color: "#a09585" }}>
              {chapters.length} chapters
            </span>
          )}
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
            chapterIndex={idx}
            segments={segments}
            currentTime={currentTime}
            isExpanded={expandedChapters.has(idx)}
            isCurrentChapter={currentChapterIdx === idx}
            onToggle={() => toggleChapter(idx)}
            onSeek={onSeek}
            activeRef={activeRef}
          />
        ))
      ) : (
        /* Full text mode (original) */
        segments.map((seg, i) => {
          const isActive = currentTime >= seg.start && currentTime < seg.start + seg.duration;
          return (
            <SegmentRow
              key={i}
              seg={seg}
              isActive={isActive}
              activeRef={activeRef}
              onSeek={onSeek}
            />
          );
        })
      )}
    </div>
  );
}
