"""
AI Pipeline — 从 run_breakdown.py 提取的核心逻辑
供 FastAPI 和 CLI 共用
"""

import os
import re
from pathlib import Path
from datetime import datetime
from typing import Generator

from dotenv import load_dotenv

# --------------- 配置 ---------------

PROJECT_DIR = Path(__file__).parent.parent.parent

# 按优先级查找 .env 文件
for env_path in [
    PROJECT_DIR / "web" / ".env",              # web/.env
    PROJECT_DIR / ".env",                      # 项目根目录
    PROJECT_DIR / ".secrets" / ".env",         # 项目内 .secrets/
    Path.home() / ".env",                      # ~/
]:
    if env_path.exists():
        load_dotenv(env_path, override=True)
        break

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

OUTPUT_DIR = PROJECT_DIR / "output"
PERSONAS_DIR = PROJECT_DIR / "personas"

# 模型优先级
STEP1_MODELS = [
    ("gemini", "gemini-2.5-pro"),
    ("openai", "gpt-4o"),
    ("anthropic", "claude-sonnet-4-20250514"),
]

STEP2_MODELS = [
    ("gemini", "gemini-2.5-pro"),
    ("anthropic", "claude-sonnet-4-20250514"),
    ("openai", "gpt-4o"),
]

# --------------- Prompt 模板 ---------------

STEP1_PROMPT = """# Role
你是一个深度理解目标用户痛点的内容顾问。你的核心能力是：把一个英文专业视频的内容，翻译成"这和用户有什么关系"。

# User Persona
{persona}

# Task
以下是一期 YouTube 视频的文字稿（英文）。请分析：

1. **一句话价值**：这期视频对上述用户画像的核心价值是什么？（用一句直击内心的话概括）

2. **痛点映射**（3-5 个）：用户的哪些具体痛点可以被这期视频解决？
   每个痛点请包含：
   - 痛点描述（用用户自己的语言，比如"写好开发信不敢发"）
   - 认知重构（用户现在怎么想 → 应该怎么想）
   - 对应视频中的哪个技巧/片段

3. **深层 insight**：这期视频有什么超越具体技巧的、更深层的洞察？
   （比如"状态比脚本重要"这种认知升级）

4. **明天行动**：用户看完后，明天最该做的一件事是什么？

# Video Transcript
{transcript}

# Output Requirements
- 用中文回答
- 语气像一个有 5 年经验的同行在和新人聊天，不要像老师讲课
- 先说用户的痛，再说视频怎么帮他
- 要具体、要有画面感（"写好开发信鼠标悬在发送键上不敢点"）
- 不要列 bullet point 清单，要像在和朋友对话"""

STEP2_PROMPT = """# Role
你是一个专注于"视频+笔记"双语学习内容的内容策划师。
你的核心能力是：把英文视频拆解成让非母语用户"既学到专业技能又提升语言能力"的结构化学习材料。

# User Persona
{persona}

# Layer 0 Analysis (来自上一步的分析)
以下是对这期视频对目标用户价值的分析，请基于此展开深度拆解：

{layer0}

# 4-Layer Analysis Framework

对于视频中每个和用户痛点相关的关键技巧/片段，请按以下 4 层分析。
注意：输出时不要显示 "Layer 1/2/3/4" 的标签，而是自然地融入内容。

## Layer 1 — 表达（Surface）
- 关键英文短语 + 中文翻译
- 语感和语气区别（如 "folks" vs "people"，"over at" vs "from"）
- 常见误用或混淆
- 标注用户画像可能不认识的词/表达

## Layer 2 — 策略（WHY）
- 这个技巧背后的心理机制（视频未必解释了）
- 为什么选这个说法而不是另一个？
- 有名字的框架/方法论（如 SPIN Selling, Sandler）

## Layer 3 — 上下文（Unknown Unknowns）
- 视频默认观众知道、但用户画像可能不知道的东西
- 文化背景差异（如美国 vs 中国商务礼仪）
- 行业知识默认（提到的书、概念、人物、术语）
- 这个技巧在什么文化/场景下 work / 不 work

## Layer 4 — 迁移应用
- 用户画像在自己的场景中怎么用？
- 提供填空模板（fill-in-the-blank）
- 标注 ✅ 适用场景 和 ❌ 不适用场景
- 给出对应的 email / WhatsApp / 展会版本

# Output Structure

请按以下结构输出：

## 1. 开头：这期视频和你有什么关系
（基于 Layer 0，用 2-3 段和用户产生共鸣）

## 2. 按用户痛点组织的内容（不按视频时间线）
每个痛点包含：
- **你的现实**：痛点描述（有画面感）
- **认知重构**：换个角度理解
- **具体做法**：视频教的方法（融合 4 层分析）
- **你的版本**：填空模板 / 即用话术

## 3. 深层洞察
超越技巧的认知升级

## 4. 即用工具包
- 📋 速查卡（一页纸，所有关键话术，用 code block 排版）
- ❌✅ Mistake Map（常见做法 vs 正确做法表格）
- ⚡ "明天就做"（1 个具体行动）
- 📖 延伸阅读（视频默认你知道的书/概念）

# Video Transcript
{transcript}

# Tone & Format
- 中文为主，英文关键表达保留原文
- 语气：有经验的同行分享，不是教科书
- Markdown 格式输出
- 表格用于对比，code block 用于模板/速查卡"""


# --------------- API 调用 ---------------

def call_gemini(messages: list, model: str, max_tokens: int = 16000) -> str:
    import requests

    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY 未配置")

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
            "maxOutputTokens": max_tokens,
        },
    }

    if system_instruction:
        payload["systemInstruction"] = {
            "parts": [{"text": system_instruction}]
        }

    response = requests.post(url, json=payload, timeout=600)

    if response.status_code != 200:
        error_info = response.json().get("error", {}).get("message", response.text)
        raise RuntimeError(f"Gemini {model}: {response.status_code} - {error_info}")

    data = response.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


def call_openai(messages: list, model: str, max_tokens: int = 16000) -> str:
    from openai import OpenAI

    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY 未配置")

    client = OpenAI(api_key=OPENAI_API_KEY)
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content


def call_anthropic(messages: list, model: str, max_tokens: int = 16000) -> str:
    import requests

    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY 未配置")

    system_content = ""
    api_messages = []
    for msg in messages:
        if msg["role"] == "system":
            system_content = msg["content"]
        else:
            api_messages.append(msg)

    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": api_messages,
    }
    if system_content:
        payload["system"] = system_content

    response = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers=headers,
        json=payload,
        timeout=600,
    )

    if response.status_code != 200:
        raise RuntimeError(f"Claude {model}: {response.status_code} - {response.text[:200]}")

    data = response.json()
    return data["content"][0]["text"]


PROVIDER_CALLERS = {
    "gemini": call_gemini,
    "openai": call_openai,
    "anthropic": call_anthropic,
}


def call_with_fallback(messages: list, model_priority: list, step_name: str) -> tuple[str, str]:
    errors = []
    for provider, model in model_priority:
        try:
            caller = PROVIDER_CALLERS[provider]
            content = caller(messages, model)
            return content, f"{provider}/{model}"
        except Exception as e:
            error_msg = str(e)[:150]
            errors.append(f"{provider}/{model}: {error_msg}")

    raise RuntimeError(
        f"[{step_name}] 所有模型都失败:\n" + "\n".join(f"  - {e}" for e in errors)
    )


# --------------- Pipeline ---------------

def load_persona(persona_name: str, personas_dir: Path = None) -> str:
    if personas_dir is None:
        personas_dir = PERSONAS_DIR

    persona_path = Path(persona_name)
    if persona_path.exists():
        return persona_path.read_text(encoding="utf-8")

    for ext in ["", ".md", ".txt"]:
        p = personas_dir / f"{persona_name}{ext}"
        if p.exists():
            return p.read_text(encoding="utf-8")

    return persona_name


def list_personas(personas_dir: Path = None) -> list[dict]:
    if personas_dir is None:
        personas_dir = PERSONAS_DIR

    personas = []
    if not personas_dir.exists():
        return personas

    for f in sorted(personas_dir.iterdir()):
        if f.suffix in (".md", ".txt"):
            personas.append({
                "name": f.stem,
                "filename": f.name,
                "content": f.read_text(encoding="utf-8"),
            })
    return personas


def run_step1(transcript: str, persona: str) -> tuple[str, str]:
    prompt = STEP1_PROMPT.format(persona=persona, transcript=transcript)
    messages = [
        {"role": "system", "content": "你是一个深度理解用户痛点的内容顾问。"},
        {"role": "user", "content": prompt},
    ]
    return call_with_fallback(messages, STEP1_MODELS, "Step 1: Layer 0")


def run_step2(transcript: str, persona: str, layer0: str) -> tuple[str, str]:
    prompt = STEP2_PROMPT.format(
        persona=persona,
        layer0=layer0,
        transcript=transcript,
    )
    messages = [
        {"role": "system", "content": "你是一个专注于双语视频学习内容的策划师。"},
        {"role": "user", "content": prompt},
    ]
    return call_with_fallback(messages, STEP2_MODELS, "Step 2: Breakdown")


def run_pipeline_streaming(transcript: str, persona_name: str = "外贸小白") -> Generator[dict, None, None]:
    """流式 pipeline，yield SSE 事件"""
    persona = load_persona(persona_name)

    yield {"event": "progress", "data": "正在进行 Layer 0 价值分析..."}

    try:
        layer0, model1 = run_step1(transcript, persona)
        yield {
            "event": "layer0",
            "data": {"content": layer0, "model": model1},
        }
    except Exception as e:
        yield {"event": "error", "data": f"Layer 0 分析失败: {str(e)[:200]}"}
        return

    yield {"event": "progress", "data": "正在进行 4 层深度拆解..."}

    try:
        breakdown, model2 = run_step2(transcript, persona, layer0)
        yield {
            "event": "breakdown",
            "data": {"content": breakdown, "model": model2},
        }
    except Exception as e:
        yield {"event": "error", "data": f"4 层拆解失败: {str(e)[:200]}"}
        return

    # 保存到文件
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_persona = re.sub(r'[^\w\-]', '_', persona_name)

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

    yield {"event": "done", "data": str(breakdown_path)}


# --------------- ToC 目录生成 ---------------

import json

TOC_PROMPT = """You are a content analyst. Given the following video transcript with timestamps, identify the major topic sections/chapters.

For each chapter, provide:
- "title": A concise, descriptive title in the SAME LANGUAGE as the transcript
- "start_time": The approximate start time in seconds
- "summary": A one-sentence summary of what this section covers, in the SAME LANGUAGE as the transcript

Return ONLY a JSON array, no other text. Example:
[
  {{"title": "Introduction and Why Outbound Matters", "start_time": 0, "summary": "The speaker introduces himself and explains why outbound is essential for hitting quota."}},
  {{"title": "Cold Email Strategy That Gets Replies", "start_time": 245, "summary": "How to write cold emails with high reply rates using buyer-centric messaging."}}
]

Guidelines:
- Typically 5-10 chapters for a 10-30 minute video
- Each chapter should represent a meaningful topic shift
- Titles should be specific and descriptive, not generic like "Part 1"
- start_time should be in seconds (integer)
- Keep the title and summary in the same language as the video transcript

## Transcript (with timestamps in [MM:SS] format):
{transcript}"""

TOC_MODELS = [
    ("gemini", "gemini-2.5-flash"),
    ("openai", "gpt-4o-mini"),
    ("anthropic", "claude-sonnet-4-20250514"),
]


def generate_toc(transcript_with_timestamps: str) -> list[dict]:
    """
    用 AI 生成视频章节目录

    transcript_with_timestamps: 带时间戳的完整文本，格式如 "[0:00] text [0:30] text ..."
    返回: [{"title", "title_zh", "start_time", "summary"}]
    """
    prompt = TOC_PROMPT.format(transcript=transcript_with_timestamps)
    messages = [
        {"role": "system", "content": "You are a content analyst that outputs only valid JSON."},
        {"role": "user", "content": prompt},
    ]

    content, model = call_with_fallback(messages, TOC_MODELS, "ToC Generation")

    # 解析 JSON — 处理可能的 markdown 代码块包裹
    content = content.strip()
    if content.startswith("```"):
        # 去掉 ```json ... ```
        content = re.sub(r'^```\w*\n?', '', content)
        content = re.sub(r'\n?```$', '', content)
        content = content.strip()

    chapters = json.loads(content)

    # 确保 start_time 是整数
    for ch in chapters:
        ch["start_time"] = int(ch.get("start_time", 0))

    return chapters


# --------------- Context Notes 生成 ---------------

CONTEXT_NOTES_PROMPT = """You are a cultural and language context analyst helping Chinese-speaking learners understand video content at a deeper level.

Given a video transcript with numbered segments, identify moments where non-native speakers would benefit from additional context. Look for:

1. **Cultural References**: Idioms, slang, cultural assumptions, humor, sarcasm, pop-culture references
2. **Knowledge Background**: Industry jargon, frameworks, referenced people/books/concepts, unstated assumptions the speaker expects the audience to know
3. **Social Connotation**: Tone shifts, sarcasm detection, implied attitudes, social implications that a non-native speaker would miss (e.g., "Nice job" said sarcastically)
4. **Dialect Warning**: Regional dialect or accent-specific usage that could confuse learners (e.g., UK vs US English, Mexican vs Spain Spanish)

For each segment that needs a note, provide:
- "segment_index": The segment number (0-based integer)
- "type": "cultural", "knowledge", "social_connotation", or "dialect_warning"
- "title": A short label in the SAME language as the transcript (e.g., English title for English video)
- "note": A concise explanation in Chinese (1-2 sentences, written for a Chinese learner)

Return ONLY a valid JSON array, no other text:
[
  {{"segment_index": 3, "type": "cultural", "title": "Chomping at the bit", "note": "这是一个英语习语，原意是马急着咬嚼子想跑，引申为'迫不及待'。"}},
  {{"segment_index": 7, "type": "knowledge", "title": "SPIN Selling", "note": "SPIN Selling 是 Neil Rackham 提出的咨询式销售框架，通过提问发现客户需求。"}},
  {{"segment_index": 12, "type": "social_connotation", "title": "Sarcastic 'Great job'", "note": "说话人语气带有讽刺，实际意思是做得很差。注意语调和上下文。"}},
  {{"segment_index": 15, "type": "dialect_warning", "title": "Reckon (UK)", "note": "'reckon' 在英式英语中很常见，意为'认为/觉得'，但在美式英语中较少使用。"}}
]

Guidelines:
- Focus on things a Chinese native speaker would likely miss or misunderstand
- Don't annotate simple vocabulary — focus on cultural context and background knowledge
- Aim for 8-15 notes per 10-minute video (be selective, not exhaustive)
- Keep notes concise and actionable

## Transcript (numbered segments):
{transcript_with_indices}"""

CONTEXT_NOTES_MODELS = [
    ("gemini", "gemini-2.5-flash"),
    ("openai", "gpt-4o-mini"),
    ("anthropic", "claude-sonnet-4-20250514"),
]


def generate_context_notes(transcript_with_indices: str) -> list[dict]:
    """
    用 AI 生成上下文注释

    transcript_with_indices: 带序号的文本，格式如 "[0] text\n[1] text\n..."
    返回: [{"segment_index", "type", "title", "note"}]
    """
    prompt = CONTEXT_NOTES_PROMPT.format(transcript_with_indices=transcript_with_indices)
    messages = [
        {"role": "system", "content": "You are a context analyst. Output only valid JSON."},
        {"role": "user", "content": prompt},
    ]

    content, model = call_with_fallback(messages, CONTEXT_NOTES_MODELS, "Context Notes")

    # 解析 JSON
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r'^```\w*\n?', '', content)
        content = re.sub(r'\n?```$', '', content)
        content = content.strip()

    try:
        notes = json.loads(content)
    except json.JSONDecodeError as e:
        print(f"Context notes JSON parsing failed: {str(e)[:100]}, attempting repair...")
        notes = None

        # 策略 1: 截断到最后一个完整对象 }
        last_brace = content.rfind('}')
        if last_brace > 0:
            candidate = content[:last_brace+1].rstrip().rstrip(',') + ']'
            arr_start = candidate.find('[')
            if arr_start >= 0:
                candidate = candidate[arr_start:]
            try:
                notes = json.loads(candidate)
                print(f"Context notes JSON repaired, got {len(notes)} notes")
            except json.JSONDecodeError:
                pass

        # 策略 2: 尾部括号修复
        if notes is None:
            fixed = content.rstrip().rstrip(',')
            if not fixed.endswith(']'):
                fixed += ']'
            try:
                notes = json.loads(fixed)
                print(f"Context notes JSON repaired (bracket fix), got {len(notes)} notes")
            except json.JSONDecodeError:
                raise ValueError(f"Cannot repair context notes JSON: {str(e)[:200]}")

    # 确保 segment_index 是整数
    for note in notes:
        note["segment_index"] = int(note.get("segment_index", 0))

    return notes


# --------------- AI 词汇高亮 ---------------

HIGHLIGHTS_PROMPT = """You are an expert language coach specializing in register-aware expression detection for Chinese-speaking professionals learning from authentic video content.

Your job: Identify expressions in the transcript that are valuable for learners, and classify each by its REGISTER (how/where it's used), not just its form.

## Register Tag System (4 tags)

🟢 **general_spoken** — Usable in any casual or semi-formal conversation. Natural and versatile.
   Examples: "figure out", "kind of", "no worries", "makes sense"

🔵 **professional_spoken** — Native speakers use this in meetings, presentations, and professional settings. THE HIGH-VALUE TARGET ZONE for career-focused learners.
   Examples: "aligned with", "circle back", "drill down", "leverage", "move the needle", "stakeholder buy-in"

🟡 **regional_cultural** — Specific to a country, region, or culture. MUST include a context note explaining which region.
   Examples: "mate" (UK/AU), "reckon" (UK informal), "touch wood" (UK) vs "knock on wood" (US)

⚪ **formal_written** — Grammatically correct but sounds stilted/unnatural in speech. Flag so learners know NOT to overuse it verbally.
   Examples: "I concur", "henceforth", "utilize" (when "use" works fine), "aforementioned"

KEY PRINCIPLE: Register must follow the VIDEO'S actual context, not a preset template. A tech review and a business meeting call for different register profiles.

## 3-Layer Detection

For each expression, provide:
- "segment_index": The number shown in [brackets] before the segment text. Return this EXACT number.
- "phrase": EXACT text as it appears in the transcript (for string matching)
- "register": "general_spoken" | "professional_spoken" | "regional_cultural" | "formal_written"
- "level": CEFR difficulty ("A2", "B1", "B2", or "C1")
- "frequency": Estimated spoken frequency ("very_high" | "high" | "medium" | "low")
- "translation": Chinese translation + usage note (1 sentence)
- "alternative": What a basic learner would say instead (null if not applicable)

Return ONLY a valid JSON array:
[
  {{"segment_index": 2, "phrase": "aligned with", "register": "professional_spoken", "level": "B2", "frequency": "high", "translation": "与...一致/保持同步。比 agree with 更职业化，常用于会议和邮件", "alternative": "agree with"}},
  {{"segment_index": 5, "phrase": "circle back", "register": "professional_spoken", "level": "B2", "frequency": "high", "translation": "稍后再讨论/回头再说。职场高频用语，尤其在会议中暂时搁置话题时", "alternative": "discuss later"}},
  {{"segment_index": 8, "phrase": "utilize", "register": "formal_written", "level": "B2", "frequency": "low", "translation": "使用。过于正式，口语中直接说 use 更自然", "alternative": "use"}}
]

CRITICAL JSON FORMATTING RULES:
- Your response MUST be a complete, valid JSON array
- Escape all double quotes inside string values using backslash: \"
- Do NOT use line breaks or special characters inside string values
- Ensure all string values are properly closed with quotes
- The last item must NOT have a trailing comma

Guidelines:
- Be THOROUGH: scan EVERY segment from start to end. Extract ALL expressions that match the criteria — no quantity limit. Do NOT stop early or skip later segments.
- The phrase must appear EXACTLY in the segment text (will be used for string matching).
- Don't highlight basic A1 vocabulary ("meeting", "email", "good").
- DO highlight phrases that a Chinese professional with CET-6 would recognize but wouldn't naturally USE.
- Phrasal verbs are especially valuable — even advanced learners underuse them.
- For formal_written register, emphasize that the expression is NOT recommended for speaking.
- For regional_cultural register, ALWAYS explain which region in the translation.
- Frequency should reflect how often native speakers use this in SPOKEN contexts (not written).

## Transcript (numbered segments):
{transcript_with_indices}"""

HIGHLIGHTS_MODELS = [
    ("gemini", "gemini-2.5-flash"),
    ("openai", "gpt-4o-mini"),
    ("anthropic", "claude-sonnet-4-20250514"),
]


def generate_highlights(transcript_with_indices: str) -> list[dict]:
    """
    用 AI 生成词汇高亮

    transcript_with_indices: 带序号的文本，格式如 "[0] text\n[1] text\n..."
    返回: [{"segment_index", "phrase", "category", "translation", "level", "alternative"}]
    """
    prompt = HIGHLIGHTS_PROMPT.format(transcript_with_indices=transcript_with_indices)
    messages = [
        {"role": "system", "content": "You are a vocabulary analyst for language learners. Output only valid JSON."},
        {"role": "user", "content": prompt},
    ]

    content, model = call_with_fallback(messages, HIGHLIGHTS_MODELS, "AI Highlights")

    # 解析 JSON
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r'^```\w*\n?', '', content)
        content = re.sub(r'\n?```$', '', content)
        content = content.strip()

    # 尝试解析 JSON，失败则尝试修复
    try:
        highlights = json.loads(content)
    except json.JSONDecodeError as e:
        print(f"JSON parsing failed: {str(e)[:100]}, attempting repair...")
        highlights = None

        # 策略 1: 找到最后一个完整对象 }，截断并补 ]
        last_brace = content.rfind('}')
        if last_brace > 0:
            candidate = content[:last_brace+1].rstrip().rstrip(',') + ']'
            arr_start = candidate.find('[')
            if arr_start >= 0:
                candidate = candidate[arr_start:]
            try:
                highlights = json.loads(candidate)
                print(f"JSON repaired (truncate to last complete object), got {len(highlights)} highlights")
            except json.JSONDecodeError:
                pass

        # 策略 2: 去掉尾逗号 + 找最后的 ]
        if highlights is None:
            fixed = content.rstrip().rstrip(',')
            last_bracket = fixed.rfind(']')
            if last_bracket > 0:
                fixed = fixed[:last_bracket+1]
            try:
                highlights = json.loads(fixed)
                print(f"JSON repaired (trailing bracket), got {len(highlights)} highlights")
            except json.JSONDecodeError:
                pass

        if highlights is None:
            raise ValueError(f"JSON repair failed for highlights: {str(e)[:100]}")

    # 确保 segment_index 是整数
    for h in highlights:
        h["segment_index"] = int(h.get("segment_index", 0))

    return highlights
