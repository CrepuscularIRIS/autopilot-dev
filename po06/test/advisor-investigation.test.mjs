import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,readFileSync,symlinkSync,rmSync,mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {inspectIndependent,INSPECT_LIMIT} from '../lib/advisor-investigation.js'

const git=(root,args)=>spawnSync('git',['-C',root,...args],{encoding:'utf8'})
test('independent inspection returns actual version-bound source and read-only Git evidence',()=>{
 const root=mkdtempSync(join(tmpdir(),'wish-independent-'))
 try{
  assert.equal(git(root,['init','-q']).status,0)
  writeFileSync(join(root,'page.js'),'const old = 1;\n')
  assert.equal(git(root,['add','page.js']).status,0)
  assert.equal(git(root,['-c','user.name=fixture','-c','user.email=fixture@example.test','commit','-qm','fixture']).status,0)
  writeFileSync(join(root,'page.js'),'const changed = 2;\n')
  const run={root,enabled:true,trace:[]}
  const actual=inspectIndependent(run,{operation:'read',path:'page.js'})
  assert.equal(actual.ok,true);assert.match(actual.text,/changed = 2/);assert.match(actual.sha256,/^[a-f0-9]{64}$/)
  assert.equal(actual.evidenceRef,'read:page.js');assert.equal(run.trace[0].resultAvailable,true)
  const diff=inspectIndependent(run,{operation:'git_diff',path:'page.js'})
  assert.equal(diff.ok,true);assert.match(diff.text,/\+const changed = 2/)
  assert.match(inspectIndependent(run,{operation:'git_status'}).text,/page.js/)
  assert.match(inspectIndependent(run,{operation:'git_log'}).text,/fixture/)
  assert.equal(readFileSync(join(root,'page.js'),'utf8'),'const changed = 2;\n')
  assert.equal(inspectIndependent(run,{operation:'git_diff',path:'page.js',base:'--output=bad'}).ok,false)
 }finally{rmSync(root,{recursive:true,force:true})}
})
test('independent review denies shell, writes, out-of-root paths and credential aliases, and bounds call count',()=>{
 const root=mkdtempSync(join(tmpdir(),'wish-independent-denials-'))
 const outside=mkdtempSync(join(tmpdir(),'wish-independent-outside-'))
 try{
  writeFileSync(join(root,'.env'),'FIXTURE_SECRET=never-read')
  writeFileSync(join(outside,'outside.txt'),'outside')
  symlinkSync(join(root,'.env'),join(root,'alias.txt'))
  symlinkSync(join(outside,'outside.txt'),join(root,'outside.txt'))
  const run={root,enabled:true,trace:[]}
  for(const args of [{operation:'bash',command:'write'},{operation:'write',path:'page.js'},{operation:'read',path:'.env'},{operation:'read',path:'alias.txt'},{operation:'read',path:'outside.txt'},{operation:'read',path:join(outside,'outside.txt')}]){
   const r=inspectIndependent(run,args)
   assert.equal(r.ok,false);assert.doesNotMatch(r.text,/FIXTURE_SECRET/)
  }
  assert.equal(inspectIndependent(null,{operation:'read',path:'page.js'}).ok,false)
  assert.equal(inspectIndependent({...run,enabled:false},{operation:'read',path:'page.js'}).ok,false)
  run.trace.length=INSPECT_LIMIT
  assert.equal(inspectIndependent(run,{operation:'read',path:'page.js'}).ok,false)
 }finally{rmSync(root,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true})}
})
