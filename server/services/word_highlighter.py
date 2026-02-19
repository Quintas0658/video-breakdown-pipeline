"""
词汇高亮服务 — 识别字幕中值得学习的短语
"""

import re

import json
from pathlib import Path

# 词典目录
DICT_DIR = Path(__file__).parent.parent / "data" / "dictionaries"

def load_dictionaries():
    """加载所有 JSON 词典"""
    phrases = []
    
    # 默认加载的基础词典
    files = ["common_phrases.json", "workplace_slang.json"]
    
    for filename in files:
        path = DICT_DIR / filename
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                phrases.extend(data)
            except Exception as e:
                print(f"Error loading dictionary {filename}: {e}")
                
    # 排序：长短语优先匹配 (Prevent "Time" masking "Time Off")
    phrases.sort(key=lambda x: len(x["phrase"]), reverse=True)
    return phrases

# 初始化时加载（也可以做成缓存）
BUSINESS_PHRASES = load_dictionaries()

LEVEL_COLORS = {
    "A2": "green",
    "B1": "green",
    "B2": "blue",
    "C1": "purple",
}


def find_highlights(text: str, extra_phrases: list[dict] = None) -> list[dict]:
    """
    在文本中查找值得高亮的短语

    返回: [{"phrase": "...", "start": 0, "end": 5, "translation": "...", "level": "B2", "color": "blue"}]
    """
    phrases = BUSINESS_PHRASES.copy()
    if extra_phrases:
        phrases = extra_phrases + phrases

    highlights = []
    text_lower = text.lower()
    used_ranges = set()

    for entry in phrases:
        pattern = r'\b' + re.escape(entry["phrase"].lower()) + r'\b'
        for match in re.finditer(pattern, text_lower):
            start, end = match.start(), match.end()
            # 避免重叠
            if any(start < ur_end and end > ur_start for ur_start, ur_end in used_ranges):
                continue
            used_ranges.add((start, end))
            level = entry.get("level", "B2")
            highlights.append({
                "phrase": text[start:end],
                "start": start,
                "end": end,
                "translation": entry.get("translation", ""),
                "level": level,
                "color": LEVEL_COLORS.get(level, "blue"),
            })

    highlights.sort(key=lambda x: x["start"])
    return highlights


def highlight_segments(segments: list[dict], extra_phrases: list[dict] = None) -> list[dict]:
    """为字幕段落添加高亮标注"""
    for segment in segments:
        segment["highlights"] = find_highlights(segment["text"], extra_phrases)
    return segments
