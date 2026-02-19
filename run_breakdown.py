#!/usr/bin/env python3
"""
视频拆解 Pipeline — CLI 入口

用法:
    python run_breakdown.py --transcript transcript.txt --persona "外贸小白"
    python run_breakdown.py --transcript transcript.txt  # 默认画像: 外贸小白
"""

import argparse
import re
import sys
from pathlib import Path
from datetime import datetime

from server.services.ai_pipeline import (
    load_persona,
    run_step1,
    run_step2,
    OUTPUT_DIR,
)


def run_pipeline(transcript: str, persona_name: str = "外贸小白"):
    """运行完整 pipeline"""
    print("\n" + "=" * 60)
    print("🎬 视频拆解 Pipeline")
    print("=" * 60)

    persona = load_persona(persona_name)
    print(f"\n📋 用户画像: {persona_name}")
    print(f"📄 Transcript 长度: {len(transcript)} 字符")

    print(f"\n{'─' * 40}")
    print("Step 1: Layer 0 — 价值桥分析")
    print(f"{'─' * 40}")
    layer0, model1 = run_step1(transcript, persona)

    print(f"\n{'─' * 40}")
    print("Step 2: 4-Layer Breakdown + 交付物")
    print(f"{'─' * 40}")
    breakdown, model2 = run_step2(transcript, persona, layer0)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_persona = re.sub(r'[^\w\-]', '_', persona_name)

    layer0_path = OUTPUT_DIR / f"{timestamp}_{safe_persona}_layer0.md"
    layer0_path.write_text(
        f"# Layer 0 分析\n\n"
        f"> 模型: {model1}\n"
        f"> 画像: {persona_name}\n"
        f"> 时间: {datetime.now().isoformat()}\n\n"
        f"---\n\n{layer0}",
        encoding="utf-8",
    )

    breakdown_path = OUTPUT_DIR / f"{timestamp}_{safe_persona}_breakdown.md"
    breakdown_path.write_text(
        f"# 视频拆解\n\n"
        f"> Step 1 模型: {model1}\n"
        f"> Step 2 模型: {model2}\n"
        f"> 画像: {persona_name}\n"
        f"> 时间: {datetime.now().isoformat()}\n\n"
        f"---\n\n{breakdown}",
        encoding="utf-8",
    )

    print(f"\n{'=' * 60}")
    print("✅ Pipeline 完成!")
    print(f"{'=' * 60}")
    print(f"   Layer 0:    {layer0_path}")
    print(f"   Breakdown:  {breakdown_path}")
    print(f"   模型:       Step1={model1}, Step2={model2}")

    return layer0_path, breakdown_path


def main():
    parser = argparse.ArgumentParser(description="视频拆解 Pipeline")
    parser.add_argument("--transcript", "-t", required=True, help="Transcript 文件路径")
    parser.add_argument("--persona", "-p", default="外贸小白", help="用户画像名称或文件路径")

    args = parser.parse_args()

    transcript_path = Path(args.transcript)
    if not transcript_path.exists():
        print(f"❌ 找不到文件: {transcript_path}")
        sys.exit(1)

    transcript = transcript_path.read_text(encoding="utf-8")

    if len(transcript) < 100:
        print(f"⚠️ Transcript 太短 ({len(transcript)} 字符)，确认文件正确？")

    run_pipeline(transcript, args.persona)


if __name__ == "__main__":
    main()
