import test from 'node:test'
import assert from 'node:assert/strict'
import {
  OPTIMIZER_OUTPUT_BUDGET_TOKENS,
  OPTIMIZER_CORE,
  OPTIMIZER_PROMPT_REVISION,
  composeOptimizerSystem,
} from '../lib/optimizer-protocol.js'
import {
  LOOP_DEFAULT_ROUNDS,
  LOOP_HARD_MAX_ROUNDS,
  LOOP_BUDGET_MS,
  MAX_RESULT_CHARS,
  EXTERNAL_TOOL_SCHEMAS,
  TOOL_SCHEMAS,
  executeExternalReadOnlyTool,
  runReadOnlyToolLoop,
} from '../lib/read-tools.js'
import { readToolsFor, resolveAdvisorModelRoute, advisorRole } from '../lib/index.js'
import { ADVISOR_PARAMETERS } from '../lib/advisor.js'

test('budgets and protocol rules are relaxed and fused with intent-scout', () => {
  assert.equal(OPTIMIZER_OUTPUT_BUDGET_TOKENS, 8000)
  assert.equal(OPTIMIZER_PROMPT_REVISION, 'intent-scout-wish-4')
  assert.equal(LOOP_DEFAULT_ROUNDS, 6)
  assert.equal(LOOP_HARD_MAX_ROUNDS, 12)
  assert.equal(LOOP_BUDGET_MS, 150000)
  assert.equal(MAX_RESULT_CHARS, 8000)
  assert.ok(OPTIMIZER_CORE.zh.includes('三层意图对齐漏斗'))
  assert.ok(OPTIMIZER_CORE.zh.includes('GPL/AGPL/SSPL'))
  assert.ok(OPTIMIZER_CORE.zh.includes('最强反例'))
  assert.ok(TOOL_SCHEMAS.some((t) => t.name === 'github_search'))
  assert.ok(TOOL_SCHEMAS.some((t) => t.name === 'github_inspect'))
  const sys = composeOptimizerSystem({ language: 'zh', tier: 'heavy', toolsEnabled: true })
  assert.ok(sys.text.includes('8000'))
})

test('readToolsFor enables external-only mode when cwd is absent', () => {
  assert.equal(readToolsFor({ readTools: false, cwd: '/tmp' }).enabled, false)
  const ext = readToolsFor({ readTools: true, cwd: '' })
  assert.equal(ext.enabled, true)
  assert.equal(ext.reason, 'external-only')
  assert.equal(ext.allowExternalWithoutRoot, true)
})

test('executeExternalReadOnlyTool handles search, inspect, validation, and offline failure cleanly', async () => {
  const mockGh = async (args) => {
    if (args[0] === 'search' && args[1] === 'repos') {
      return JSON.stringify([{
        fullName: 'acme/opt-lib',
        description: 'Fast optimizer',
        stargazersCount: 1200,
        pushedAt: '2026-11-10T00:00:00Z',
        license: { spdxId: 'MIT' },
        isArchived: false,
        url: 'https://github.com/acme/opt-lib',
      }])
    }
    if (args[0] === 'api' && args[1] === 'repos/acme/opt-lib') {
      return JSON.stringify({
        full_name: 'acme/opt-lib',
        html_url: 'https://github.com/acme/opt-lib',
        description: 'Fast optimizer',
        stargazers_count: 1200,
        open_issues_count: 12,
        archived: false,
        default_branch: 'main',
        pushed_at: '2026-11-10T00:00:00Z',
        license: { spdx_id: 'MIT' },
      })
    }
    if (args[0] === 'api' && args[1] === 'repos/acme/opt-lib/releases?per_page=5') {
      return JSON.stringify([{ tag_name: 'v2.1.0', published_at: '2026-11-01T00:00:00Z' }])
    }
    if (args[0] === 'api' && args.includes('repos/acme/opt-lib/contents/LICENSE')) {
      return 'MIT License\nCopyright 2026 Acme'
    }
    throw new Error('unexpected gh args: ' + args.join(' '))
  }

  const s = await executeExternalReadOnlyTool('github_search', { query: 'bayesian opt' }, { runGh: mockGh })
  assert.equal(s.ok, true)
  assert.ok(s.text.includes('acme/opt-lib'))
  assert.ok(s.text.includes('lic=MIT'))

  const m = await executeExternalReadOnlyTool('github_inspect', { repo: 'acme/opt-lib', action: 'meta' }, { runGh: mockGh })
  assert.equal(m.ok, true)
  assert.ok(m.text.includes('v2.1.0'))

  const f = await executeExternalReadOnlyTool('github_inspect', { repo: 'acme/opt-lib', action: 'file', path: 'LICENSE' }, { runGh: mockGh })
  assert.equal(f.ok, true)
  assert.ok(f.text.includes('1: MIT License'))

  const bad = await executeExternalReadOnlyTool('github_inspect', { repo: '../evil', action: 'meta' }, { runGh: mockGh })
  assert.equal(bad.ok, false)
  assert.equal(bad.rejected, true)

  const offline = await executeExternalReadOnlyTool('github_search', { query: 'x' }, {
    runGh: async () => { throw new Error('network unreachable') },
  })
  assert.equal(offline.ok, false)
  assert.equal(offline.rejected, false)
  assert.ok(offline.text.includes('[未核实:'))
})

test('runReadOnlyToolLoop works without root when allowExternalWithoutRoot is true', async () => {
  let seenTools = null
  let round = 0
  const llm = {
    stream(req) {
      round += 1
      if (round === 1) seenTools = req.tools
      return (async function* () {
        if (round === 1) {
          yield {
            type: 'block-end',
            block: { type: 'tool-call', id: 'c1', name: 'github_search', arguments: JSON.stringify({ query: 'quant ui' }) },
          }
          yield { type: 'finish', finish: 'tool-calls' }
        } else {
          yield { type: 'text-delta', text: '{"intent":{"text":"做量化前端","relation":"new"},"add":["Adopt acme/quant-ui"],"scaffold":[],"ask":[]}' }
          yield { type: 'finish', finish: 'stop' }
        }
      })()
    },
  }
  const shape = {
    ok: true,
    mod: {
      createAssistantMessage: (content) => ({ role: 'assistant', content }),
      createToolResultMessage: (id, content) => ({ role: 'tool', toolCallId: id, content }),
    },
  }
  const res = await runReadOnlyToolLoop({
    llm,
    cfg: { provider: 'litellm', model: 'deepseek-v4.1-flash' },
    system: 'sys',
    messages: [{ role: 'user', content: [{ type: 'text', text: '做量化前端' }] }],
    root: '',
    allowExternalWithoutRoot: true,
    shape,
    runGh: async () => JSON.stringify([{ fullName: 'acme/quant-ui', description: 'UI', stargazersCount: 99, pushedAt: '2026-11-15', license: { spdxId: 'MIT' }, isArchived: false, url: 'https://github.com/acme/quant-ui' }]),
  })
  assert.equal(res.ok, true)
  assert.equal(seenTools.length, EXTERNAL_TOOL_SCHEMAS.length)
  assert.deepEqual(res.names, ['github_search'])
  assert.ok(res.text.includes('acme/quant-ui'))
})

// ── review 2026-11-22：参数注入、无 cwd 说明与网络失败短路 ──
const fakeShape = {
  ok: true,
  mod: {
    createAssistantMessage: (content) => ({ role: 'assistant', content }),
    createToolResultMessage: (id, content) => ({ role: 'tool', toolCallId: id, content }),
  },
}

test('github_search puts the query after "--" so dash-prefixed queries are never parsed as gh flags', async () => {
  const seen = []
  const runGh = async (args) => { seen.push(args); return '[]' }
  await executeExternalReadOnlyTool('github_search', { query: '--web' }, { runGh })
  await executeExternalReadOnlyTool('github_search', { query: '-label:wontfix crash', type: 'issues', repo: 'acme/x' }, { runGh })
  for (const args of seen) {
    const dd = args.indexOf('--')
    assert.ok(dd > 0, 'has -- separator: ' + args.join(' '))
    assert.equal(dd, args.length - 2, 'query is the only token after --')
  }
  assert.equal(seen[0].at(-1), '--web')
  assert.ok(seen[1].includes('--repo'))
})

test('no-cwd loop gets a GitHub-only tool note; local loop keeps the local note', async () => {
  const systems = []
  const llm = { stream(req) { systems.push(req.system); return (async function* () {
    yield { type: 'text-delta', text: '{"intent":{"text":"x","relation":"new"},"add":[],"scaffold":[],"ask":[]}' }
    yield { type: 'finish', finish: 'stop' }
  })() } }
  const base = { llm, cfg: {}, system: 'sys', messages: [], shape: fakeShape, rootListing: false }
  await runReadOnlyToolLoop({ ...base, root: '', allowExternalWithoutRoot: true })
  await runReadOnlyToolLoop({ ...base, root: process.cwd() })
  assert.ok(systems[0].includes('仅 GitHub') && !systems[0].includes('只用 read/glob/grep/run'))
  assert.ok(systems[1].includes('read/glob/grep/run'))
  for (const s of systems) assert.ok(s.includes('JSON'), 'tool note ends with a JSON reminder')
})

test('a network-level gh failure short-circuits later external calls in the same loop', async () => {
  let ghCalls = 0
  let round = 0
  const llm = { stream() { round += 1; const r = round; return (async function* () {
    if (r <= 2) {
      yield { type: 'block-end', block: { type: 'tool-call', id: 'c' + r, name: 'github_search', arguments: JSON.stringify({ query: 'q' + r }) } }
      yield { type: 'finish', finish: 'tool-calls' }
    } else {
      yield { type: 'text-delta', text: '{"intent":{"text":"x","relation":"new"},"add":["[未核实: 离线]"],"scaffold":[],"ask":[]}' }
      yield { type: 'finish', finish: 'stop' }
    }
  })() } }
  const runGh = async () => { ghCalls += 1; const e = new Error('Command failed: gh'); e.killed = true; throw e }
  const res = await runReadOnlyToolLoop({ llm, cfg: {}, system: 's', messages: [], root: '', allowExternalWithoutRoot: true,
    shape: fakeShape, runGh, rejectPolicy: 'retry-once' })
  assert.equal(ghCalls, 1, 'second external call must not hit gh again')
  assert.equal(res.trace[1].rejected, true)
  assert.equal(res.ok, true)
})

test('advisor task roles select a fixed model or reject a conflicting route', () => {
  assert.deepEqual(ADVISOR_PARAMETERS.properties.advisorRoute.enum, ['default', 'architecture', 'review','investigate'])
  const cfg = model => ({ ok: true, provider: 'litellm', model, reasoningEffort: 'high' })
  assert.deepEqual(resolveAdvisorModelRoute({ mode: 'improve_result' }), cfg('deepseek-v4.1-flash'))
  assert.deepEqual(resolveAdvisorModelRoute({ mode: 'develop_approach', advisorRoute: 'architecture' }), cfg('deepseek-v4.1-flash'))
  for (const args of [{}, { scope: 'code' }, { scope: 'delivery', advisorRoute: 'review' },
    { scope: 'general', advisorRoute: 'review', taskId: 'task', stageId: 'S1' },
    { scope: 'code', advisorRoute: 'review' }, { advisorRoute: 'review' }]) {
    assert.deepEqual(resolveAdvisorModelRoute({ mode: 'review_result', ...args }), cfg(args.taskId ? 'glm-5.4[1m]' : 'deepseek-v4.1-flash'))
  }
  assert.deepEqual(resolveAdvisorModelRoute({ mode: 'review_result', advisorRoute: 'review', scope: 'general' }), cfg('gpt-6.2-sol'))
  assert.deepEqual(resolveAdvisorModelRoute({ mode: 'review_result', advisorRoute: 'architecture', images: [{ path: 'a.png' }] }),
    cfg('glm-5.4[1m]'))
  assert.deepEqual(resolveAdvisorModelRoute({ mode: 'improve_result', advisorRoute: 'review' }),
    { ok: false, reason: 'advisor-route-requires-review' })
})

test('three-model advisor routes whole Goal planning to Flash and verification to GLM',()=>{
 for(const mode of ['develop_approach','improve_result','diagnose_failure','review_result']){
   for(const taskType of ['web_3d','visual','multimodal']) assert.equal(resolveAdvisorModelRoute({mode,taskType}).model,'deepseek-v4.1-flash')
   assert.equal(resolveAdvisorModelRoute({mode,taskType:'long_horizon'}).model,mode==='review_result'?'glm-5.4[1m]':'deepseek-v4.1-flash')
   assert.equal(resolveAdvisorModelRoute({mode,advisorRoute:'architecture'}).model,'deepseek-v4.1-flash')
 }
 assert.equal(resolveAdvisorModelRoute({mode:'review_result',scope:'appearance'}).model,'glm-5.4[1m]')
 assert.equal(resolveAdvisorModelRoute({mode:'develop_approach',images:[{path:'view.png'}]}).model,'glm-5.4[1m]')
 assert.equal(resolveAdvisorModelRoute({mode:'develop_approach',taskType:'other'}).ok,false)
})

test('Kimi is only an explicit independent investigation route, never a default or final review',()=>{
 for(const mode of ['develop_approach','diagnose_failure'])assert.equal(resolveAdvisorModelRoute({mode,advisorRoute:'investigate'}).model,'k3.1-pro')
 for(const mode of ['improve_result','review_result'])assert.equal(resolveAdvisorModelRoute({mode,advisorRoute:'investigate'}).ok,false)
 assert.equal(resolveAdvisorModelRoute({mode:'diagnose_failure',taskType:'long_horizon'}).model,'deepseek-v4.1-flash')
})

test('portable routes use configured provider/model, not the model name for role or review identity',()=>{
 const observed={provider:'local',model:'worker-model'}
 const models={advisor:{provider:'vendor-a',model:'fast-model',reasoningEffort:'medium'},review:{provider:'vendor-b',model:'review-model'},investigate:{provider:'vendor-c',model:'research-model'}}
 const opts={models,observed}
 assert.deepEqual(resolveAdvisorModelRoute({mode:'develop_approach'},opts),{ok:true,provider:'vendor-a',model:'fast-model',reasoningEffort:'medium'})
 assert.deepEqual(resolveAdvisorModelRoute({mode:'review_result',scope:'general',advisorRoute:'review'},opts),{ok:true,provider:'vendor-b',model:'review-model'})
 assert.deepEqual(resolveAdvisorModelRoute({mode:'review_result',taskId:'T',stageId:'S'},opts),{ok:true,...observed})
 assert.deepEqual(resolveAdvisorModelRoute({mode:'diagnose_failure',advisorRoute:'investigate'},opts),{ok:true,provider:'vendor-c',model:'research-model'})
 assert.deepEqual(resolveAdvisorModelRoute({mode:'develop_approach'},{models:{},observed}),{ok:true,...observed})
 assert.equal(resolveAdvisorModelRoute({mode:'develop_approach'},{models:{}}).ok,false)
 const shared={models:{advisor:observed,review:observed},observed}
 assert.deepEqual(resolveAdvisorModelRoute({mode:'develop_approach'},shared),resolveAdvisorModelRoute({mode:'review_result',scope:'general',advisorRoute:'review'},shared))
 assert.equal(advisorRole({mode:'develop_approach'}).role,'advisor')
 assert.equal(advisorRole({mode:'review_result',scope:'general',advisorRoute:'review'}).role,'review')
})
