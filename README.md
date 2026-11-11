# Autopilot Dev · 无人值守开发模板

> Drop in a one-line requirement; the setup researches it, turns it into a professional spec, builds it test-first, verifies it with an independent reviewer, and keeps going without you.

**随手扔一句需求，剩下的它自己补全**：查社区与上游、把需求打磨成专业的规格、拆成工单、先写测试再实现、自己调试、交给另一家模型验收审查，一直推进到交付。人只在 `work/QUESTIONS.md` 里偶尔拍板，不答也不停工。

## 怎么用

1. **Use this template** 建仓。
2. 填 `CLAUDE.md` 里的 `<…>`（目标、测试命令、沙箱目录、外部动作授权），在 `.claude/agents/*.md` 的 `model:` 填模型。
3. 对主会话说一句需求，比如「加个导出 PDF」。然后去忙别的。

## 它会自己做什么

| 阶段 | 谁 | 做什么 |
|---|---|---|
| 补全需求 | manager | 查社区、竞品、在维护的上游，把一句话扩成 BRIEF：目标、用户旅程、可证伪的 DONE 条款、非目标、方案 |
| 拆单 | manager | 一单一事，验收写成命令 |
| 开发 | 主 agent | 先写失败测试 → 实现 → 遇到问题先找根因再修 → 写回执 |
| 验收 + 审查 | reviewer（另一家模型） | 亲手重跑验收、审 diff，每单 PASS / FAIL |
| 裁决 / 重规划 | manager | 审查意见逐条核实；失败两次换路线 |
| 逆向 | reverse-engineer | 行为只在闭源产物里时才派 |
| 交付 | 主 agent + manager | 合并、回测、阶段报告、更新交接文件 |

要人拍板的事写进 `QUESTIONS.md` 并附推荐项；无人值守时 manager **按推荐项先推进**，人事后可推翻。

## 目录

```
CLAUDE.md               唯一主控文件：边界、角色、流程、硬约束
.claude/agents/         manager / reviewer / reverse-engineer 三张角色卡
work/HANDOFF.md         接手入口
work/<slug>/BRIEF.md    需求（用户原话 + manager 补全）
work/tickets/           工单（所在目录即状态）、回执、审查报告、队列、模板
work/QUESTIONS.md  LEARNINGS.md  LOG.md
```

工单制改编自 [yanauto/opus-manager](https://github.com/yanauto/opus-manager)。

## License
MIT
