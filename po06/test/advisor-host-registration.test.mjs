import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

test('installed adviser tool routes normalized tasks independently of the explainer and disposes cleanly',async()=>{
 const home=mkdtempSync(join(tmpdir(),'arbiter-host-')),old=process.env.DSH_HOME
 process.env.DSH_HOME=home
 writeFileSync(join(home,'po06.json'),JSON.stringify({settingsVersion:1,enabled:true,rollout:{mode:'all'},bash:false,readTools:true,
  model:{provider:'litellm',model:'glm-5.4[1m]'},effortByModel:{'litellm/glm-5.4[1m]':'max'}}))
 const effects=[],defs=new Map(),live=new Set()
 const effect=fn=>{const d=fn();if(typeof d==='function')effects.push(d);return d}
 const tools={schemas:()=>[...defs.values()],register:def=>{defs.set(def.name,def);live.add(def.name);return ()=>live.delete(def.name)}}
 const calls=[],children=[]
 let stopReason='error', changeGoalDuringReview=null, performReads=true
 const subagents={async startActivation(spec){
  children.push(spec)
  spec.parent.session.append('subagent/catalog',{childId:spec.childId})
  const packet=spec.prompt.filter(block=>block.type==='text').map(block=>block.text).find(value=>value.startsWith('{"mode":'))
  assert.equal(JSON.parse(packet).stageContract,undefined)
  const child={session:{id:spec.childId,header:{origin:'subagent',agentPreset:'standard'}}}
  const call={name:'review_inspect',agent:child,arguments:{operation:'read',path:'page.html'}}
  assert.equal(guards[0](call),undefined)
  for(const name of ['bash','edit','write','subagent','consult_task'])assert.equal(typeof guards[0]({name,agent:child}),'string')
  if(performReads){
    const read=await defs.get('review_inspect').execute(call.arguments,{agent:child})
    assert.equal(read.ok,true);assert.equal(read.evidenceRef,'read:page.html');assert.match(read.text,/<main>/)
  }
  const refs=performReads?['read:page.html']:['F0']
  const investigation=spec.agentOptions.model==='k3.1-pro'
  const report=investigation?{verdict:'change',summary:'Root cause investigation',findings:[{text:'The main element is present',evidenceRefs:refs}],checks:[],nextStep:'Test the hypothesis',stopCondition:'Evidence resolves hypothesis'}:
    {status:'complete',summary:'Fixture checked.',findings:[],limitations:[]}
  if(!investigation&&JSON.parse(packet).nativeGoal)report.findings=[{text:'Important · page.html:1 · actual failure scenario',evidenceRefs:refs}]
  changeGoalDuringReview?.()
  return {result:Promise.resolve({stopReason,output:[{type:'text',text:JSON.stringify(report)}]}),dispose:async()=>{}}
 }}
 const guards=[]
 tools.guard=guard=>{guards.push(guard);return ()=>{}}
 const attachments={async saveImage({data,mediaType}){return {id:'fixture-image',mediaType,bytes:data.length,width:1,height:1}}}
 writeFileSync(join(home,'page.html'),'<main>Example</main>')
 writeFileSync(join(home,'screen.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jh4cAAAAASUVORK5CYII=','base64'))

 const llm={
  resolveModelInfo:async(_provider,model)=>({inputModalities:model==='gpt-6.2-sol'?['text','image']:['text']}),
  async *stream({provider,model,reasoningEffort,system,messages}){
   calls.push({provider,model,reasoningEffort,system,packet:JSON.parse(messages[0].content[0].text)})
   if(model==='glm-5.4[1m]' && calls.at(-1).packet.goalConsultation==='completion'){
    changeGoalDuringReview?.()
    const report={decision:'APPROVE',summary:'The goal criterion is supported.',findings:[],checks:[{criterion:'The source defines a main element',status:'satisfied',evidenceRefs:['F0']}],nextStep:'finish',stopCondition:'subject changes'}
    yield {type:'text-delta',text:JSON.stringify(report)}
   } else if(model==='glm-5.4[1m]'){
    const contract=JSON.parse(messages[0].content[0].text).stageContract
    const checks=(contract?.checks || []).map(check=>({...check,status:'satisfied',evidenceRefs:['F0']}))
    const report={verdict:'pass',summary:'Fixture checked.',findings:[],checks,nextStep:'advance',stopCondition:'subject changes'}
    yield {type:'text-delta',text:JSON.stringify(report)}
   } else {
    yield {type:'text-delta',text:'Fixture advisory response.'}
   }
  },
 }
 const ctx={effect,inject:(names,cb)=>{if(names[0]==='subagents')return effect(()=>cb({subagents,effect}));
  if(names[0]==='attachments')return effect(()=>cb({attachments,effect}));
  if(names.every(n=>n==='tools'||n==='llm'))return effect(()=>cb({tools,llm,effect}));return ()=>{}},get:name=>name==='tools'?tools:null}
 try{
  const mod=await import('../lib/index.js?stage-registration')
  mod.apply(ctx,{advisorModels:mod.EXAMPLE_ADVISOR_MODELS})
  assert.ok(defs.has('consult_task'));assert.ok(!defs.has('advisor_stage'),'legacy stages are not registered by default')
  assert.ok(typeof mod.adapter.reviewFeedback==='function')
  assert.ok(defs.get('consult_task').parameters.properties.taskId)
  assert.ok(defs.get('consult_task').parameters.properties.mode.enum.includes('improve_result'))
  assert.ok(defs.get('consult_task').parameters.properties.currentResult)
  const advisor=defs.get('consult_task')
  const events=[{type:'user/message',seq:1,data:{id:'request-one',source:{kind:'user'},content:[{type:'text',text:'Verify the implementation.'}]}}]
  const session={id:'advisor-routing',snapshotEvents:()=>events,append(type,data){events.push({type,data,seq:events.length+1})}}
  mod.adapter.enableGate.set(session.id,{enabled:true,code:'test-enabled'})
  const consult=args=>advisor.execute({question:'Check the task.',...args},{agent:{session}})
  await consult({entry:'rework'})
  const plan=await consult({})
  assert.equal(plan.mode,'develop_approach')
  await consult({entry:'understand',taskType:'long_horizon'})
  assert.deepEqual(calls.map(({provider,model,reasoningEffort})=>({provider,model,reasoningEffort})),
   ['deepseek-v4.1-flash','deepseek-v4.1-flash','deepseek-v4.1-flash'].map(model=>({provider:'litellm',model,reasoningEffort:'high'})))
  assert.match(calls[0].system,/NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST/)
  assert.doesNotMatch(calls[0].system,/## Task Right-Sizing/)
  assert.doesNotMatch(calls[1].system,/NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST/)
  assert.doesNotMatch(calls[1].system,/## Task Right-Sizing/)
  const interpreter=await mod.buildInterpreterSystem({home,toolsEnabled:true})
  assert.doesNotMatch(interpreter,/NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST|The best code is the code never written/)
  assert.ok(!defs.has('review_task'))
  session.header={cwd:home}
  // Replaying the old stage requests must never start a model or open a stage loop.
  const intermediate={advisorRoute:'review',entry:'verify',taskId:'legacy-task',stageId:'S2',files:[{path:'page.html',purpose:'Source',evidenceType:'source'}]}
  for(let i=0;i<13;i++)assert.equal((await consult(intermediate)).reason,'local-verification-only')
  assert.equal((await consult({entry:'verify',scope:'code',focus:'Source'})).reason,'local-verification-only')
  assert.equal(calls.length,3);assert.equal(children.length,0)
  const final={advisorRoute:'review',scope:'general',images:[{path:'screen.png',purpose:'Rendered main',evidenceType:'runtime-capture'}]}
  const unsuccessful=await consult(final)
  assert.notEqual(unsuccessful.reviewPassed,true)
  assert.equal((await consult(final)).reason,'final-review-already-attempted')
  assert.equal(children.length,1,'a failed review still spends the task attempt')
  const continued=mod.adapter.capability.beginInput(session.id,'followup','Continue the same task.')
  mod.adapter.capability.settle(session.id,continued,{understanding:{summary:'Continue.',relation:'continue'}})
  session.append('user/message',{id:'followup',source:{kind:'user'},content:[{type:'text',text:'Continue the same task.'}]})
  assert.equal((await consult(final)).reason,'final-review-already-attempted')
  const next=mod.adapter.capability.beginInput(session.id,'request-two','Verify the new implementation.')
  mod.adapter.capability.settle(session.id,next,{understanding:{summary:'New task.',relation:'new'}})
  session.append('user/message',{id:'request-two',source:{kind:'user'},content:[{type:'text',text:'Verify the new implementation.'}]})
  stopReason='completed'
  const completed=await consult(final)
  assert.equal((await consult(final)).reason,'final-review-already-attempted')
  assert.equal(completed.model,'litellm/gpt-6.2-sol',JSON.stringify(completed))
  assert.equal(completed.reviewStatus,'no-findings',JSON.stringify(completed))
  assert.equal(completed.reviewPassed,false)
  assert.equal(completed.disposition,'independent-review-only')
  assert.equal(completed.independentInspection.successfulReads,1)
  assert.equal(completed.independentInspection.citesIndependentEvidence,false,'no findings do not require citation; actual read trace still proves inspection')
  assert.equal(calls.length,3,'neither final attempt used the direct LLM stream')
  assert.equal(children.length,2,'one Sol child per task including follow-ups')
  for(const child of children){
   assert.equal(child.agentOptions.model,'gpt-6.2-sol')
   assert.equal(child.agentPreset,'standard')
   assert.match(child.childId,/^session-wish-review-[a-f0-9-]+$/)
   assert.match(child.prompt[0].text,/NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE/)
   assert.match(child.prompt[0].text,/scope → find → challenge → report/)
   assert.match(child.prompt[0].text,/never edit files/)
   assert.equal(child.agentOptions.reasoningEffort,'medium')
   assert.doesNotMatch(child.prompt[0].text,/Codex rubric|六态|21 项/)
   assert.ok(child.prompt.some(block=>block.type==='image' && block.attachment.id==='fixture-image'))
   const text=child.prompt.find(block=>block.type==='text' && block.text.startsWith('{"mode":')).text
   assert.equal(JSON.parse(text).snapshot.historyPolicy,'final-explicit-evidence-only')
  }
  const guarded={id:children[0].childId,header:{origin:'subagent',agentPreset:'ptc'}}
  assert.equal(typeof guards[0]({agent:{session:guarded}}),'string')
  assert.equal(guards[0]({agent:{session:{id:'regular-child',header:guarded.header}}}),undefined)
  assert.equal(typeof guards[0]({name:'subagent',arguments:{model:'gpt-6.2-sol'},agent:{session}}),'string')
  assert.equal(guards[0]({name:'subagent',arguments:{model:'glm-5.4[1m]'},agent:{session}}),undefined)
  // Old whole-Goal verification is redirected to the same single independent final review (no GLM checklist).
  const goal={id:'goal-native',revision:1,objective:'The source defines a main element',phase:'active',maxGoalRounds:16}
  const request={entry:'verify',taskType:'long_horizon',files:[{path:'page.html',purpose:'Actual source',evidenceType:'source'}]}
  assert.equal((await consult(request)).reason,'active-native-goal-required')
  session.append('goal/change',{kind:'goal/change',goal,roundsStarted:0})
  session.append('user/message',{source:{kind:'goal',goalId:goal.id,revision:1,round:1},content:[{type:'text',text:'Continue native goal.'}]})
  const actual=await consult(request)
  assert.equal(actual.model,'litellm/gpt-6.2-sol',JSON.stringify(actual))
  assert.equal(actual.reviewStatus,'findings',JSON.stringify(actual))
  assert.equal(actual.reviewPassed,false)
  assert.equal(actual.independentInspection.successfulReads,1)
  assert.equal(actual.goalAssessment,undefined)
  assert.equal(actual.report.checks.length,0,'lite review does not build an acceptance checklist')
  assert.equal(actual.recording,undefined,'final review is not a legacy coverage/advance gate')
  assert.equal((await consult(request)).reason,'final-review-already-attempted')
  assert.equal((await consult({advisorRoute:'review',scope:'general'})).reason,'final-review-already-attempted')
  assert.equal(calls.length,3,'no GLM review at all')
  assert.equal(children.length,3)
  const investigation=await consult({entry:'rework',advisorRoute:'investigate',question:'Find the cause and recovery path'})
  assert.equal(investigation.model,'litellm/k3.1-pro')
  assert.equal(investigation.independentInspection.successfulReads,1)
  assert.notEqual(investigation.reviewPassed,true)
  assert.match(children.at(-1).childId,/^session-wish-investigate-/)
  assert.equal(typeof guards[0]({name:'subagent',arguments:{model:'k3.1-pro'},agent:{session}}),'string')
  session.append('goal/change',{kind:'goal/change',goal:{...goal,id:'goal-changed',revision:1},roundsStarted:0})
  changeGoalDuringReview=()=>session.append('goal/change',{kind:'goal/change',goal:{...goal,id:'goal-changed',revision:2,objective:'Updated goal'},roundsStarted:0})
  const stale=await consult({advisorRoute:'review',scope:'general'})
  assert.equal(stale.reviewScopeChanged,true)
  assert.notEqual(stale.reviewPassed,true)
  assert.equal(stale.reviewStatus,'incomplete')
  changeGoalDuringReview=null
  session.append('goal/change',{kind:'goal/change',goal:{...goal,id:'goal-second',revision:1},roundsStarted:0})
  performReads=false
  const unread=await consult({advisorRoute:'review',scope:'general',files:[{path:'page.html',purpose:'Source'}]})
  assert.notEqual(unread.reviewPassed,true)
  assert.equal(unread.independentInspection.successfulReads,0)
  assert.equal(unread.report.decision,'HOLD')
  assert.equal(unread.reviewStatus,'incomplete')
  session.append('goal/change',{kind:'goal/change',goal:{...goal,id:'goal-source-changed',revision:1},roundsStarted:0})
  performReads=true
  changeGoalDuringReview=()=>writeFileSync(join(home,'page.html'),'<main>Changed after inspection</main>')
  const staleSource=await consult({advisorRoute:'review',scope:'general'})
  assert.equal(staleSource.reviewStatus,'incomplete')
  assert.match(staleSource.report.limitations.join(' '),/源码已变化/)
  assert.equal(staleSource.report.findings[0].unverified,true)
  changeGoalDuringReview=null
  assert.equal(typeof guards[0]({name:'review_inspect',agent:{session}}),'string')
  for(const dispose of effects.reverse())dispose()
  assert.ok(!live.has('advisor_stage'));assert.ok(!live.has('consult_task'))
  assert.equal(mod.adapter.reviewFeedback,null)
 }finally{process.env.DSH_HOME=old;rmSync(home,{recursive:true,force:true})}
})

test('Lite report never turns empty findings or unsupported claims into acceptance',async()=>{
 const {parseLiteReviewReport,acceptanceBanner}=await import('../lib/advisor.js')
 const wrap=(findings,refs,status='complete')=>parseLiteReviewReport(JSON.stringify({status,summary:'Scoped review',findings,limitations:[]}),refs)
 const none=wrap([],['read:page.html'])
 assert.equal(none.reviewStatus,'no-findings')
 assert.equal(none.report.checks.length,0)
 assert.notEqual(none.report.verdict,'pass')
 assert.match(acceptanceBanner({mode:'review_result',finalReview:true,...none}),/不是完成验收/)
 assert.equal(wrap([],[]).reviewStatus,'incomplete')
 const unsupported=wrap([{text:'Potential defect',evidenceRefs:['read:never-read.js']}],['read:page.html'])
 assert.equal(unsupported.reviewStatus,'incomplete')
 assert.equal(unsupported.report.findings[0].unverified,true)
 assert.match(unsupported.report.findings[0].text,/未核实/)
 const supported=wrap([{text:'Important · page.html:1 · failure trigger',evidenceRefs:['read:page.html']}],['read:page.html'])
 assert.equal(supported.reviewStatus,'findings')
 assert.equal(wrap([],['read:page.html'],'incomplete').reviewStatus,'incomplete')
 assert.equal(parseLiteReviewReport('not structured',[]).reviewStatus,'incomplete')
})
