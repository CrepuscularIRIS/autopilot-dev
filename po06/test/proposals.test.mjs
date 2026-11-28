import test from 'node:test'
import assert from 'node:assert/strict'
import {createProposalStore,createLensRegistry,sameTopic} from '../lib/proposals.js'
test('generic by default even in Stock; curated example explicitly imported and bound',async()=>{
 const registry=createLensRegistry()
 const session={header:{cwd:'/tmp/Stock'}}
 assert.equal(registry.select(session).name,'generic')
 const text='D14 research validation; D17 factor risk; D18 portfolio exposure.'
 assert.equal(registry.importLens({name:'stock',text,source:'synthetic fixture',keywords:['回测','因子投资']}).ok,true)
 assert.equal(registry.select(session).name,'generic')
 assert.equal(registry.select({header:{cwd:'/tmp/other'}},'进行因子投资回测').name,'stock')
 assert.equal(registry.search('回测')[0].name,'stock')
 assert.equal(registry.bind({cwd:'/tmp/Stock',name:'stock'}).ok,true)
 assert.equal(registry.select({header:{cwd:'/tmp/Stock/sub'}}).name,'stock')
 assert.equal(registry.select({header:{cwd:'/tmp/other'}}).name,'generic')
 registry.draft({sessionId:'s',requestId:'r',goalId:null,text:'candidate domain dimension'})
 assert.equal(registry.list().drafts.length,1)
 assert.equal(registry.list().domains.length,1,'draft does not become global lens')
})
test('durable scope isolation, stable semantic topic and user decisions',()=>{
 const events=[],scope={sessionId:'s',goalId:'g',requestId:'r',revision:1}
 const p=createProposalStore({write:e=>events.push(e)})
 const item=p.add(scope,{action:'propose',topic:'factor risk',text:'Consider risk',role:'flash'})
 assert.ok(item.id)
 assert.equal(p.status('other',item.id,'accepted').ok,false)
 assert.equal(p.status('s',item.id,'rejected').ok,true)
 assert.equal(p.add({...scope,revision:2},{action:'propose',topic:'Factor-risk',text:'same topic'}),null)
 const restored=createProposalStore({read:()=>events.map(e=>JSON.stringify(e)).join('\n')})
 assert.equal(restored.list('s')[0].status,'rejected')
 assert.equal(restored.add({...scope,goalId:'g2'},{action:'propose',topic:'factor risk',text:'new goal'}).status,'pending')
 assert.equal(sameTopic('Factor-risk','factor risk'),true)
})
test('summary is one-shot, proposal stays pending and mentions are not marked implemented',()=>{
 const p=createProposalStore(),s={sessionId:'s',requestId:'r',goalId:null}
 p.add(s,{action:'mention',topic:'one',text:'one'})
 p.add(s,{action:'propose',topic:'two',text:'two'})
 assert.equal(p.summary(s,'turn:1').length,2)
 assert.equal(p.summary(s,'turn:1').length,0)
 assert.deepEqual(p.list('s').map(x=>x.status),['summarized','pending'])
})
test('control API import, query, bind, decisions; rejects writes without existing write header',async()=>{
 const {createControlHandler,API_PREFIX}=await import('../lib/control-api.js')
 const {EventEmitter}=await import('node:events')
 const {mkdtempSync}=await import('node:fs')
 const {tmpdir}=await import('node:os')
 const {join}=await import('node:path')
 const reg=createLensRegistry(),store=createProposalStore()
 const row=store.add({sessionId:'session1',goalId:'g',requestId:'r'},{action:'propose',topic:'new',text:'proposal'})
 const h=createControlHandler({home:mkdtempSync(join(tmpdir(),'wish-proposal-test-')),lensList:()=>reg.list(),lensSearch:q=>reg.search(q),lensImport:v=>reg.importLens(v),lensBind:v=>reg.bind(v),proposals:s=>store.list(s),proposalDecision:v=>store.status(v.sessionId,v.id,v.decision)})
 async function invoke(method,path,body,write=true){
   const req=new EventEmitter();Object.assign(req,{method,url:API_PREFIX+path,headers:{host:'127.0.0.1',...(write?{'x-po06':'1'}:{})},destroy(){}})
   let result,status
   const res={writeHead(n){status=n},end(v){result=JSON.parse(v)}}
   setImmediate(()=>{if(body)req.emit('data',Buffer.from(JSON.stringify(body)));req.emit('end')})
   await h(req,res);return {status,result}
 }
 const input={name:'engineering',source:'fixture',text:'contracts, edge cases',keywords:['contracts']}
 assert.equal((await invoke('POST','/lens-import',input,false)).status,403)
 assert.equal((await invoke('POST','/lens-import',input)).status,200)
 assert.equal((await invoke('GET','/lenses?query=contracts')).result.domains[0].name,'engineering')
 assert.equal((await invoke('POST','/lens-bind',{cwd:'/workspace/a',name:'engineering'})).status,200)
 assert.equal(reg.select({header:{cwd:'/workspace/a/sub'}}).name,'engineering')
 assert.equal((await invoke('POST','/proposal-decision',{sessionId:'others',id:row.id,decision:'accepted'})).status,400)
 assert.equal((await invoke('POST','/proposal-decision',{sessionId:'session1',id:row.id,decision:'rejected'})).status,200)
 assert.equal((await invoke('GET','/proposals?session=session1')).result.items[0].status,'rejected')
})
test('acceptance is an explicit decision, but only current request/Goal revision can receive automatic steering',async()=>{
 const {canQueueProposal}=await import('../lib/proposals.js')
 const old={goalId:'g1',revision:1,requestId:'1'}
 assert.equal(canQueueProposal(old,{activeGoal:null,lastHumanSeq:2}),false)
 assert.equal(canQueueProposal(old,{activeGoal:{id:'g2',revision:1}}),false)
 assert.equal(canQueueProposal(old,{activeGoal:{id:'g1',revision:2}}),false)
 assert.equal(canQueueProposal(old,{activeGoal:{id:'g1',revision:1}}),true)
 assert.equal(canQueueProposal({goalId:null,requestId:'2'},{lastHumanSeq:2}),true)
 assert.equal(canQueueProposal({goalId:null,requestId:'2'},{lastHumanSeq:2,goalAfterRequest:true}),false)
 assert.equal(canQueueProposal({goalId:null,requestId:'1'},{lastHumanSeq:2}),false)
})
test('a review note is not suppressed just because a lower-priority mention used the same topic; denied and unaccepted directions remain protected',()=>{
 const p=createProposalStore(),s={sessionId:'s',goalId:'g',requestId:'r'}
 const mention=p.add(s,{action:'mention',topic:'test coverage',text:'test idea'})
 const note=p.add(s,{action:'note',topic:'test coverage',text:'actual review lead'})
 assert.ok(note);assert.notEqual(note.id,mention.id)
 assert.equal(p.add(s,{action:'note',topic:'test coverage',text:'duplicate'}),null)
 const pending=p.add(s,{action:'propose',topic:'new module',text:'proposal'})
 assert.equal(p.add(s,{action:'do',topic:'new module',text:'not accepted'}),null)
 p.status('s',pending.id,'rejected')
 assert.equal(p.add(s,{action:'note',topic:'new module',text:'denied'}),null)
})
test('short English keywords do not match unrelated substrings; malformed local registry safely falls back',async()=>{
 const {mkdtempSync,writeFileSync}=await import('node:fs')
 const {tmpdir}=await import('node:os')
 const {join}=await import('node:path')
 const path=join(mkdtempSync(join(tmpdir(),'wish-lens-audit-')),'lenses.json')
 writeFileSync(path,JSON.stringify({domains:null,bindings:[],drafts:[null]}))
 const r=createLensRegistry({path})
 assert.equal(r.select({header:{cwd:'/tmp'}}).name,'generic')
 assert.equal(r.list().drafts.length,0)
 r.importLens({name:'ai',text:'domain',source:'fixture',keywords:['AI','ai']})
 assert.equal(r.select({},'train schedule').name,'generic')
 assert.equal(r.search('AI model')[0].score,1)
})
test('bound local domain card library reads real registered files only, including after source updates',async()=>{
 const {mkdtempSync,writeFileSync,mkdirSync,symlinkSync}=await import('node:fs')
 const {tmpdir}=await import('node:os')
 const {join}=await import('node:path')
 const src=mkdtempSync(join(tmpdir(),'wish-card-library-'))
 const root=join(src,'cards'),registryPath=join(src,'registry.json')
 mkdirSync(root)
 writeFileSync(join(root,'D14.md'),'# Research validation\nsource conditions and limits.')
 writeFileSync(join(src,'outside.md'),'outside fixture')
 symlinkSync(join(src,'outside.md'),join(root,'outside.md'))
 const r=createLensRegistry({path:registryPath})
 const input={name:'stockcard',text:'D14 research',source:'fixture',keywords:['StockCard'],boundOnly:true,library:{root,cards:[
  {id:'D14',path:'D14.md',keywords:['样本外','回测']},{id:'outside',path:'outside.md',keywords:['outside']}
 ]}}
 assert.equal(r.importLens({...input,library:{root,cards:[{id:'bad',path:'../outside.md',keywords:['bad']}]}}).ok,false)
 assert.equal(r.importLens(input).ok,true)
 assert.equal(r.bind({cwd:'/fixture/Stock',name:'stockcard'}).ok,true)
 assert.equal(r.select({header:{cwd:'/fixture/Other'}},'StockCard').name,'generic')
 assert.deepEqual(r.readCards({header:{cwd:'/fixture/Other'}},'D14'),[])
 const session={header:{cwd:'/fixture/Stock/sub'}}
 const [card]=r.readCards(session,'D14 样本外')
 assert.equal(card.id,'D14')
 assert.match(card.text,/source conditions/)
 assert.equal(card.complete,true)
 assert.deepEqual(r.readCards(session,'outside'),[])
 writeFileSync(join(root,'D14.md'),'# Updated source')
 const reopened=createLensRegistry({path:registryPath})
 const [updated]=reopened.readCards(session,'D14')
 assert.match(updated.text,/Updated source/)
 assert.notEqual(updated.sha256,card.sha256)
})
