"""
字幕提取路由
"""

import re

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

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

    # 存入缓存（存原始 chapters，不含 segmentRange）
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


@router.post("/api/generate-context-notes")
async def gen_context_notes(request: ContextNotesRequest):
    """用 AI 生成上下文注释"""
    segments = request.segments

    if not segments:
        raise HTTPException(status_code=400, detail="No segments provided")

    # 检查缓存
    if request.video_id:
        cached = get_cache(request.video_id, "context_notes")
        if cached:
            return cached

    # 构建带序号的文本给 AI
    lines = []
    for idx, seg in enumerate(segments):
        lines.append(f"[{idx}] {seg.get('text', '')}")
    indexed_transcript = "\n".join(lines)

    try:
        notes = generate_context_notes(indexed_transcript)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Context notes generation failed: {str(e)[:300]}")

    # 过滤掉超出范围的 segment_index
    valid_notes = [n for n in notes if 0 <= n.get("segment_index", -1) < len(segments)]

    result = {"notes": valid_notes, "total": len(valid_notes)}

    # 存入缓存
    if request.video_id:
        set_cache(request.video_id, "context_notes", result)

    return result


class HighlightsRequest(BaseModel):
    segments: list[dict]  # [{text, start, duration}]
    video_id: str | None = None


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


@router.post("/api/generate-highlights")
async def gen_highlights(request: HighlightsRequest):
    """用 AI 生成词汇高亮"""
    segments = request.segments

    if not segments:
        raise HTTPException(status_code=400, detail="No segments provided")

    # 检查缓存
    if request.video_id:
        cached = get_cache(request.video_id, "highlights")
        if cached:
            return cached

    # 分块处理长视频，避免 JSON 解析错误
    CHUNK_SIZE = 50

    if len(segments) > CHUNK_SIZE:
        # 长视频：分块处理，使用全局 index 避免偏移错误
        all_highlights = []
        for i in range(0, len(segments), CHUNK_SIZE):
            chunk = segments[i:i+CHUNK_SIZE]
            # 使用全局 index：[50] text, [51] text... AI 直接返回全局 index
            chunk_indexed = "\n".join([f"[{i+idx}] {s.get('text', '')}" for idx, s in enumerate(chunk)])
            chunk_end = min(i + CHUNK_SIZE, len(segments))

            # 最多重试 1 次
            for attempt in range(2):
                try:
                    chunk_highlights = generate_highlights(chunk_indexed)
                    # AI 返回的 segment_index 已经是全局的，不需要偏移
                    all_highlights.extend(chunk_highlights)
                    print(f"Chunk [{i}-{chunk_end}]: {len(chunk_highlights)} highlights")
                    break
                except Exception as e:
                    if attempt == 0:
                        print(f"Chunk [{i}-{chunk_end}] attempt 1 failed, retrying: {str(e)[:100]}")
                    else:
                        print(f"Chunk [{i}-{chunk_end}] failed after retry: {str(e)[:100]}")
        raw_highlights = all_highlights
    else:
        # 短视频：直接处理
        indexed_transcript = "\n".join([f"[{idx}] {seg.get('text', '')}" for idx, seg in enumerate(segments)])
        try:
            raw_highlights = generate_highlights(indexed_transcript)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Highlights generation failed: {str(e)[:300]}")

    # 将 AI 返回的 phrase 映射到 segment 中的字符位置
    # 按 segment_index 分组
    highlights_by_seg: dict[int, list[dict]] = {}
    for h in raw_highlights:
        seg_idx = h.get("segment_index", -1)
        if seg_idx < 0 or seg_idx >= len(segments):
            continue

        seg_text = segments[seg_idx].get("text", "")
        phrase = h.get("phrase", "")
        if not phrase:
            continue

        # 在 segment 文本中查找 phrase（大小写不敏感）
        pattern = re.escape(phrase)
        match = re.search(pattern, seg_text, re.IGNORECASE)
        if not match:
            # Fuzzy fallback: normalize whitespace and smart quotes
            _normalize = lambda s: re.sub(r'\s+', ' ', s).replace('\u2019', "'").replace('\u2018', "'").replace('\u201c', '"').replace('\u201d', '"')
            match = re.search(re.escape(_normalize(phrase)), _normalize(seg_text), re.IGNORECASE)
            if not match:
                print(f"WARN: Phrase '{phrase}' not found in segment {seg_idx}: '{seg_text[:60]}...'")
                continue

        level = h.get("level", "B2")
        register = h.get("register", h.get("category", "general_spoken"))
        highlight = {
            "phrase": seg_text[match.start():match.end()],  # 保留原始大小写
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
        # 去除重叠
        filtered = []
        used_ranges: list[tuple[int, int]] = []
        for hl in hl_list:
            overlap = any(hl["start"] < ur_end and hl["end"] > ur_start for ur_start, ur_end in used_ranges)
            if not overlap:
                used_ranges.append((hl["start"], hl["end"]))
                filtered.append(hl)
        highlights_by_seg[seg_idx] = filtered

    result = {"highlights": highlights_by_seg, "total": sum(len(v) for v in highlights_by_seg.values())}

    # 诊断日志
    input_count = len(raw_highlights)
    output_count = result["total"]
    dropped = input_count - output_count
    print(f"Highlights pipeline: {input_count} raw → {output_count} matched ({dropped} dropped, {dropped/input_count*100:.0f}% loss)" if input_count > 0 else "Highlights pipeline: 0 raw highlights")

    # 存入缓存（highlights_by_seg 的 key 是 int，JSON 序列化会变成 str）
    if request.video_id:
        set_cache(request.video_id, "highlights", result)

    return result
