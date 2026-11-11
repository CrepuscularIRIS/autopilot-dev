# agent-orchestration-template

> A lightweight, centralized template for AI-assisted development: one main agent writes the code, a manager owns requirements and planning, a cross-vendor reviewer does acceptance + review, and a reverse-engineer is on call. Four role cards, ticket-driven, all state in files.

一个**轻量、集中**的 AI 开发流程模板：不再多 agent 并行开发，只有四张角色卡。它来自一个真实项目——先跑了一套 director / scout / builder / verifier / judge 的多 agent 编排，嫌太重、太慢、太费 token，收敛成了现在这套（工单制改编自 [yanauto/opus-manager](https://github.com/yanauto/opus-manager)）。

规则写给 Claude Code（`CLAUDE.md` + `.claude/agents/`），机制与工具无关。

---

## 四张角色卡

| 角色 | 模型 | 职责 |
|---|---|---|
| **主 agent**（当前会话） | 便宜、额度多 | 记用户原话；按工单 TDD 写代码；写回执；按节点派其他角色；合并 |
| **manager** | 判断力最强 | **需求归它**：原话 → BRIEF → 方案 → 工单与验收；裁决审查意见；重规划；阶段报告 |
| **reviewer** | 与主 agent **不同厂商** | **验收 + 审查一体**：亲手重跑验收命令、查改动范围、审 diff，每张单 PASS / FAIL |
| **reverse-engineer** | 任意 | 行为只在闭源产物里时，拿证据讲清怎么做的 |

为什么这样分：额度主要耗在「请求次数 × 上下文大小」。写代码请求最多，放在最便宜的主会话；强模型只做判断。subagent 每次是全新小上下文、只读文件，便宜也干净。

## 一张单的生命周期

```
用户原话 ─▶ BRIEF ─▶ manager A ─▶ open/ ─▶ 主 agent TDD ─▶ doing/ + 回执
                    （打磨需求、拆单）                          │
                                                               ▼
 merge + 回测 ◀── done/ ◀── 全 PASS 无高/中 ◀── reviewer（验收 + 审查）
                    ▲                                           │ FAIL / 高·中意见
                    └──────── manager B 逐条核实 ◀───────────────┘
                              不成立 → 理由；成立 → 修复单 T<N>b
```

- 同一张单失败两次 → manager C 重规划；阶段末 → reviewer 审整段 + manager D 写报告、更新 `HANDOFF.md`，换新会话。
- 作者不自评：主 agent 不宣布完成、不挪 `done/`；回执是说法，验收命令重跑才是证据。
- 不建定时巡检、不 fork、长测试后台跑一次等通知。

## 快速上手

1. **Use this template** 建仓（或 `gh repo create <name> --template CrepuscularIRIS/agent-orchestration-template`）。
2. 填 `CLAUDE.md` 里的 `<…>`：目标、非目标、测试命令、沙箱目录、外部动作授权、模型槽位。
3. 在 `.claude/agents/*.md` 的 `model:` 填你的模型；reviewer 务必与主 agent 不同来源。
4. 对主会话说需求。它会把原话写进 `work/<slug>/BRIEF.md` 并派 manager，之后按 `CLAUDE.md` §3 推进。你只需要回答 `work/QUESTIONS.md`。

## 目录

```
CLAUDE.md                     主控文件：项目边界、角色、流程、方法论、硬约束
.claude/agents/
  manager.md                  需求 / 拆单 / 裁决 / 重规划 / 报告
  reviewer.md                 验收 + 审查
  reverse-engineer.md         逆向（可挂专属 MCP）
work/
  HANDOFF.md                  接手入口
  QUESTIONS.md                要人拍板的问题（问题进文件，不停工）
  LEARNINGS.md                现象 → 根因 → 规则（附 10 条通用经验）
  LOG.md                      全局日志
  _template/BRIEF.md          用户原话 + manager 打磨后的需求
  tickets/
    open/ doing/ done/ blocked/ dropped/   工单所在目录即状态
    receipts/                 回执、审查报告
    queue.md                  顺序与计划
    _templates/               ticket.md / receipt.md
.github/                      PR 模板、issue 模板
```

## 从旧版（多 agent 编排）迁移

| 旧 | 新 |
|---|---|
| orchestrator 只派发不写代码 | 主 agent 自己写代码，只在节点派发 |
| director + scout | manager（外部事实由 manager 查或交主 agent 查） |
| builder / frontend-dev 多 worktree 并行 | 主 agent 按工单施工 |
| verifier + 多模型 code review + judge panel | reviewer（验收 + 审查一体）+ manager 裁决 |
| PLAN.md / VERIFY.md / panels/ / tick 巡检 | 工单目录 + 回执 + 审查报告；无巡检 |
| context.md + agent-rules.md | 并入 `CLAUDE.md` |

## License
MIT
