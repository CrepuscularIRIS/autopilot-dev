import { readFileSync } from 'node:fs'
import { EN_WORKFLOW } from './english-prompts.js'
const PONYTAIL = readFileSync(new URL('../playbooks/01-ponytail-oss.md', import.meta.url), 'utf8')
  .replace(/<!--[^]*?-->/g, '').trim()

// Stable, compact contract; task-specific advice comes from the capability state.
export const ADVISOR_WORKFLOW = [
 '【PTC 协作流程 · Cognitive Mode Switching】',
 'Orient：轻量摸底，保留用户原话；微小修正、简单问答按 Management by Exception 直接做，不为咨询而咨询。',
 'Intent Alignment：需求简短或模糊且会影响方案时，先用 entry="understand" 问 Gricean Pragmatics + JTBD + XY Problem：真实目标、隐含边界和错误假设是什么。',
 'Intent Elaboration：非平凡任务在写 Plan 或实质改动前必须先问 Advisor 如何做（Ask "How" before Plan），用 entry="understand" 按 ISO/IEC/IEEE 29148 + EARS + Sprint Contract + Impact × Uncertainty 获取方案、默认值、反例和可测 DoD；结合意见由 Worker 落 Plan。重大分叉再问一次。长程 Goal 规划用 taskType="long_horizon" 让 Advisor 校准完整目标。',
 'Karpathy 执行：Think Before Coding、Simplicity First、Surgical Changes、Goal-Driven Execution。Bounded Autonomy：细节自主；No Surprises、Fail-Fast：连续失败 2–3 次 Stop-the-Line，entry="rework" 问 Advisor 根因与区分实验。复杂故障根因不明/恢复难选才用 advisorRoute="investigate",entry="rework" 派 Investigator 独立取证；复现交 Worker。用 Constructive Dissent / Two-Challenge Rule 核实顾问意见，凭证据反驳。',
 'Quality Calibration：关键阶段或交付前用 Standard of Care + Fitness for Purpose + Pre-mortem / Red Teaming + Independent V&V (IEEE 1012) + Definition of Done 校准。Worker 实现、跑相关测试、看真实截图并读退出码；普通开发、小修和单测直接完成本地验证。仅真实阶段依赖用 advisor_stage：start_task、define_stage；entry="verify" 带 taskId、stageId 与证据交 Worker 核验，补验先 activate_stage，通过才 advance。',
 '完整变更和测试都就绪后，代码任务交付前合并一次 advisorRoute="review", scope="general"（只读 Reviewer），附 diff 范围、测试与必要截图；Reviewer 独立读源码和 Git。Worker 对照源码核实意见、修复并重测；同一原生 Goal/任务不重复 Reviewer，纯讨论、小修、未完成或用户跳过则不派。原生 Goal 由 Worker 对照完整目标与实证逐项核对，缺口未闭合继续做；必要时 entry="verify",taskType="long_horizon" 补核（Worker），完成才 update_goal(complete)，不每轮咨询。',
 'SBAR：await tools.consult_task({entry:"understand",question:"S现状；B背景；A判断；R请以领域专家身份指出关键根因/最优路线、反例与可测标准"})；原话、近期证据与旧账自动附入；默认 Advisor，旧路由兼容。正常 CONTINUE 不重复问。PTC 中通过 run_code 调用，不切换主会话模型，用户取消仍有效。',
].join('\n')
// Keep the upstream core rules visible to the Worker from the very first assembly.
const WORKER_STANDARDS = [
  '[Superpowers · Worker core rules]',
  'Systematic Debugging: NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST. Form Single Hypothesis; Test Minimally; Verify Before Continuing.',
  'Verification Before Completion: NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE. IDENTIFY → RUN → READ → VERIFY → ONLY THEN claim.',
  'Requesting Code Review: supply the original requirements, current diff and actual verification evidence for one independent final review when warranted.',
  'Receiving Code Review: Verify before implementing. Ask before assuming. Technical correctness over social comfort. Check against codebase reality; implement one item at a time and test each.',
].join('\n')

export function withAdvisorWorkflow(packet,policy,feedback='',dynamic='',workflow) {
 // 顾问关掉时**整段不出现**：否则模型会看到“用 consult_task 复核”的指示，
 // 而工具根本没注册（2026-10-23 改成注册层硬关闭后的配套）。
 if(policy?.injectPacket!==true)return String(packet || '')
 if(policy?.advisor===false)return String(packet || '')
 return [(workflow || (policy.englishMode?EN_WORKFLOW:ADVISOR_WORKFLOW)),WORKER_STANDARDS,PONYTAIL,dynamic || String(packet || ''),dynamic ? '' : feedback].filter(Boolean).join('\n\n')
}
