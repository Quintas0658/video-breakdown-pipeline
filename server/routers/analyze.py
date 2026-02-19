"""
AI 分析路由 — SSE 流式推送
"""

import json
import asyncio
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from server.services.ai_pipeline import run_pipeline_streaming

router = APIRouter()
executor = ThreadPoolExecutor(max_workers=2)


class AnalyzeRequest(BaseModel):
    transcript: str
    persona: str = "外贸小白"
    video_url: str = ""


@router.post("/api/analyze")
async def analyze(request: AnalyzeRequest):
    if not request.transcript or len(request.transcript.strip()) < 50:
        raise HTTPException(status_code=400, detail="Transcript 太短，至少需要 50 个字符")

    async def event_generator():
        loop = asyncio.get_event_loop()

        # 在线程池中运行同步的 pipeline
        def run_sync():
            return list(run_pipeline_streaming(request.transcript, request.persona))

        try:
            events = await loop.run_in_executor(executor, run_sync)
            for event in events:
                data = event["data"]
                if isinstance(data, dict):
                    data = json.dumps(data, ensure_ascii=False)
                yield {
                    "event": event["event"],
                    "data": data,
                }
        except Exception as e:
            yield {
                "event": "error",
                "data": f"Pipeline 执行出错: {str(e)[:300]}",
            }

    return EventSourceResponse(event_generator())
