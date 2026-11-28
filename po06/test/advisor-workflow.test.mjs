import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ADVISOR_PARAMETERS, ADVISOR_TIMEOUT_MS, ADVISOR_TIMEOUT_MIN_MS, ADVISOR_TIMEOUT_MAX_MS, resolveAdvisorTimeoutMs, ADVISOR_SYSTEM } from '../lib/advisor.js'
import { ADVISOR_WORKFLOW, withAdvisorWorkflow } from '../lib/advisor-workflow.js'

test('the compact workflow assigns local tests and stage checks to GLM and reserves Sol for final review', () => {
  assert.ok(ADVISOR_WORKFLOW.length < 1700)
  assert.match(ADVISOR_WORKFLOW, /GLM 实现、跑相关测试/)
  assert.match(ADVISOR_WORKFLOW, /阶段与完整 Goal 由 GLM 对照真实测试/)
  for (const action of ['start_task', 'define_stage', 'activate_stage', 'advance']) assert.ok(!ADVISOR_WORKFLOW.includes(action))
  assert.match(ADVISOR_WORKFLOW, /完整变更和测试都就绪.*合并一次 advisorRoute="review", scope="general"/)
  assert.match(ADVISOR_WORKFLOW, /GLM 核实、修复、重测/)
  assert.match(ADVISOR_WORKFLOW, /await tools.consult_task/)
  assert.match(ADVISOR_WORKFLOW, /用户取消仍有效/)
})
test('context contribution honors off gate and includes bounded feedback only when enabled',()=>{
 const active = withAdvisorWorkflow('',{injectPacket:true})
 assert.ok(active.startsWith(ADVISOR_WORKFLOW))
 assert.match(active, /# Ponytail/)
 assert.doesNotMatch(active, /Task Right-Sizing|NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST/)
 assert.ok(withAdvisorWorkflow('packet',{injectPacket:true},'stage').endsWith('packet\n\nstage'))
 assert.equal(withAdvisorWorkflow('packet',{injectPacket:false},'stage'),'packet')
 assert.equal(withAdvisorWorkflow('packet',undefined,'stage'),'packet')
})
test('顾问限时：默认 5 分钟；环境变量可调并钳制；报告长度设上限',()=>{
  assert.equal(ADVISOR_TIMEOUT_MS, null, '用户要求默认不设总截止')
  assert.equal(resolveAdvisorTimeoutMs({}), ADVISOR_TIMEOUT_MS, '没设环境变量就用默认')
  assert.equal(resolveAdvisorTimeoutMs({ DSH_PO06_ADVISOR_TIMEOUT_MS: '600000' }), 600000, '合法值原样采纳')
  assert.equal(resolveAdvisorTimeoutMs({ DSH_PO06_ADVISOR_TIMEOUT_MS: '1' }), 1, '显式截止不钳制')
  assert.equal(resolveAdvisorTimeoutMs({ DSH_PO06_ADVISOR_TIMEOUT_MS: '99999999' }), 99999999, '显式截止不钳制')
  assert.equal(resolveAdvisorTimeoutMs({ DSH_PO06_ADVISOR_TIMEOUT_MS: 'abc' }), ADVISOR_TIMEOUT_MS, '非法值回落默认，不静默变 0')
  assert.equal(resolveAdvisorTimeoutMs({ DSH_PO06_ADVISOR_TIMEOUT_MS: '-5' }), ADVISOR_TIMEOUT_MS, '负数也是非法值')
  // 长输出是超时主因之一：提示词里必须有长度纪律，否则放宽限时只是把超时往后推
  // 2026-10-19 用户要求"点到为止"：长度纪律从 6/8 收紧到 findings ≤ 3、checks 只写阶段契约项。
  assert.ok(/正常 CONTINUE 极短/.test(ADVISOR_SYSTEM))
  assert.ok(/结论先行，说人话/.test(ADVISOR_SYSTEM))
  assert.ok(/不要罗列小修小补/.test(ADVISOR_SYSTEM))
})

test('顾问schema不含宿主已确认不支持的maxItems，必填字段和模式保留',()=>{
  // The host renderer was directly checked during diagnosis: maxItems => unknown.
  // Keep this test portable; a standalone node test is not a running DSH host.

  assert.equal(ADVISOR_PARAMETERS.properties.artifacts.maxItems,undefined)
  // 2026-10-20：mode 降为兼容别名（新调用用 entry），必填只剩 question。
  assert.deepEqual(ADVISOR_PARAMETERS.required,['question'])
  // develop_approach 是 2026-10-05 增加的第三个用途（独立解题）；它不计入验收通过，见 advisor.js 的 completionClaimAllowed。
  assert.deepEqual(ADVISOR_PARAMETERS.properties.mode.enum,['diagnose_failure','review_result','develop_approach','improve_result'])
})

test('three advisory triggers and compact SBAR are injected in either language, never when off',()=>{
 for(const englishMode of [false,true]){
  const prompt=withAdvisorWorkflow('original',{injectPacket:true,advisor:true,englishMode})
  for(const key of ['entry','understand','rework','investigate','review','SBAR','long_horizon','update_goal(complete)','Stop-the-Line','Management by Exception']) assert.ok(prompt.includes(key),key)
  assert.equal(withAdvisorWorkflow('original',{injectPacket:true,advisor:false,englishMode},'ledger'),'original')
 }
})

test('first prompt without an intent packet includes Worker core standards in both languages',()=>{
 for(const englishMode of [false,true]){
   const initial=withAdvisorWorkflow('',{injectPacket:true,advisor:true,englishMode})
   for(const rule of ['# Ponytail','NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST','NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE','Requesting Code Review','Receiving Code Review','Verify before implementing','Check against codebase reality','SBAR']) assert.ok(initial.includes(rule),rule)
   assert.equal(withAdvisorWorkflow('',{injectPacket:true,advisor:false,englishMode}),'')
 }
})

test('phase-local anchors; worker gets exactly one workflow and no retired catalog terms',async()=>{
 const {OPTIMIZER_CORE}=await import('../lib/optimizer-protocol.js')
 const {contributionSystem}=await import('../lib/advisor-contribution.js')
 const {META_WORKFLOW}=await import('../lib/meta-supervisor.js')
 const retired=/Gricean Pragmatics|29148|EARS|Sprint Contract|GORE|KAOS|GQM|Standard of Care|Fitness for Purpose|Independent V&V|Requirements Traceability|Receding Horizon Control/
 for(const englishMode of [false,true]){
   const core=OPTIMIZER_CORE[englishMode?'en':'zh']
   for(const term of ['JTBD','XY Problem','Take / Borrow / Build','Management by Exception'])assert.ok(core.includes(term),term)
   assert.doesNotMatch(core,retired)
   assert.doesNotMatch(contributionSystem('develop_approach',englishMode),retired)
   const fallback=withAdvisorWorkflow('',{injectPacket:true,advisor:true,englishMode})
   const active=withAdvisorWorkflow('',{injectPacket:true,advisor:true,englishMode},'','',META_WORKFLOW)
   assert.doesNotMatch(fallback,retired)
   assert.doesNotMatch(active,retired)
   assert.ok(active.startsWith(META_WORKFLOW))
   assert.equal(active.split('【PTC 自动专业补全】').length,2)
   assert.doesNotMatch(active,/\[PTC collaboration workflow\]|【PTC 协作流程】/)
   assert.match(active,/不暴露内部方法论黑话/)
 }
 assert.doesNotMatch(ADVISOR_SYSTEM,retired)
})
