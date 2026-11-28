import test from 'node:test'
import assert from 'node:assert/strict'
import { createMetaSupervisor, parseMetaReply, inferMeta } from '../lib/meta-supervisor.js'

function fixture(opts={}) {
  let seq=0,time=1000
  const events=[],calls=[],logs=[]
  const session={id:'s',snapshotEvents:()=>events}
  let response=()=>Promise.resolve('on_track'),enabled=true
  const supervisor=createMetaSupervisor({infer:x=>{calls.push(x);return response(x)},enabled:()=>enabled,log:x=>logs.push(x),now:()=>time,kimiStartMs:0,...opts})
  const emit=(type,data={})=>{const e={type,data,seq:++seq,time};events.push(e);supervisor.observe(session,e)}
  const step=(data={})=>{emit('tool/result',{message:{content:[{type:'text',text:'ok'}]},...data});emit('step/end');time+=1000}
  const user=text=>emit('user/message',{source:{kind:'user'},content:[{type:'text',text}]})
  const goal=(revision=1,objective='Original Goal',phase='active')=>emit('goal/change',{goal:{id:'g',revision,objective,phase}})
  const todo=(status='in_progress')=>emit('todo/write',{todos:[{content:'build feature',status}]})
  const flush=()=>new Promise(r=>setImmediate(r))
  return {supervisor,session,calls,logs,user,goal,todo,step,emit,flush,response:f=>response=f,enable:v=>enabled=v,advance:n=>time+=n}
}
test('three-state response, no JSON or empty action accepted',()=>{
  assert.deepEqual(parseMetaReply('on_track'),{action:'on_track',text:''})
  assert.equal(parseMetaReply('note: check actual tests').action,'note')
  assert.equal(parseMetaReply('steer: simplify').action,'steer')
  for(const x of ['APPROVE','{"action":"steer"}','steer: ','anything'])assert.equal(parseMetaReply(x),null)
})
test('TODO starts async Flash, completed TODO triggers further professional elaboration without Kimi',async()=>{
  const f=fixture()
  f.user('add accessible dashboard')
  f.response(()=>Promise.resolve('steer: test keyboard focus'))
  f.todo();f.step()
  assert.equal(f.calls.length,0,'event never awaits/invokes inference synchronously')
  await f.flush()
  assert.equal(f.calls[0].model,'deepseek-v4.1-flash')
  assert.equal(f.calls[0].payload.reason,'todo-transition')
  for(const term of ['Domain Lens','Pre-mortem','Second-Order Thinking'])assert.ok(f.calls[0].system.includes(term))
  assert.doesNotMatch(f.calls[0].system,/5 Whys|JTBD|EARS|GORE|Standard of Care/)
  assert.equal(f.supervisor.take(f.session).length,1)
  assert.equal(f.supervisor.take(f.session).length,0)
  f.response(()=>Promise.resolve('note: check empty state'))
  f.todo('completed')
  for(let i=0;i<6;i++)f.step()
  await f.flush()
  assert.equal(f.calls.length,2)
  assert.equal(f.supervisor.take(f.session).length,0)
  assert.equal(f.supervisor.notes(f.session).length,2)
})
test('goal orientation uses Kimi once; later authorized semantics retain original; low-frequency cooldown',async()=>{
  const f=fixture({kimiMs:10000,kimiMax:2})
  f.user('original user wish');f.goal();f.todo();f.step();await f.flush()
  assert.deepEqual(f.calls.map(x=>x.model),['deepseek-v4.1-flash','k3.1-pro'])
  assert.match(f.calls[1].system,/Rolling Wave Planning/)
  assert.match(f.calls[1].system,/Chesterton’s Fence/)
  assert.doesNotMatch(f.calls[1].system,/GORE|KAOS|GQM|Receding Horizon Control|EARS|5 Whys/)
  f.user('authorized refinement');f.goal(2,'Refined Goal');f.todo();f.step();await f.flush()
  assert.equal(f.calls.filter(x=>x.model==='k3.1-pro').length,1)
  f.advance(12000);f.todo('completed');f.step();await f.flush()
  const k=f.calls.filter(x=>x.model==='k3.1-pro')
  assert.equal(k.length,2)
  assert.equal(k[1].payload.originalGoal,'Original Goal')
  assert.equal(k[1].payload.currentGoal,'Refined Goal')
  assert.equal(k[1].payload.originalUser,'original user wish')
  assert.equal(k[1].payload.latestUser,'authorized refinement')
})
test('new request or revised Goal invalidates stale async reply; silence has no notice',async()=>{
  const f=fixture()
  let resolve
  f.response(()=>new Promise(r=>resolve=r))
  f.user('first');f.todo();f.step();await f.flush()
  f.user('second');resolve('steer: old task');await f.flush()
  assert.equal(f.supervisor.take(f.session).length,0)
  assert.equal(f.supervisor.notes(f.session).length,0)
  f.response(()=>Promise.resolve('on_track'))
  f.todo();f.step();await f.flush()
  assert.equal(f.supervisor.take(f.session).length,0)
})
test('two distinct protocol failures trigger without duplicate root/PTC count or raw command output',async()=>{
  const f=fixture()
  f.user('repair')
  for(let i=0;i<2;i++){
    f.emit('tool/ptc-dispatch',{name:'consult_task',arguments:{command:'private secret'},content:[{type:'text',text:'claim-evidence-metadata-invalid'}]})
    f.step({message:{content:[{type:'text',text:'claim-evidence-metadata-invalid'}]}})
    await f.flush()
    if(i===0)assert.equal(f.calls.length,0)
  }
  assert.equal(f.calls.length,1)
  assert.equal(f.calls[0].payload.reason,'advisor-protocol')
  assert.match(f.calls[0].system,/5 Whys 和最小区分实验/)
  assert.ok(!JSON.stringify(f.calls[0].payload).includes('private secret'))
})
test('ordinary conversation, disabled mode, inactive goal remain quiet; fallback only after real work',async()=>{
  const f=fixture()
  f.user('hello');f.emit('step/end');await f.flush();assert.equal(f.calls.length,0)
  for(let i=0;i<2;i++)f.step()
  await f.flush();assert.equal(f.calls.length,0)
  f.step();await f.flush();assert.equal(f.calls.length,1)
  f.enable(false);f.todo();f.step();await f.flush();assert.equal(f.calls.length,1)
})
test('native stream uses fixed model, no tools, short isolated request',async()=>{
  let options
  const llm={stream:o=>{options=o;return(async function*(){yield{type:'text-delta',text:'note: one finding'}})()}}
  assert.equal(await inferMeta(llm,{model:'k3.1-pro',system:'role',payload:{goal:'g'},signal:new AbortController().signal}),'note: one finding')
  assert.equal(options.provider,'litellm')
  assert.equal(options.model,'k3.1-pro')
  assert.equal(options.tools,undefined)
})
test('durable Goal attempt budget survives reload and old notes never become new steering',async()=>{
  const calls=[]
  const events=[
    {type:'user/message',seq:1,data:{source:{kind:'user'},content:[{type:'text',text:'goal wish'}]}},
    {type:'goal/change',seq:2,data:{goal:{id:'g',revision:1,objective:'goal',phase:'active'}}},
  ]
  const session={id:'s',snapshotEvents:()=>events}
  const rows=[
    ...Array.from({length:3},()=>({status:'start',goalId:'g',revision:1,requestId:'1',role:'kimi',time:1})),
    {status:'steer',goalId:'g',revision:1,requestId:'1',role:'flash',text:'prior correction'}
  ]
  const m=createMetaSupervisor({restore:()=>rows,infer:async x=>{calls.push(x);return'on_track'}})
  m.observe(session,{type:'todo/write',seq:3,time:500,data:{todos:[{content:'new work',status:'in_progress'}]}})
  m.observe(session,{type:'step/end',seq:4,time:501,data:{}})
  await new Promise(r=>setImmediate(r))
  assert.equal(calls.filter(x=>x.model==='k3.1-pro').length,0)
  assert.equal(m.take(session).length,0)
  assert.equal(m.notes(session)[0].text,'prior correction')
})
test('multi-proposal protocol, long concrete explanations, secret redaction',()=>{
 const long='具体案例'.repeat(500)
 const parsed=parseMetaReply('[do] (focus) '+long+' token=sk-test123456789\n[mention] (lens) useful context\n[propose] (new direction) cost tradeoff\n[note] (review) check actual tests')
 assert.equal(parsed.items.length,4)
 assert.ok(parsed.items[0].text.length>1400)
 assert.doesNotMatch(parsed.items[0].text,/sk-test123456789/)
 assert.deepEqual(parsed.items.map(x=>x.action),['do','mention','propose','note'])
})
test('proposal exits: only do enters intermediate pre-step, note only Sol, mention summary, proposal explicit user choice',async()=>{
 const notifications=[]
 const f=fixture({notify:x=>notifications.push(x)})
 f.user('feature');f.response(()=>Promise.resolve('[do] (small) implement within scope\n[mention] (mapping) explain analogy\n[propose] (new pattern) new feature needs decision\n[note] (risk) inspect actual test'))
 f.todo();f.step();await f.flush()
 assert.deepEqual(f.supervisor.take(f.session).map(x=>x.action),['do'])
 assert.deepEqual(f.supervisor.notes(f.session).map(x=>x.action),['do','note'])
 assert.equal(notifications[0].kind,'proposal')
 const row=f.supervisor.store.list('s').find(x=>x.action==='propose')
 assert.equal(f.supervisor.store.status('s',row.id,'rejected').ok,true)
 f.todo('completed');f.step();await f.flush()
 assert.deepEqual(f.supervisor.take(f.session).map(x=>x.action),['mention'])
 assert.equal(f.supervisor.store.list('s').filter(x=>x.action==='propose').length,1)
 for(let i=0;i<2;i++)f.step()
 await f.flush()
 assert.ok(f.calls.at(-1).payload.rejectedTopics.includes('new pattern'))
 assert.equal(f.supervisor.store.list('s').filter(x=>x.action==='propose').length,1)
})
test('generic cold-start domain draft cached, does not automatically promote',async()=>{
 const f=fixture()
 f.user('new domain');f.response(()=>Promise.resolve('[lens] method A; method B\n[mention] (choice) compare methods'))
 f.todo();f.step();await f.flush()
 assert.equal(f.calls[0].payload.cachedDomainDimensions,null)
 assert.equal(f.supervisor.lenses.list().drafts.length,1)
 f.todo('completed');for(let i=0;i<2;i++)f.step()
 await f.flush()
 assert.equal(f.calls.at(-1).payload.cachedDomainDimensions,'method A; method B')
 assert.equal(f.supervisor.lenses.list().domains.length,0)
})
test('end-of-turn summary when no final-ready pre-step, never force an extra model turn',async()=>{
 const notifications=[]
 const f=fixture({notify:x=>notifications.push(x)})
 f.user('feature');f.response(()=>Promise.resolve('[mention] (angle) another perspective'))
 f.todo();f.step();await f.flush()
 assert.equal(f.supervisor.take(f.session).length,0)
 f.emit('turn/end');assert.equal(notifications[0].kind,'summary')
 assert.equal(f.supervisor.store.list('s')[0].status,'summarized')
})
test('late do after ordinary turn end expires without injecting in a later step',async()=>{
 const f=fixture();let resolve
 f.user('work');f.response(()=>new Promise(r=>resolve=r))
 f.todo();f.step();await f.flush()
 f.emit('turn/end')
 resolve('[do] (late fix) late suggestion');await f.flush()
 assert.equal(f.supervisor.take(f.session).length,0)
 assert.equal(f.supervisor.store.list('s')[0].status,'expired')
 assert.equal(f.supervisor.notes(f.session).length,0)
})
test('pending do is expired on ordinary turn end or a new request',async()=>{
 const f=fixture();f.user('work');f.response(()=>Promise.resolve('[do] (fix) fix this'))
 f.todo();f.step();await f.flush();f.emit('turn/end')
 assert.equal(f.supervisor.take(f.session).length,0)
 assert.equal(f.supervisor.store.list('s')[0].status,'expired')
})
test('all TODOs must really be done; reopening pending work revokes final-ready',async()=>{
 const f=fixture();f.user('work');f.response(()=>Promise.resolve('[mention] (angle) useful context'))
 f.todo();f.step();await f.flush()
 f.emit('todo/write',{todos:[...Array.from({length:24},(_,i)=>({content:'item '+i,status:'completed'})),{content:'remaining',status:'pending'}]})
 assert.equal(f.supervisor.take(f.session).length,0)
 f.emit('todo/write',{todos:[{content:'one',status:'completed'}]})
 f.emit('todo/write',{todos:[{content:'one',status:'completed'},{content:'new',status:'pending'}]})
 assert.equal(f.supervisor.take(f.session).length,0)
 f.emit('todo/write',{todos:[{content:'one',status:'completed'},{content:'new',status:'completed'}]})
 assert.equal(f.supervisor.take(f.session)[0].action,'mention')
})
test('Goal note survives user refinement and reload without injecting old do',async()=>{
 const f=fixture();f.user('initial');f.goal()
 f.response(x=>Promise.resolve(x.model==='k3.1-pro'?'on_track':'[note] (risk) actual audit lead'))
 f.todo();f.step();await f.flush()
 f.user('refinement');f.goal(2,'Refined Goal')
 assert.equal(f.supervisor.notes(f.session)[0].text,'actual audit lead')
 assert.equal(f.supervisor.notes(f.session)[0].earlierGoalRevision,true)
 const reload=createMetaSupervisor({store:f.supervisor.store,infer:async()=> 'on_track'})
 assert.equal(reload.notes(f.session)[0].text,'actual audit lead')
 assert.equal(reload.take(f.session).length,0)
})
test('Kimi goal request does not receive domain lens or create lens draft',async()=>{
 const f=fixture();f.user('research work');f.goal()
 f.response(x=>Promise.resolve(x.model==='k3.1-pro'?'[lens] (wrong) do not persist':'[lens] (right) useful domain'))
 f.todo();f.step();await f.flush()
 const k=f.calls.find(x=>x.model==='k3.1-pro')
 assert.equal(k.payload.domainLens,undefined)
 assert.equal(k.payload.cachedDomainDimensions,undefined)
 assert.equal(f.supervisor.lenses.list().drafts.length,1)
 assert.match(f.supervisor.lenses.list().drafts[0].text,/right/)
})
test('abort terminates local await even if upstream stream never yields',async()=>{
 const c=new AbortController()
 const task=inferMeta({stream:()=>({[Symbol.asyncIterator](){return {next:()=>new Promise(()=>{})}}})},{model:'deepseek-v4.1-flash',system:'s',payload:{},signal:c.signal})
 c.abort(new Error('cancel fixture'))
 await assert.rejects(task,/cancel fixture/)
})
test('paused Goal rehydration does not silently restart Flash or Kimi',async()=>{
 const events=[{type:'user/message',seq:1,data:{source:{kind:'user'},content:[{type:'text',text:'goal'}]}},{type:'goal/change',seq:2,data:{goal:{id:'g',revision:2,phase:'paused',objective:'goal'}}}]
 const session={id:'s',snapshotEvents:()=>events},calls=[]
 const m=createMetaSupervisor({infer:async x=>{calls.push(x);return'on_track'}})
 m.observe(session,{type:'todo/write',seq:3,data:{todos:[{content:'work',status:'in_progress'}]}})
 m.observe(session,{type:'step/end',seq:4,data:{}})
 await new Promise(r=>setImmediate(r))
 assert.equal(calls.length,0)
})
test('failed preparation does not wedge the one-in-flight slot',async()=>{
 let fail=true
 const lenses={select(){if(fail){fail=false;throw new Error('fixture preparation failure')}return {name:'generic',text:'generic'}},draft(){}}
 const f=fixture({lenses});f.user('work');f.todo()
 assert.throws(()=>f.step(),/fixture preparation failure/)
 f.step();await f.flush()
 assert.equal(f.calls.length,1)
})
test('reading an old failed log does not trigger a fresh failure consultation',async()=>{
 const f=fixture({flashFirst:10});f.user('inspect historical test log')
 for(let i=0;i<2;i++){
   f.emit('tool/ptc-dispatch',{name:'read',arguments:{path:'old.log'},content:[{type:'text',text:'FAILED old_test exit code 1'}],isError:false})
   f.step({message:{content:[{type:'text',text:'FAILED old_test exit code 1'}]}})
   await f.flush()
 }
 assert.equal(f.calls.length,0)
})
test('plugin-only work or cleared Goal cannot start supervision without a current task',async()=>{
 const f=fixture();f.todo();for(let i=0;i<4;i++)f.step();await f.flush()
 assert.equal(f.calls.length,0)
 f.user('goal');f.goal();f.todo();f.step();await f.flush()
 assert.equal(f.calls.length,2)
 f.emit('goal/change',{operation:'clear',goal:null});f.todo()
 for(let i=0;i<4;i++)f.step()
 await f.flush();assert.equal(f.calls.length,2)
})
test('pre-step preparation does not claim delivery until the notice is built',async()=>{
 const f=fixture();f.user('work');f.response(()=>Promise.resolve('[do] (fix) tiny fix'))
 f.todo();f.step();await f.flush()
 const ready=f.supervisor.take(f.session,{commit:false})
 assert.equal(ready.length,1)
 assert.equal(f.supervisor.store.list('s')[0].status,'pending')
 f.supervisor.abandon(f.session,ready)
 assert.equal(f.supervisor.store.list('s')[0].status,'expired')
})
test('Flash receives only task-selected card excerpts and source identity; Kimi does not receive domain cards',async()=>{
 const queries=[]
 const lenses={
  select:()=>({name:'stockcard',text:'D14 research'}),
  readCards:(session,q)=>{queries.push(q);return q.includes('样本外')?[{id:'D14',source:'/fixture/D14.md',path:'D14.md',sha256:'a'.repeat(64),text:'actual conditions',complete:true}]:[]},
  draft(){}
 }
 const f=fixture({lenses})
 f.user('original goal');f.goal()
 f.emit('todo/write',{todos:[{content:'样本外 validation',status:'in_progress'}]})
 f.step();await f.flush()
 const flash=f.calls.find(x=>x.model==='deepseek-v4.1-flash'),kimi=f.calls.find(x=>x.model==='k3.1-pro')
 assert.equal(flash.payload.domainCards[0].text,'actual conditions')
 assert.equal(flash.payload.domainCards[0].id,'D14')
 assert.match(flash.system,/cite card IDs/)
 assert.equal(kimi.payload.domainCards,undefined)
 assert.match(queries[0],/样本外/)
 assert.equal(f.logs.find(x=>x.status==='start'&&x.role==='flash').domainCards[0].id,'D14')
})

test('every background call has an explicit terminal record even if all suggestions are duplicates',async()=>{
 const f=fixture({flashEvery:1,flashGap:1})
 f.response(()=>Promise.resolve('[mention] (same) verify actual result'))
 f.user('task');f.todo();f.step();await f.flush()
 f.advance(10);f.step();await f.flush()
 const starts=f.logs.filter(x=>x.status==='start')
 const ends=f.logs.filter(x=>['complete','on_track','invalid-output','failed','cancelled'].includes(x.status))
 assert.equal(starts.length,2)
 assert.equal(ends.length,2)
 assert.equal(ends[0].outcome,'proposals')
 assert.equal(ends[1].outcome,'no-new-proposals')
 assert.deepEqual(ends.map(x=>x.runId),starts.map(x=>x.runId))
})
test('Goal Kimi cancellation has a terminal event, not a dangling start',async()=>{
 const f=fixture()
 f.response(()=>new Promise(()=>{}))
 f.user('task');f.goal();f.todo();f.step();await f.flush()
 const start=f.logs.find(x=>x.role==='kimi'&&x.status==='start')
 assert.ok(start)
 f.supervisor.dispose()
 assert.equal(f.logs.find(x=>x.runId===start.runId&&x.status==='cancelled')?.status,'cancelled')
})

test('Kimi records on-track and timeout separately from returned suggestions',async()=>{
 const a=fixture()
 a.user('task');a.goal();a.todo();a.step();await a.flush()
 const row=a.logs.find(x=>x.role==='kimi'&&x.status==='on_track')
 assert.ok(row?.runId)
 const b=fixture()
 b.response(x=>x.model==='k3.1-pro'?Promise.reject(new DOMException('deadline','TimeoutError')):Promise.resolve('on_track'))
 b.user('task');b.goal();b.todo();b.step();await b.flush()
 assert.ok(b.logs.find(x=>x.role==='kimi'&&x.status==='timeout')?.runId)
})

test('production Kimi waits ten hours of Goal age, resets do not advance the deadline',async()=>{
 const f=fixture({kimiStartMs:10*60*60_000})
 f.user('task');f.goal();f.todo();f.step();await f.flush()
 assert.equal(f.calls.filter(x=>x.model==='k3.1-pro').length,0)
 f.advance(10*60*60_000-2000);f.step();await f.flush()
 assert.equal(f.calls.filter(x=>x.model==='k3.1-pro').length,0)
 f.user('same goal clarification');f.step();await f.flush()
 assert.equal(f.calls.filter(x=>x.model==='k3.1-pro').length,1)
 assert.equal(f.logs.find(x=>x.role==='kimi'&&x.status==='start').reason,'long-horizon-checkpoint')
})

test('portable sidecar route uses the configured provider/model and leaves missing routes silent',async()=>{
 const f=fixture({routeFor:(_s,role)=>role==='flash'?{provider:'vendor',model:'fast',reasoningEffort:'low'}:null})
 f.user('generic task');f.goal();f.todo();f.step();await f.flush()
 assert.equal(f.calls.length,1)
 assert.equal(f.calls[0].provider,'vendor')
 assert.equal(f.calls[0].model,'fast')
 assert.equal(f.calls[0].reasoningEffort,'low')
 assert.ok(f.calls[0].payload.domainLens)
 assert.equal(f.calls[0].payload.domainCards,undefined)
})
