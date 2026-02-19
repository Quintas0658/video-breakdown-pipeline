"""
YouTube 字幕提取服务
"""

import re
from urllib.parse import urlparse, parse_qs


def extract_video_id(url: str) -> str:
    """从各种 YouTube URL 格式中提取 video ID"""
    # youtu.be/VIDEO_ID
    if "youtu.be" in url:
        path = urlparse(url).path
        return path.strip("/").split("/")[0]

    # youtube.com/watch?v=VIDEO_ID
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    if "v" in qs:
        return qs["v"][0]

    # youtube.com/embed/VIDEO_ID
    if "/embed/" in parsed.path:
        return parsed.path.split("/embed/")[1].split("/")[0]

    # youtube.com/v/VIDEO_ID
    if "/v/" in parsed.path:
        return parsed.path.split("/v/")[1].split("/")[0]

    raise ValueError(f"无法从 URL 中提取 video ID: {url}")


def fetch_transcript(video_id: str, languages: list[str] = None) -> list[dict]:
    """
    获取 YouTube 视频字幕

    返回: [{"text": "...", "start": 0.0, "duration": 3.5}, ...]
    """
    from youtube_transcript_api import YouTubeTranscriptApi

    if languages is None:
        languages = ["en", "en-US", "en-GB"]

    ytt = YouTubeTranscriptApi()

    try:
        transcript = ytt.fetch(video_id, languages=languages)
        segments = list(transcript)
    except Exception:
        # fallback: 尝试获取任何可用语言的字幕
        try:
            transcript_list = ytt.list(video_id)
            # 优先英文，其次自动生成的英文
            found = None
            for t in transcript_list:
                if t.language_code.startswith("en"):
                    found = t
                    break
            if found is None:
                found = transcript_list[0] if transcript_list else None
            if found is None:
                raise RuntimeError("No transcripts available")
            segments = list(found.fetch())
        except RuntimeError:
            raise
        except Exception as e:
            raise RuntimeError(f"无法获取视频字幕: {str(e)[:200]}")

    return [
        {
            "text": getattr(seg, "text", "") if hasattr(seg, "text") else seg.get("text", ""),
            "start": getattr(seg, "start", 0.0) if hasattr(seg, "start") else seg.get("start", 0.0),
            "duration": getattr(seg, "duration", 0.0) if hasattr(seg, "duration") else seg.get("duration", 0.0),
        }
        for seg in segments
    ]


def merge_segments(segments: list[dict], soft_max: int = 200, hard_max: int = 500) -> list[dict]:
    """
    将碎片化的字幕段落合并为可读的段落块

    思路: 先把所有 segment 合并成完整文本，用正则找到所有句子边界，
    然后按 soft_max/hard_max 把句子分组为段落，最后根据字符偏移
    反查对应的时间戳。
    """
    if not segments:
        return []

    # Step 1: 构建字符偏移 → 时间戳的映射
    # 把所有 segment 拼成完整文本，同时记录每个字符对应的时间
    full_text = ""
    char_times = []  # char_times[i] = 该字符对应的 start 时间
    char_ends = []   # char_ends[i] = 该字符对应的 segment end 时间

    for seg in segments:
        text = seg["text"].strip()
        if not text:
            continue
        seg_start = seg["start"]
        seg_end = seg["start"] + seg["duration"]
        if full_text:
            # 加空格连接
            full_text += " "
            char_times.append(seg_start)
            char_ends.append(seg_end)
        for _ in text:
            char_times.append(seg_start)
            char_ends.append(seg_end)
        full_text += text

    if not full_text:
        return []

    # Step 2: 找到所有句子边界位置（句末标点后跟空格或字符串结尾）
    sentence_ends = []  # 每个元素是句末标点后的字符位置（切分点）
    for m in re.finditer(r'[.?!](?:\s|$)', full_text):
        # 切分点在标点后面的空格之后
        end_pos = m.end()
        sentence_ends.append(end_pos)

    # Step 3: 按句子边界分段，尊重 soft_max 和 hard_max
    merged = []
    para_start = 0  # 当前段落在 full_text 中的起始位置

    if not sentence_ends:
        # 没有句末标点，按 hard_max 强制切分
        while para_start < len(full_text):
            end = min(para_start + hard_max, len(full_text))
            # 尝试在空格处切
            if end < len(full_text):
                space_pos = full_text.rfind(" ", para_start, end)
                if space_pos > para_start:
                    end = space_pos + 1
            text = full_text[para_start:end].strip()
            if text:
                merged.append({
                    "text": text,
                    "start": char_times[para_start],
                    "duration": char_ends[min(end - 1, len(char_ends) - 1)] - char_times[para_start],
                })
            para_start = end
    else:
        se_idx = 0  # sentence_ends 的索引
        while para_start < len(full_text) and se_idx <= len(sentence_ends):
            # 从 para_start 开始，累积句子直到超过 soft_max
            best_end = None

            while se_idx < len(sentence_ends):
                candidate = sentence_ends[se_idx]
                chunk_len = candidate - para_start

                if chunk_len >= soft_max:
                    # 超过 soft_max，在这里切
                    best_end = candidate
                    se_idx += 1
                    break

                # 还没到 soft_max，记录这个候选点，继续看下一个
                best_end = candidate
                se_idx += 1

            # 如果没有更多句子边界了，把剩余文本全部收入
            if se_idx >= len(sentence_ends) and best_end is not None:
                remaining_text = full_text[best_end:].strip()
                if remaining_text:
                    # 剩余部分不够组成新段落，合并到当前段
                    if len(remaining_text) < soft_max * 0.4:
                        best_end = len(full_text)
                        se_idx = len(sentence_ends) + 1  # 标记结束

            if best_end is None:
                best_end = len(full_text)

            text = full_text[para_start:best_end].strip()
            if text:
                start_idx = para_start
                end_idx = min(best_end - 1, len(char_times) - 1)
                merged.append({
                    "text": text,
                    "start": char_times[start_idx],
                    "duration": char_ends[end_idx] - char_times[start_idx],
                })

            para_start = best_end
            if para_start >= len(full_text):
                break

        # 处理最后剩余的文本（在最后一个句子边界之后）
        if para_start < len(full_text):
            text = full_text[para_start:].strip()
            if text:
                if merged and len(text) < soft_max * 0.4:
                    # 太短，合并到上一段
                    merged[-1]["text"] += " " + text
                    merged[-1]["duration"] = char_ends[-1] - merged[-1]["start"]
                else:
                    merged.append({
                        "text": text,
                        "start": char_times[para_start],
                        "duration": char_ends[-1] - char_times[para_start],
                    })

    # Step 4: 处理时间间隔过大的情况（> 3秒的停顿应该分段）
    final = []
    for para in merged:
        final.append(para)

    return final


def transcript_to_text(segments: list[dict]) -> str:
    """将字幕段落合并为纯文本"""
    return " ".join(seg["text"] for seg in segments)
