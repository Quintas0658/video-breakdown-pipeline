# 视频拆解 Pipeline / Video Breakdown Pipeline

- **状态**: 进行中
- **目标**: 自动化"4 层视频拆解"内容生产流程
- **模型**: Gemini Thinking (Step 1) → Gemini Flash / Claude (Step 2)

---

## 📐 架构

```
YouTube transcript + 用户画像
        ↓
Step 1: Layer 0 — "这期视频和你有什么关系"
        (gemini-2.5-pro → gpt-5.2 → claude-sonnet)
        ↓
Step 2: 4 层拆解 + 交付物
        (gemini-2.5-pro → claude-sonnet → gpt-4o)
        ↓
输出: Markdown 文件（可直接作为视频脚本底稿）
```

## 🏃 用法

```bash
# 从 YouTube 链接生成完整拆解
python run_breakdown.py --url "https://youtube.com/watch?v=..." --persona "外贸0-3年小白"

# 从本地 transcript 文件生成
python run_breakdown.py --transcript transcript.txt --persona "外贸0-3年小白"
```

## ✅ To-do

- [x] 项目结构搭建
- [x] run_breakdown.py 主脚本
- [ ] 测试 Gemini API 调通
- [ ] 加 OpenAI / Claude fallback (2月20日后)
- [ ] YouTube transcript 自动提取
- [ ] 用户画像模板库
- [ ] 🎨 Excalidraw 手绘风格笔记输出（见 `docs/visual-notes-plan.md`）

## 📝 进展日志

### 2026-02-16
- 调研 Excalidraw MCP（excalidraw/excalidraw-mcp）
- 确定可视化笔记方向：MVP 静态手绘图 → 后期动态动画演示
- 创建 `docs/visual-notes-plan.md` 记录功能规划

### 2026-02-15
- 项目创建，完成 2-step pipeline 脚本
- 模型优先级：Gemini → OpenAI → Claude
