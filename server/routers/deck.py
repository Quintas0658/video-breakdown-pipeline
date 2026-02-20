"""
Deck 路由 — 保存/查询/删除用户收藏的表达
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from server.services.cache_store import save_expression, get_saved_expressions, delete_expression

router = APIRouter()


class SaveExpressionRequest(BaseModel):
    phrase: str
    register: str | None = None
    level: str | None = None
    frequency: str | None = None
    translation: str | None = None
    alternative: str | None = None
    context_sentence: str | None = None
    video_id: str | None = None
    segment_start: float | None = None


@router.post("/api/deck/save")
async def save_to_deck(request: SaveExpressionRequest):
    """保存一个表达到词库"""
    expr_id = save_expression(request.model_dump())
    return {"id": expr_id}


@router.get("/api/deck")
async def get_deck():
    """获取所有保存的表达"""
    expressions = get_saved_expressions()
    return {"expressions": expressions, "total": len(expressions)}


@router.delete("/api/deck/{expr_id}")
async def remove_from_deck(expr_id: int):
    """删除一个表达"""
    success = delete_expression(expr_id)
    if not success:
        raise HTTPException(status_code=404, detail="Expression not found")
    return {"ok": True}
