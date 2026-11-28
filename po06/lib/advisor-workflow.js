import { readFileSync } from 'node:fs'
import { EN_WORKFLOW } from './english-prompts.js'
const PONYTAIL = readFileSync(new URL('../playbooks/01-ponytail-oss.md', import.meta.url), 'utf8')
  .replace(/<!--[^]*?-->/g, '').trim()

// Stable, compact contract; task-specific advice comes from the capability state.
export const ADVISOR_WORKFLOW = [
 '【PTC 协作流程】轻量摸底，保留用户原话；小修、普通问答直接做（Management by Exception）。影响方案的模糊需求先确认真实目标与限制。',
 '非平凡任务写 Plan 或实质改动前，用 entry="understand" 获取方向、默认值、反例和可测标准，由 Worker 定方案；重大分叉按需再问。长程 Goal 规划的旧 taskType="long_horizon" 仍兼容 Flash。',
 '连续失败 2–3 次停止盲试（Stop-the-Line），entry="rework" 问根因和最小区分实验；复杂故障及恢复难选才用 advisorRoute="investigate",entry="rework" 派 Kimi 只读调查。复现交主会话。GLM 实现、跑相关测试，凭证据核实意见。',
 '普通开发、小修和单测直接完成本地验证；阶段与完整 Goal 由 GLM 对照真实测试、退出码、源码与必要截图核验，不建阶段台账或额外模型核验。',
 '完整变更和测试都就绪后，代码任务交付前合并一次 advisorRoute="review", scope="general"（Sol Review Lite 只读子代理），提交需求、diff、测试与必要截图。Sol 只报告证据支持的问题；GLM 核实、修复、重测。无发现不等于通过；同一任务不重复 Sol，纯讨论、小修、未完成或用户跳过不派。对照完整 Goal 和真实证据后才 update_goal(complete)；历史 verify/long_horizon 兼容终审。',
 'SBAR：await tools.consult_task({entry:"understand",question:"现状；背景；判断；请求"})。原话与相关证据自动附入，默认 Flash；正常 CONTINUE 不重复问，PTC 用 run_code，不切换主模型，用户取消仍有效。',
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
