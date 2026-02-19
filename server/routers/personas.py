"""
用户画像路由
"""

from fastapi import APIRouter

from server.services.ai_pipeline import list_personas

router = APIRouter()


@router.get("/api/personas")
async def get_personas():
    personas = list_personas()
    return {"personas": personas}
