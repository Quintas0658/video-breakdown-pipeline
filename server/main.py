"""
FastAPI 主应用
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.routers import transcript, analyze, personas

app = FastAPI(title="Video Breakdown API", version="0.1.0")

# CORS — 允许 Next.js dev server 访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transcript.router)
app.include_router(analyze.router)
app.include_router(personas.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
