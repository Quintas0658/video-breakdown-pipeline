#!/usr/bin/env python3
"""
Excalidraw 手绘配图生成器

读取讲稿 .md 文件 → 解析每个 Scene 的白板内容 → 调用 Gemini 生成 Excalidraw JSON

用法:
    # 生成全部 scene 的配图
    python generate_excalidraw.py --script output/cold-call-masterclass_script.md

    # 只生成指定 scene（用于测试）
    python generate_excalidraw.py --script output/cold-call-masterclass_script.md --scene 2
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from dotenv import load_dotenv

# --------------- 配置 ---------------

PROJECT_DIR = Path(__file__).parent
REPO_ROOT = PROJECT_DIR.parent.parent
SECRETS_DIR = REPO_ROOT / ".secrets"
load_dotenv(SECRETS_DIR / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OUTPUT_DIR = PROJECT_DIR / "output"

# Scene 1 的 Excalidraw JSON 作为 few-shot 示例
SCENE1_EXAMPLE = r'''{
  "type": "excalidraw",
  "version": 2,
  "source": "video-breakdown-pipeline",
  "elements": [
    {
      "id": "title_text",
      "type": "text",
      "x": 80,
      "y": 30,
      "width": 400,
      "height": 50,
      "angle": 0,
      "strokeColor": "#1e1e1e",
      "backgroundColor": "transparent",
      "fillStyle": "solid",
      "strokeWidth": 2,
      "roughness": 1,
      "opacity": 100,
      "groupIds": [],
      "frameId": null,
      "roundness": null,
      "seed": 1001,
      "version": 1,
      "versionNonce": 2001,
      "isDeleted": false,
      "boundElements": null,
      "updated": 1708100000000,
      "link": null,
      "locked": false,
      "text": "Hook ⚡ 外贸人的真相",
      "fontSize": 36,
      "fontFamily": 1,
      "textAlign": "left",
      "verticalAlign": "top",
      "containerId": null,
      "originalText": "Hook ⚡ 外贸人的真相",
      "autoResize": true,
      "lineHeight": 1.25
    },
    {
      "id": "subtitle_line",
      "type": "line",
      "x": 80,
      "y": 90,
      "width": 550,
      "height": 0,
      "angle": 0,
      "strokeColor": "#868e96",
      "backgroundColor": "transparent",
      "fillStyle": "solid",
      "strokeWidth": 1,
      "roughness": 2,
      "opacity": 60,
      "groupIds": [],
      "frameId": null,
      "roundness": {"type": 2},
      "seed": 1002,
      "version": 1,
      "versionNonce": 2002,
      "isDeleted": false,
      "boundElements": null,
      "updated": 1708100000000,
      "link": null,
      "locked": false,
      "points": [[0, 0], [550, 0]],
      "lastCommittedPoint": null,
      "startBinding": null,
      "endBinding": null,
      "startArrowhead": null,
      "endArrowhead": null
    },
    {
      "id": "scenario1_box",
      "type": "rectangle",
      "x": 60,
      "y": 120,
      "width": 520,
      "height": 60,
      "angle": 0,
      "strokeColor": "#e8590c",
      "backgroundColor": "#fff4e6",
      "fillStyle": "solid",
      "strokeWidth": 1,
      "roughness": 1,
      "opacity": 80,
      "groupIds": ["group_s1"],
      "frameId": null,
      "roundness": {"type": 3},
      "seed": 1003,
      "version": 1,
      "versionNonce": 2003,
      "isDeleted": false,
      "boundElements": null,
      "updated": 1708100000000,
      "link": null,
      "locked": false
    },
    {
      "id": "scenario1_text",
      "type": "text",
      "x": 80,
      "y": 135,
      "width": 480,
      "height": 30,
      "angle": 0,
      "strokeColor": "#e8590c",
      "backgroundColor": "transparent",
      "fillStyle": "solid",
      "strokeWidth": 1,
      "roughness": 1,
      "opacity": 100,
      "groupIds": ["group_s1"],
      "frameId": null,
      "roundness": null,
      "seed": 1004,
      "version": 1,
      "versionNonce": 2004,
      "isDeleted": false,
      "boundElements": null,
      "updated": 1708100000000,
      "link": null,
      "locked": false,
      "text": "😰 写好开发信  →  不敢点发送",
      "fontSize": 24,
      "fontFamily": 1,
      "textAlign": "left",
      "verticalAlign": "top",
      "containerId": null,
      "originalText": "😰 写好开发信  →  不敢点发送",
      "autoResize": true,
      "lineHeight": 1.25
    },
    {
      "id": "scenario2_box",
      "type": "rectangle",
      "x": 60,
      "y": 200,
      "width": 520,
      "height": 60,
      "angle": 0,
      "strokeColor": "#e8590c",
      "backgroundColor": "#fff4e6",
      "fillStyle": "solid",
      "strokeWidth": 1,
      "roughness": 1,
      "opacity": 80,
      "groupIds": ["group_s2"],
      "frameId": null,
      "roundness": {"type": 3},
      "seed": 1005,
      "version": 1,
      "versionNonce": 2005,
      "isDeleted": false,
      "boundElements": null,
      "updated": 1708100000000,
      "link": null,
      "locked": false
    },
    {
      "id": "scenario2_text",
      "type": "text",
      "x": 80,
      "y": 215,
      "width": 480,
      "height": 30,
      "angle": 0,
      "strokeColor": "#e8590c",
      "backgroundColor": "transparent",
      "fillStyle": "solid",
      "strokeWidth": 1,
      "roughness": 1,
      "opacity": 100,
      "groupIds": ["group_s2"],
      "frameId": null,
      "roundness": null,
      "seed": 1006,
      "version": 1,
      "versionNonce": 2006,
      "isDeleted": false,
      "boundElements": null,
      "updated": 1708100000000,
      "link": null,
      "locked": false,
      "text": "📞 电话响了  →  脑子空白",
      "fontSize": 24,
      "fontFamily": 1,
      "textAlign": "left",
      "verticalAlign": "top",
      "containerId": null,
      "originalText": "📞 电话响了  →  脑子空白",
      "autoResize": true,
      "lineHeight": 1.25
    },
    {
      "id": "insight_box",
      "type": "rectangle",
      "x": 60,
      "y": 520,
      "width": 560,
      "height": 80,
      "angle": 0,
      "strokeColor": "#2f9e44",
      "backgroundColor": "#d3f9d8",
      "fillStyle": "solid",
      "strokeWidth": 2,
      "roughness": 1,
      "opacity": 80,
      "groupIds": ["group_insight"],
      "frameId": null,
      "roundness": {"type": 3},
      "seed": 1011,
      "version": 1,
      "versionNonce": 2011,
      "isDeleted": false,
      "boundElements": null,
      "updated": 1708100000000,
      "link": null,
      "locked": false
    },
    {
      "id": "insight_text",
      "type": "text",
      "x": 90,
      "y": 540,
      "width": 500,
      "height": 40,
      "angle": 0,
      "strokeColor": "#2f9e44",
      "backgroundColor": "transparent",
      "fillStyle": "solid",
      "strokeWidth": 1,
      "roughness": 1,
      "opacity": 100,
      "groupIds": ["group_insight"],
      "frameId": null,
      "roundness": null,
      "seed": 1012,
      "version": 1,
      "versionNonce": 2012,
      "isDeleted": false,
      "boundElements": null,
      "updated": 1708100000000,
      "link": null,
      "locked": false,
      "text": "✅ 是你把 cold call 当成了\"推销\"",
      "fontSize": 28,
      "fontFamily": 1,
      "textAlign": "left",
      "verticalAlign": "top",
      "containerId": null,
      "originalText": "✅ 是你把 cold call 当成了\"推销\"",
      "autoResize": true,
      "lineHeight": 1.25
    }
  ],
  "appState": {"gridSize": null, "viewBackgroundColor": "#ffffff"},
  "files": {}
}'''


# --------------- Prompt ---------------

EXCALIDRAW_PROMPT = """# Role
你是一个 Excalidraw 图表设计师。你的任务是把白板笔记内容转换成 Excalidraw JSON 格式。

# 设计规范

## 元素属性
- fontFamily: 1 (Virgil 手写体)
- roughness: 1 (手绘质感)
- 所有元素都需要 id, type, x, y, width, height, angle, strokeColor, backgroundColor, fillStyle, strokeWidth, roughness, opacity, groupIds, frameId, roundness, seed, version, versionNonce, isDeleted, boundElements, updated, link, locked
- text 元素额外需要: text, fontSize, fontFamily, textAlign, verticalAlign, containerId, originalText, autoResize, lineHeight
- line/arrow 元素额外需要: points, lastCommittedPoint, startBinding, endBinding, startArrowhead, endArrowhead

## 颜色规范
- 标题: #1e1e1e (黑色), fontSize 36
- 痛点/问题: strokeColor #e8590c (橙色), 背景 #fff4e6
- ❌ 错误做法: #e03131 (红色)
- ✅ 正确做法/key insight: #2f9e44 (绿色), 背景 #d3f9d8
- 辅助文字/注释: #868e96 (灰色), opacity 70
- 重要框架/方法: #1971c2 (蓝色), 背景 #d0ebff
- 普通内容: #1e1e1e (黑色)
- 分隔线/箭头: #868e96 (灰色)

## 布局规则
- 画布从 x:60, y:30 开始
- 标题在最上方, fontSize 36
- 标题下方 y:90 画一条分隔线 (width 550)
- 内容从 y:120 开始，每个内容块间距 80px
- 文本框放在矩形框内时，文本 x 比框 x 大 20, y 居中
- 矩形框圆角: roundness type 3
- 画布总宽度控制在 700px 以内
- 每个元素的 seed 用不同的随机整数

## 中文字符宽度估算
- 中文字符: 约为 fontSize 的 1x 宽度
- 英文字符: 约为 fontSize 的 0.6x 宽度
- emoji: 约为 fontSize 的 1.2x 宽度

# 示例

以下白板内容:
```
（空白 → 逐行浮现）

😰 写好开发信 → 不敢点发送
📞 电话响了 → 脑子空白

❌ 这些都不是你英语不好
✅ 是你把 cold call 当成了"推销"
```

生成的 Excalidraw JSON (精简版，只展示关键元素):
{example_json}

# 当前任务

请为以下白板内容生成完整的 Excalidraw JSON。

**Scene 标题**: {scene_title}

**白板内容**:
```
{whiteboard_content}
```

# 输出要求
1. 直接输出完整的 JSON，不要任何解释文字
2. JSON 必须是合法的 Excalidraw 格式
3. 保留所有 emoji
4. 确保元素不重叠，布局美观
5. JSON 开头必须是 {{ ，结尾必须是 }}
6. 不要输出 markdown 代码块符号，直接输出 JSON"""


# --------------- API 调用 ---------------

def call_gemini(messages: list, model: str = "gemini-2.5-flash") -> tuple[str, dict]:
    """调用 Gemini REST API，返回 (text, usage_metadata)"""
    import requests

    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY 未配置，请在 .secrets/.env 中设置")

    contents = []
    system_instruction = None

    for msg in messages:
        role = msg["role"]
        if role == "system":
            system_instruction = msg["content"]
            continue
        if role == "assistant":
            role = "model"
        contents.append({"role": role, "parts": [{"text": msg["content"]}]})

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"

    payload = {
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": 16000,
            "responseMimeType": "application/json",
        },
    }

    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [{"text": system_instruction}]
        }

    response = requests.post(url, json=payload, timeout=300)

    if response.status_code != 200:
        error_info = response.json().get("error", {}).get("message", response.text[:300])
        raise RuntimeError(f"Gemini {model}: {response.status_code} - {error_info}")

    data = response.json()
    text = data["candidates"][0]["content"]["parts"][0]["text"]
    usage = data.get("usageMetadata", {})
    return text, usage


# --------------- 解析讲稿 ---------------

def parse_scenes(script_path: Path) -> list[dict]:
    """
    从讲稿 .md 中解析出每个 Scene 的标题和白板内容。
    返回: [{"number": 1, "title": "Hook", "whiteboard": "..."}]
    """
    content = script_path.read_text(encoding="utf-8")

    # 按 ## Scene 分割
    scene_pattern = r"## Scene (\d+)\s*[—–-]\s*(.+?)(?:\n|$)"
    whiteboard_pattern = r"### 🖥️ 白板画面\s*\n\s*```\s*\n(.*?)```"

    scenes = []
    # 找到所有 scene 标题
    titles = list(re.finditer(scene_pattern, content))

    for i, match in enumerate(titles):
        scene_num = int(match.group(1))
        scene_title = match.group(2).strip()

        # 截取这个 scene 到下一个 scene 之间的内容
        start = match.start()
        end = titles[i + 1].start() if i + 1 < len(titles) else len(content)
        scene_content = content[start:end]

        # 提取白板内容
        wb_match = re.search(whiteboard_pattern, scene_content, re.DOTALL)
        if wb_match:
            whiteboard = wb_match.group(1).strip()
            scenes.append({
                "number": scene_num,
                "title": scene_title,
                "whiteboard": whiteboard,
            })
        else:
            print(f"  ⚠️ Scene {scene_num} 没有找到白板内容，跳过")

    return scenes


# --------------- 生成 Excalidraw ---------------

def generate_scene_excalidraw(scene: dict, max_retries: int = 2) -> tuple[str, dict]:
    """调用 Gemini 生成一个 Scene 的 Excalidraw JSON，返回 (json_str, usage)。失败自动重试。"""
    import time

    prompt = EXCALIDRAW_PROMPT.format(
        example_json=SCENE1_EXAMPLE,
        scene_title=scene["title"],
        whiteboard_content=scene["whiteboard"],
    )

    messages = [
        {"role": "system", "content": "你是一个 Excalidraw 图表设计专家。只输出合法的 JSON，不要任何解释。"},
        {"role": "user", "content": prompt},
    ]

    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            if attempt > 1:
                print(f"  🔄 重试 ({attempt}/{max_retries})...")
                time.sleep(2)

            result, usage = call_gemini(messages)

            # 清理：去掉可能的 markdown 代码块标记
            result = result.strip()
            if result.startswith("```"):
                result = re.sub(r'^```\w*\n?', '', result)
                result = re.sub(r'\n?```$', '', result)
                result = result.strip()

            # 验证 JSON
            parsed = json.loads(result)
            if "elements" not in parsed:
                raise ValueError("JSON 缺少 elements 字段")
            if len(parsed["elements"]) < 2:
                raise ValueError(f"元素太少 ({len(parsed['elements'])} 个)")
            return result, usage

        except (json.JSONDecodeError, ValueError) as e:
            last_error = e
            if attempt < max_retries:
                print(f"  ⚠️ 第 {attempt} 次 JSON 解析失败: {e}")
            else:
                print(f"  ⚠️ JSON 解析失败 (已重试 {max_retries} 次): {e}")
                print(f"  📝 原始输出前 200 字符: {result[:200]}")

    raise last_error


def make_safe_filename(scene: dict) -> str:
    """生成安全的文件名"""
    title = scene["title"]
    # 移除 emoji 和特殊字符
    safe = re.sub(r'[^\w\s\-]', '', title)
    safe = re.sub(r'\s+', '-', safe.strip())
    safe = safe[:30] if len(safe) > 30 else safe
    return f"scene{scene['number']}-{safe}".lower()


# --------------- 主流程 ---------------

def main():
    parser = argparse.ArgumentParser(description="Excalidraw 手绘配图生成器")
    parser.add_argument(
        "--script", "-s",
        required=True,
        help="讲稿 .md 文件路径",
    )
    parser.add_argument(
        "--scene", "-n",
        type=int,
        default=None,
        help="只生成指定 scene 编号 (用于测试)",
    )
    parser.add_argument(
        "--output-dir", "-o",
        default=None,
        help="输出目录 (默认: 与讲稿同目录)",
    )

    args = parser.parse_args()

    # 解析路径
    script_path = Path(args.script)
    if not script_path.is_absolute():
        script_path = PROJECT_DIR / script_path
    if not script_path.exists():
        print(f"❌ 找不到讲稿: {script_path}")
        sys.exit(1)

    out_dir = Path(args.output_dir) if args.output_dir else script_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    # 解析 scenes
    print(f"\n📖 读取讲稿: {script_path.name}")
    scenes = parse_scenes(script_path)
    print(f"   找到 {len(scenes)} 个 Scene")

    # 过滤指定 scene
    if args.scene is not None:
        scenes = [s for s in scenes if s["number"] == args.scene]
        if not scenes:
            print(f"❌ 找不到 Scene {args.scene}")
            sys.exit(1)

    # 逐个生成
    print(f"\n🎨 开始生成 Excalidraw 配图...")
    print("=" * 50)

    generated = []
    failed = []
    total_input_tokens = 0
    total_output_tokens = 0
    scene_stats = []

    for scene in scenes:
        filename = make_safe_filename(scene)
        out_path = out_dir / f"{filename}.excalidraw"
        print(f"\n  Scene {scene['number']}: {scene['title']}")
        print(f"  📄 → {out_path.name}")

        try:
            result, usage = generate_scene_excalidraw(scene)
            out_path.write_text(result, encoding="utf-8")
            elem_count = len(json.loads(result)["elements"])
            input_tok = usage.get("promptTokenCount", 0)
            output_tok = usage.get("candidatesTokenCount", 0)
            total_input_tokens += input_tok
            total_output_tokens += output_tok
            scene_stats.append({
                "scene": scene["number"],
                "title": scene["title"][:20],
                "elements": elem_count,
                "input_tokens": input_tok,
                "output_tokens": output_tok,
            })
            print(f"  ✅ 成功! ({elem_count} 个元素, 输入 {input_tok} / 输出 {output_tok} tokens)")
            generated.append(out_path)
        except Exception as e:
            print(f"  ❌ 失败: {e}")
            failed.append((scene["number"], str(e)))

    # 汇总
    print(f"\n{'=' * 50}")
    print(f"🎨 生成完成!")
    print(f"   ✅ 成功: {len(generated)} 个")
    if failed:
        print(f"   ❌ 失败: {len(failed)} 个")
        for num, err in failed:
            print(f"      Scene {num}: {err[:80]}")
    # Token 统计
    if scene_stats:
        print(f"\n📊 Token 用量统计:")
        print(f"   {'Scene':<8} {'标题':<22} {'元素':>4} {'输入':>8} {'输出':>8}")
        print(f"   {'─'*58}")
        for s in scene_stats:
            print(f"   Scene {s['scene']:<3} {s['title']:<20} {s['elements']:>4} {s['input_tokens']:>8} {s['output_tokens']:>8}")
        print(f"   {'─'*58}")
        print(f"   {'合计':<31} {total_input_tokens:>8} {total_output_tokens:>8}")
        total_tokens = total_input_tokens + total_output_tokens
        # Gemini Flash 价格: 输入 $0.075/M, 输出 $0.30/M (估算)
        est_cost_usd = (total_input_tokens * 0.075 + total_output_tokens * 0.30) / 1_000_000
        print(f"   总 token: {total_tokens:,}")
        print(f"   💰 估算费用: ~${est_cost_usd:.4f} USD (Gemini Flash 价格)")

    print(f"\n📁 输出目录: {out_dir}")
    print(f"💡 打开 excalidraw.com → 导入 .excalidraw 文件查看效果")


if __name__ == "__main__":
    main()
