import test from 'node:test'
import assert from 'node:assert/strict'
import {createCollaborationLedger,mergeCollaborationRuns} from '../lib/meta-supervisor.js'
test('history groups actual calls, preserves details and distinguishes unknown old results',()=>{
 const l=createCollaborationLedger({now:()=>500000})
 const base={sessionId:'s',trigger:'meta-supervisor',role:'kimi',model:'k3.1-pro',time:1}
 l.ingest({...base,status:'start',runId:'a'})
 l.ingest({...base,status:'complete',runId:'a',ms:900,outcome:'no-new-proposals',items:[]})
 l.ingest({...base,status:'start',time:2})
 l.ingest({...base,sessionId:'other',status:'start',runId:'b'})
 l.ingest({sessionId:'s',trigger:'intercept-start',runId:'w',at:new Date(3).toISOString()})
 l.ingest({sessionId:'s',trigger:'intercept',runId:'w',ok:true,ms:25,model:'deepseek-v4.1-flash',toolCalls:2,interpretHead:'draft'})
 l.ingest({sessionId:'s',trigger:'intercept-result',runId:'w',ok:true,ms:30,summary:'actual packet'})
 const rows=l.list('s')
 assert.equal(rows.length,3)
 assert.equal(rows[0].summary,'actual packet')
 assert.equal(rows[0].tools,2)
 assert.equal(rows[1].status,'unknown')
 assert.equal(rows[1].ms,null)
 assert.equal(rows[2].outcome,'no-new-proposals')
 assert.equal(l.list('other').length,1)
})

test('historical final review has one row when matching persisted detailed result',()=>{
 const old={id:'old',legacy:true,kind:'review',model:'litellm/gpt-6.2-sol',status:'complete',startedAt:1000,ms:10000}
 const result={id:'run',kind:'review',model:old.model,status:'complete',startedAt:1070,ms:9930,summary:'finding'}
 const rows=mergeCollaborationRuns([old],[result])
 assert.equal(rows.length,1)
 assert.equal(rows[0].id,'run')
 assert.equal(rows[0].summary,'finding')
 assert.equal(mergeCollaborationRuns([{...old,startedAt:1}],[{...result,startedAt:4000}]).length,2)
})
