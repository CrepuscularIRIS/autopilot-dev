# Semantic Anchors / Keyword 提示词

语义锚点是精简的领域方法论提示，不是强制引用标准全文，也不是标准认证。按任务挑选最相关的原则，输出具体决策、反例与可验证条件，而非名词清单。

| 节点 | 关键词 | 实际要求 |
|---|---|---|
| Intent Alignment | Gricean Pragmatics · JTBD · XY Problem | 区分字面方案与真实目标，补出隐含约束；原话独立保留 |
| Intent Elaboration | ISO/IEC/IEEE 29148-inspired · EARS · Sprint Contract · Impact × Uncertainty | Plan 前取得可执行方向、合理默认值与可测验收条件 |
| Worker execution | Think Before Coding · Simplicity First · Surgical Changes · Goal-Driven Execution · Ponytail | 最短正确实现，不顺手重构；自主处理细节 |
| Debugging | Stop-the-Line · Single Hypothesis · Fail-Fast · Competing Hypotheses | 先找根因，再做最小区分实验；不要叠加盲修 |
| Quality | Standard of Care · Fitness for Purpose · Pre-mortem · Red Teaming · Independent V&V (IEEE 1012-inspired) · DoD | 有证据才声明通过；独立审查找实际影响交付的问题 |
| Long-horizon Goal | GORE · KAOS · GQM · Rolling Wave Planning · Receding Horizon Control | 结果目标、里程碑、边界、验收及停止条件随证据细化，不偷改成功标准 |
| Collaboration | Management by Exception · Mission Command · Bounded Autonomy · No Surprises · Constructive Dissent · SBAR | 低影响事项直接执行；关键分叉咨询；凭证据判断建议 |
| Reporting | BLUF · ISO 24495-1-inspired · ASD-STE100-inspired | 结论先行、短而精确；有实质问题再详细说明 |

## 真正的运行时提示词

- [optimizer-protocol.js](../po06/lib/optimizer-protocol.js)：发送前补全与格式契约。
- [advisor-workflow.js](../po06/lib/advisor-workflow.js) 与 [english-prompts.js](../po06/lib/english-prompts.js)：Worker 常驻流程（顾问开启时）。
- [advisor.js](../po06/lib/advisor.js) 与 [advisor-contribution.js](../po06/lib/advisor-contribution.js)：顾问任务角色、报告与独立验证契约。
- [playbooks/](../po06/playbooks/)：Ponytail、Systematic Debugging、Verification Before Completion、Requesting / Receiving Code Review。

`consult_task` 只需 question，默认理解和方向校准；可选 entry（understand/rework/improve/verify）、taskType、证据文件。六态决策 CONTINUE / REDIRECT / REWORK / HOLD / APPROVE / ESCALATE 提供结构化建议。APPROVE 本身不等于经验或代码验收通过。无需为每个小步骤重复咨询。
