"""
字幕提取路由
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from server.services.transcript_fetch import extract_video_id, fetch_transcript, merge_segments
from server.services.word_highlighter import highlight_segments
from server.services.ai_pipeline import generate_toc, generate_context_notes

router = APIRouter()


class TocRequest(BaseModel):
    segments: list[dict]  # [{text, start, duration}]


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


@router.post("/api/generate-context-notes")
async def gen_context_notes(request: ContextNotesRequest):
    """用 AI 生成上下文注释"""
    segments = request.segments

    if not segments:
        raise HTTPException(status_code=400, detail="No segments provided")

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

    return {"notes": valid_notes, "total": len(valid_notes)}
