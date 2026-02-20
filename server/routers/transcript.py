"""
字幕提取路由
"""

import re
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from server.services.transcript_fetch import extract_video_id, fetch_transcript, merge_segments, NoCaptionsError
from server.services.word_highlighter import highlight_segments
from server.services.ai_pipeline import generate_toc, generate_context_notes, generate_highlights
from server.services.cache_store import get_cache, set_cache

router = APIRouter()


class TocRequest(BaseModel):
    segments: list[dict]  # [{text, start, duration}]
    video_id: str | None = None


@router.get("/api/transcript")
async def get_transcript(
    url: str = Query(..., description="YouTube 视频 URL"),
    highlight: bool = Query(True, description="是否添加词汇高亮"),
):
    try:
        video_id = extract_video_id(url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        segments = fetch_transcript(video_id)
        segments = merge_segments(segments)
    except NoCaptionsError:
        raise HTTPException(status_code=404, detail={"code": "NO_CAPTIONS", "message": "This video has no captions available. Please try a video with subtitles."})
    except RuntimeError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if highlight:
        segments = highlight_segments(segments)

    return {
        "video_id": video_id,
        "segments": segments,
        "total_segments": len(segments),
    }


def _format_timestamp(seconds: float) -> str:
    m = int(seconds) // 60
    s = int(seconds) % 60
    return f"{m}:{s:02d}"


@router.post("/api/generate-toc")
async def gen_toc(request: TocRequest):
    """用 AI 生成视频章节目录"""
    segments = request.segments

    if not segments:
        raise HTTPException(status_code=400, detail="No segments provided")

    # 检查缓存
    if request.video_id:
        cached = get_cache(request.video_id, "chapters")
        if cached:
            chapters = cached
            # 仍需计算 segmentRange（依赖当前 segments）
            for idx, ch in enumerate(chapters):
                ch_start = ch["start_time"]
                ch_end = chapters[idx + 1]["start_time"] if idx + 1 < len(chapters) else float("inf")
                start_idx = None
                end_idx = None
                for si, seg in enumerate(segments):
                    seg_start = seg.get("start", 0)
                    if seg_start >= ch_start and start_idx is None:
                        start_idx = si
                    if seg_start < ch_end:
                        end_idx = si
                ch["segmentRange"] = [start_idx or 0, end_idx or len(segments) - 1]
            return {"chapters": chapters}

    # 构建带时间戳的文本给 AI
    lines = []
    for seg in segments:
        ts = _format_timestamp(seg.get("start", 0))
        lines.append(f"[{ts}] {seg.get('text', '')}")
    transcript_with_ts = "\n".join(lines)

    try:
        chapters = generate_toc(transcript_with_ts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ToC generation failed: {str(e)[:300]}")

    # 修正 AI 生成的时间戳：裁剪到视频范围 + snap 到最近 segment
    seg_starts = [seg.get("start", 0) for seg in segments]
    total_duration = max(s + seg.get("duration", 0) for s, seg in zip(seg_starts, segments)) if segments else 0

    for ch in chapters:
        t = ch.get("start_time", 0)
        t = max(0, min(t, total_duration))
        t = min(seg_starts, key=lambda s: abs(s - t))
        ch["start_time"] = t

    # 去重：如果多个 chapter snap 到同一个 segment，后续的推到下一个
    used_starts: set[float] = set()
    for ch in chapters:
        t = ch["start_time"]
        if t in used_starts:
            candidates = [s for s in seg_starts if s > t and s not in used_starts]
            if candidates:
                t = candidates[0]
        used_starts.add(t)
        ch["start_time"] = t

    # 存入缓存（存修正后的 chapters，不含 segmentRange）
    if request.video_id:
        set_cache(request.video_id, "chapters", chapters)

    # 根据时间戳计算每个章节对应的 segment 索引范围
    for idx, ch in enumerate(chapters):
        ch_start = ch["start_time"]
        # 下一个章节的起始时间，作为当前章节的结束
        if idx + 1 < len(chapters):
            ch_end = chapters[idx + 1]["start_time"]
        else:
            ch_end = float("inf")

        start_idx = None
        end_idx = None
        for si, seg in enumerate(segments):
            seg_start = seg.get("start", 0)
            if seg_start >= ch_start and start_idx is None:
                start_idx = si
            if seg_start < ch_end:
                end_idx = si

        ch["segmentRange"] = [start_idx or 0, end_idx or len(segments) - 1]

    return {"chapters": chapters}


class ContextNotesRequest(BaseModel):
    segments: list[dict]  # [{text, start, duration}]
    video_id: str | None = None


CONTEXT_NOTES_CHUNK_SIZE = 50


@router.post("/api/generate-context-notes")
async def gen_context_notes(request: ContextNotesRequest):
    """用 AI 生成上下文注释（分 chunk 处理避免 AI 输出截断）"""
    segments = request.segments

    if not segments:
        raise HTTPException(status_code=400, detail="No segments provided")

    # 检查缓存
    if request.video_id:
        cached = get_cache(request.video_id, "context_notes")
        if cached:
            return cached

    # 分 chunk 处理
    all_notes = []
    for i in range(0, len(segments), CONTEXT_NOTES_CHUNK_SIZE):
        chunk_segs = segments[i:i + CONTEXT_NOTES_CHUNK_SIZE]
        lines = [f"[{i + idx}] {seg.get('text', '')}" for idx, seg in enumerate(chunk_segs)]
        indexed_transcript = "\n".join(lines)

        try:
            chunk_notes = generate_context_notes(indexed_transcript)
            all_notes.extend(chunk_notes)
            print(f"Context notes chunk [{i}-{i+len(chunk_segs)}]: {len(chunk_notes)} notes")
        except Exception as e:
            print(f"Context notes chunk [{i}-{i+len(chunk_segs)}] failed: {str(e)[:100]}")
            continue

    # 过滤掉超出范围的 segment_index
    valid_notes = [n for n in all_notes if 0 <= n.get("segment_index", -1) < len(segments)]

    result = {"notes": valid_notes, "total": len(valid_notes)}

    # 存入缓存
    if request.video_id:
        set_cache(request.video_id, "context_notes", result)

    return result


class HighlightsRequest(BaseModel):
    segments: list[dict]  # [{text, start, duration}]
    video_id: str | None = None
    chapters: list[dict] | None = None  # [{title, start_time, segmentRange: [start, end]}]


REGISTER_COLORS = {
    "general_spoken": "green",
    "professional_spoken": "blue",
    "regional_cultural": "yellow",
    "formal_written": "gray",
}

# Legacy fallback for CEFR-based coloring
LEVEL_COLORS = {
    "A2": "green",
    "B1": "green",
    "B2": "blue",
    "C1": "purple",
}


def _normalize_text(s: str) -> str:
    """Normalize whitespace and smart quotes for fuzzy matching."""
    return re.sub(r'\s+', ' ', s).replace('\u2019', "'").replace('\u2018', "'").replace('\u201c', '"').replace('\u201d', '"')


def _find_phrase_in_segment(phrase: str, seg_text: str):
    """多层 fallback 在 segment 文本中定位 phrase，始终返回原始文本上的 match 或 None"""
    # 1. 精确匹配（大小写不敏感）
    match = re.search(re.escape(phrase), seg_text, re.IGNORECASE)
    if match:
        return match

    # 2. Normalize 后匹配，再回原始文本定位
    norm_phrase = _normalize_text(phrase)
    norm_seg = _normalize_text(seg_text)
    norm_match = re.search(re.escape(norm_phrase), norm_seg, re.IGNORECASE)
    if norm_match:
        # 用匹配到的文本回原始文本搜索（避免索引错位）
        matched_text = norm_match.group()
        match = re.search(re.escape(matched_text), seg_text, re.IGNORECASE)
        if match:
            return match
        # 用原始 phrase 再试一次
        match = re.search(re.escape(phrase), seg_text, re.IGNORECASE)
        if match:
            return match

    # 3. 去掉首/尾词后重试（AI 有时多截一个词）
    words = phrase.split()
    if len(words) >= 3:
        # 去尾词
        shorter = ' '.join(words[:-1])
        match = re.search(re.escape(shorter), seg_text, re.IGNORECASE)
        if match:
            return match
        # 去首词
        shorter = ' '.join(words[1:])
        match = re.search(re.escape(shorter), seg_text, re.IGNORECASE)
        if match:
            return match

    # 4. 去掉首尾各一个词（AI 两端都多截）
    if len(words) >= 4:
        shorter = ' '.join(words[1:-1])
        match = re.search(re.escape(shorter), seg_text, re.IGNORECASE)
        if match:
            return match

    return None


def _postprocess_highlights(raw_highlights: list[dict], segments: list[dict]) -> dict[int, list[dict]]:
    """将 AI 原始高亮映射到 segment 字符位置，去除重叠。返回 {seg_idx: [highlight_obj, ...]}"""
    highlights_by_seg: dict[int, list[dict]] = {}
    for h in raw_highlights:
        seg_idx = h.get("segment_index", -1)
        if seg_idx < 0 or seg_idx >= len(segments):
            continue

        seg_text = segments[seg_idx].get("text", "")
        phrase = h.get("phrase", "")
        if not phrase:
            continue

        match = _find_phrase_in_segment(phrase, seg_text)
        if not match:
            print(f"WARN: Phrase '{phrase}' not found in segment {seg_idx}: '{seg_text[:80]}...'")
            continue

        level = h.get("level", "B2")
        register = h.get("register", h.get("category", "general_spoken"))
        highlight = {
            "phrase": seg_text[match.start():match.end()],
            "start": match.start(),
            "end": match.end(),
            "translation": h.get("translation", ""),
            "level": level,
            "frequency": h.get("frequency", "medium"),
            "register": register,
            "color": REGISTER_COLORS.get(register, "blue"),
            "alternative": h.get("alternative"),
        }

        if seg_idx not in highlights_by_seg:
            highlights_by_seg[seg_idx] = []
        highlights_by_seg[seg_idx].append(highlight)

    # 对每个 segment 的高亮按位置排序，去重叠
    for seg_idx, hl_list in highlights_by_seg.items():
        hl_list.sort(key=lambda x: x["start"])
        filtered = []
        used_ranges: list[tuple[int, int]] = []
        for hl in hl_list:
            overlap = any(hl["start"] < ur_end and hl["end"] > ur_start for ur_start, ur_end in used_ranges)
            if not overlap:
                used_ranges.append((hl["start"], hl["end"]))
                filtered.append(hl)
        highlights_by_seg[seg_idx] = filtered

    return highlights_by_seg


@router.post("/api/generate-highlights")
async def gen_highlights(request: HighlightsRequest):
    """用 AI 生成词汇高亮（旧端点，一次性返回）"""
    segments = request.segments

    if not segments:
        raise HTTPException(status_code=400, detail="No segments provided")

    # 检查缓存
    if request.video_id:
        cached = get_cache(request.video_id, "highlights")
        if cached:
            return cached

    CHUNK_SIZE = 50

    if len(segments) > CHUNK_SIZE:
        all_highlights = []
        failed_chunks: list[str] = []

        for i in range(0, len(segments), CHUNK_SIZE):
            chunk = segments[i:i+CHUNK_SIZE]
            chunk_indexed = "\n".join([f"[{i+idx}] {s.get('text', '')}" for idx, s in enumerate(chunk)])
            chunk_end = min(i + CHUNK_SIZE, len(segments))
            chunk_label = f"[{i}-{chunk_end}]"

            for attempt in range(3):
                try:
                    chunk_highlights = generate_highlights(chunk_indexed)
                    all_highlights.extend(chunk_highlights)
                    print(f"Chunk {chunk_label}: {len(chunk_highlights)} highlights")
                    break
                except Exception as e:
                    if attempt < 2:
                        print(f"Chunk {chunk_label} attempt {attempt+1} failed, retrying: {str(e)[:100]}")
                    else:
                        print(f"ERROR: Chunk {chunk_label} failed after 3 attempts: {str(e)[:100]}")
                        failed_chunks.append(chunk_label)

        if failed_chunks:
            print(f"WARNING: {len(failed_chunks)} chunks failed: {', '.join(failed_chunks)}")
        raw_highlights = all_highlights
    else:
        indexed_transcript = "\n".join([f"[{idx}] {seg.get('text', '')}" for idx, seg in enumerate(segments)])
        try:
            raw_highlights = generate_highlights(indexed_transcript)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Highlights generation failed: {str(e)[:300]}")

    highlights_by_seg = _postprocess_highlights(raw_highlights, segments)
    result = {"highlights": highlights_by_seg, "total": sum(len(v) for v in highlights_by_seg.values())}

    # 诊断日志
    input_count = len(raw_highlights)
    output_count = result["total"]
    dropped = input_count - output_count
    print(f"Highlights pipeline: {input_count} raw → {output_count} matched ({dropped} dropped, {dropped/input_count*100:.0f}% loss)" if input_count > 0 else "Highlights pipeline: 0 raw highlights")

    has_failed_chunks = len(segments) > CHUNK_SIZE and len(failed_chunks) > 0
    if request.video_id and not has_failed_chunks:
        set_cache(request.video_id, "highlights", result)
    elif has_failed_chunks:
        print(f"WARNING: Not caching highlights — incomplete results due to failed chunks")

    return result


# --- Streaming highlights endpoint (parallel + SSE) ---

HIGHLIGHT_FALLBACK_CHUNK_SIZE = 50
HIGHLIGHT_MAX_CHUNK_SEGMENTS = 20  # 超过此数量的 chapter 会被拆分为 sub-chunks
HIGHLIGHT_CONCURRENCY = 4
_highlight_executor = ThreadPoolExecutor(max_workers=HIGHLIGHT_CONCURRENCY)


@router.post("/api/generate-highlights-stream")
async def gen_highlights_stream(request: HighlightsRequest):
    """用 AI 生成词汇高亮 — SSE 流式，按 chapter 或固定大小分 chunk 并行处理"""
    segments = request.segments

    if not segments:
        raise HTTPException(status_code=400, detail="No segments provided")

    # 快速路径：全量缓存命中
    if request.video_id:
        cached = get_cache(request.video_id, "highlights")
        if cached:
            async def cached_stream():
                yield {"event": "chunk_result", "data": json.dumps(cached, ensure_ascii=False)}
                yield {"event": "done", "data": json.dumps({"total": cached.get("total", 0), "failed_chunks": [], "cached": True})}
            return EventSourceResponse(cached_stream())

    async def event_generator():
        loop = asyncio.get_event_loop()

        # 构建 chunk 列表：按 chapter 或固定大小
        # chunk_specs: [(start_idx, chunk_segs, title), ...]
        chunk_specs: list[tuple[int, list[dict], str]] = []

        if request.chapters and len(request.chapters) > 0:
            for ch in request.chapters:
                seg_range = ch.get("segmentRange", [0, len(segments) - 1])
                start_idx = seg_range[0]
                end_idx = seg_range[1]
                chunk_segs = segments[start_idx:end_idx + 1]
                title = ch.get("title", "")

                if len(chunk_segs) > HIGHLIGHT_MAX_CHUNK_SEGMENTS:
                    # 长 chapter 拆分为 sub-chunks
                    for sub_i in range(0, len(chunk_segs), HIGHLIGHT_MAX_CHUNK_SEGMENTS):
                        sub_segs = chunk_segs[sub_i:sub_i + HIGHLIGHT_MAX_CHUNK_SEGMENTS]
                        sub_start = start_idx + sub_i
                        part_num = sub_i // HIGHLIGHT_MAX_CHUNK_SEGMENTS + 1
                        total_parts = (len(chunk_segs) + HIGHLIGHT_MAX_CHUNK_SEGMENTS - 1) // HIGHLIGHT_MAX_CHUNK_SEGMENTS
                        sub_title = f"{title} ({part_num}/{total_parts})" if title else ""
                        chunk_specs.append((sub_start, sub_segs, sub_title))
                else:
                    chunk_specs.append((start_idx, chunk_segs, title))
        else:
            CHUNK_SIZE = HIGHLIGHT_FALLBACK_CHUNK_SIZE
            for i in range(0, len(segments), CHUNK_SIZE):
                chunk_segs = segments[i:i + CHUNK_SIZE]
                chunk_specs.append((i, chunk_segs, ""))

        total_chunks = len(chunk_specs)

        # 检查 per-chunk 缓存
        cached_results: dict[int, dict] = {}
        uncached_specs: list[tuple[int, list[dict], str]] = []
        for (start_idx, chunk_segs, title) in chunk_specs:
            if request.video_id:
                chunk_key = f"highlights_ch_{start_idx}_{len(chunk_segs)}"
                chunk_cached = get_cache(request.video_id, chunk_key)
                if chunk_cached is not None:
                    cached_results[start_idx] = chunk_cached
                    continue
            uncached_specs.append((start_idx, chunk_segs, title))

        # 推送缓存的 chunk
        for start_idx in sorted(cached_results.keys()):
            yield {"event": "chunk_result", "data": json.dumps(cached_results[start_idx], ensure_ascii=False)}

        if uncached_specs:
            yield {"event": "progress", "data": json.dumps({
                "cached_chunks": len(cached_results),
                "remaining_chunks": len(uncached_specs),
                "total_chunks": total_chunks,
                "chapter_titles": [t for _, _, t in uncached_specs if t],
            })}

        # 并行处理未缓存的 chunk
        failed_chunks: list[str] = []
        all_chunk_results: list[dict] = list(cached_results.values())

        sem = asyncio.Semaphore(HIGHLIGHT_CONCURRENCY)

        async def process_one_chunk(start_idx: int, chunk_segs: list[dict], title: str):
            chunk_end = start_idx + len(chunk_segs)
            chunk_label = f"'{title}'" if title else f"[{start_idx}-{chunk_end}]"
            chunk_indexed = "\n".join(
                f"[{start_idx+idx}] {s.get('text', '')}"
                for idx, s in enumerate(chunk_segs)
            )

            async with sem:
                for attempt in range(3):
                    try:
                        raw = await loop.run_in_executor(
                            _highlight_executor,
                            generate_highlights,
                            chunk_indexed,
                        )
                        highlights_by_seg = _postprocess_highlights(raw, segments)
                        count = sum(len(v) for v in highlights_by_seg.values())
                        print(f"Chapter {chunk_label}: {len(raw)} raw → {count} matched")

                        chunk_result = {
                            "highlights": highlights_by_seg,
                            "count": count,
                            "chapter_title": title,
                        }

                        # 缓存该 chunk
                        if request.video_id:
                            chunk_key = f"highlights_ch_{start_idx}_{len(chunk_segs)}"
                            set_cache(request.video_id, chunk_key, chunk_result)

                        return chunk_result
                    except Exception as e:
                        if attempt < 2:
                            print(f"Chapter {chunk_label} attempt {attempt+1} failed, retrying: {str(e)[:100]}")
                        else:
                            print(f"ERROR: Chapter {chunk_label} failed after 3 attempts: {str(e)[:100]}")
                            failed_chunks.append(title or f"[{start_idx}-{chunk_end}]")
                            return None

        # 创建所有任务，按完成顺序推送
        tasks = [
            asyncio.create_task(process_one_chunk(si, cs, t))
            for si, cs, t in uncached_specs
        ]

        for coro in asyncio.as_completed(tasks):
            result = await coro
            if result:
                all_chunk_results.append(result)
                yield {"event": "chunk_result", "data": json.dumps(result, ensure_ascii=False)}

        # 计算总数
        total_count = sum(r.get("count", r.get("total", 0)) for r in all_chunk_results)

        # 合并所有 chunk 的结果，缓存全量（仅当无失败）
        if request.video_id and not failed_chunks:
            merged: dict[str, list] = {}
            for r in all_chunk_results:
                for seg_idx_str, hl_list in r.get("highlights", {}).items():
                    merged.setdefault(str(seg_idx_str), []).extend(hl_list)
            full_result = {"highlights": merged, "total": total_count}
            set_cache(request.video_id, "highlights", full_result)

        yield {"event": "done", "data": json.dumps({
            "total": total_count,
            "failed_chunks": failed_chunks,
            "cached": False,
        })}

    return EventSourceResponse(event_generator())
