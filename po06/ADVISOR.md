# Worker ↔ Advisor 协作（intent-scout-wish-4）

## 何时咨询

Orient → Intent Alignment / Intent Elaboration（Ask How before Plan）→ Karpathy 执行与关键节点补充 → Quality Calibration → 交付。

- 小修、简单问答跳过；非平凡任务在 Plan 或实质改动前咨询。
- 重大方案分叉与连续失败 2–3 次咨询；明确定义可验证的 DoD。
- PTC 主会话保持用户选择的 Worker 模型（示例 GLM 5.4 1M）；顾问后台路由不改变主模型。GLM 保有实现与自测责任；顾问不写文件、不扩张用户授权。

## 调用（PTC）

```js
await tools.consult_task({question:"S 当前情况；B 背景；A 我的判断；R 用 EARS 校准方案与 DoD"})
await tools.consult_task({entry:"understand",taskType:"long_horizon",question:"校准完整 Goal 的关键路径、验收和停止条件"})
await tools.consult_task({entry:"verify",taskType:"long_horizon",question:"核对当前整个 Goal 是否完成",files:[{path:"verification.log",purpose:"Goal 验证证据"}]})
await tools.consult_task({entry:"rework",question:"Stop-the-Line：选择能区分根因的最小实验"})
await tools.consult_task({entry:"rework",advisorRoute:"investigate",question:"复杂故障：独立调查现场、竞争假设与恢复路径"})
```

只需 question；默认 understand，传 currentResult 时默认 improve。旧 entry/mode、scope、files、images、evidenceRefs、阶段参数仍可用。插件自动附原话、相关近期工具证据、当前任务上下文及未结台账。普通顾问使用纯对话，不另起工具循环；明确附入的材料仍按授权读取。预发送优化器保留既有只读侦察。

| 场景 | 示例模型（角色可配置） |
|---|---|
| 原生长程 Goal 整体规划与重大重规划（taskType=long_horizon） | DeepSeek V4.1 Flash |
| Goal 整体完成度判断（GLM 主会话优先；可选 entry=verify, taskType=long_horizon） | GLM 5.4 |
| 真实视觉证据（主会话优先；显式图片核验） | GLM 5.4 |
| 后端、架构、算法、诊断及通用任务 | DeepSeek V4.1 Flash |
| 复杂故障、根因不明、恢复路径难选时按需独立调查（advisorRoute=investigate） | K3.1 Pro，只读子代理 |
| 已声明的阶段契约（taskId + stageId） | GLM 5.4 |
| 最终全局代码审查（advisorRoute=review, scope=general，无阶段编号） | GPT-6.2 Sol，只读子代理，每个原生 Goal 或普通任务最多一次 |

旧 architecture/web_3d/visual/multimodal 参数兼容普通路由。示例配置中的 K3.1 Pro 只在显式调查路由调用，不参加常规 Plan、视觉和终审。Goal 咨询采用 GORE/KAOS/GQM 与 Rolling Wave Planning / Receding Horizon Control，自动读取原生持久化 objective、id、revision、rounds；收尾须有实际证据，且 Goal revision 未变。其结果是 goalAssessment（advisoryOnly），不直接调用 update_goal，不替代 Sol 全局代码审查。

## 结构化报告

`decision`: CONTINUE / REDIRECT / REWORK / HOLD / APPROVE / ESCALATE。报告保留 summary（核心诊断）、contribution（建议）、constraints/defaults/dod（关键约束、默认值与完成标准）、findings/checks、nextStep/stopCondition。旧 verdict 兼容并由解析器映射。ESCALATE 需要具体问题与可选项；HOLD 明确缺证据或解除条件。日常 CONTINUE 简短，关键缺陷和方案边界允许精确技术细节，完整报告不被 512 token 截断；常驻回注依旧有容量限制。

## 证据与关闭

- 贡献模式 checks 恒为空，APPROVE 只表示方向认可，永不计入验收；复核必须由真实、可定位、版本有效的证据支持。
- 阶段契约保留 checkId、材料版本与 advance 门禁。Sol 与 Kimi 使用原生 Standard 独立上下文，仅有 root-bound review_inspect，可读取源码、搜索及查看 Git 状态/历史/diff，禁止 shell、写入、网络与委派；实际读取轨迹和 SHA-256 回传到主会话，未取得且引用独立证据不能通过。GLM 执行测试、复现与修复。
- 会话未结台账最多 8 条，非复核咨询自动附入，由 resolvedClaims 结算。
- 顾问开关关闭时不注册顾问工具或注入协作流程，原话及意图包仍物理隔离。
- 不新增后台轮询。工作流提示明确触发条件，由 Worker 主动调用；不是机械拦截每次 Plan 或每次编辑。

角色配置通过 bundle 的 `config.advisorModels`，参考 [profile 示例](../examples/profile.patch.yml)；未配置的角色跟随当前会话模型。审查是否独立取决于路由而非模型名称，即使所有角色使用同一个模型也会创建隔离的只读审查上下文。
