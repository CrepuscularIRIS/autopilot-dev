// Independent reviewer/investigator tool: local source evidence, never a shell.
import { spawnSync } from 'node:child_process'
import { resolveInsideRoot, executeReadOnlyTool } from './read-tools.js'
import { realpathSync } from 'node:fs'
import { relative, isAbsolute } from 'node:path'

export const INSPECT_TOOL = 'review_inspect'
export const INSPECT_LIMIT = 32
const OPS = ['read','glob','grep','git_status','git_log','git_diff']
const privatePath = path => typeof path === 'string' && path.split(/[\\/]/).some(part =>
  /^(?:\.git|\.env(?:\..*)?|\.ssh|\.aws|\.gnupg|credentials(?:\..*)?|secrets?(?:\..*)?|id_rsa|id_ed25519)$/i.test(part))
const reject = text => ({ok:false,rejected:true,text})
const refOK = value => typeof value === 'string' && /^(?:HEAD(?:~[1-9][0-9]{0,3})?|[0-9a-f]{7,40})$/i.test(value)

export const INSPECT_PARAMETERS = {
  type:'object', additionalProperties:false, required:['operation'],
  properties:{
    operation:{type:'string',enum:OPS,description:'Read source, list/search files, inspect git status/log/diff. No shell or writes.'},
    path:{type:'string',description:'Project-relative file path; required for read and git_diff, optional for grep.'},
    pattern:{type:'string',description:'Glob or regular expression for glob/grep.'},
    startLine:{type:'number'},endLine:{type:'number'},
    base:{type:'string',description:'Optional exact commit SHA, HEAD or HEAD~N for git_diff (default HEAD).'},
    head:{type:'string',description:'Optional exact commit SHA or HEAD; omit to inspect working tree.'},
  },
}

function gitEvidence(root,args) {
  const op=args.operation
  // Do not allow the reviewer to inspect a parent repository outside the session workspace.
  const common=['--literal-pathspecs','-C',root,'-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null']
  const run=tail=>spawnSync('git',[...common,...tail],{encoding:'utf8',timeout:6000,maxBuffer:512*1024,
    env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0',GIT_PAGER:'cat'}})
  try {
    const top=run(['rev-parse','--show-toplevel'])
    if(top.status!==0 || realpathSync(top.stdout.trim())!==realpathSync(root)) return reject('Git repository root is not the workspace root.')
    let tail
    if(op==='git_status')tail=['status','--porcelain=v1','--untracked-files=normal']
    else if(op==='git_log')tail=['log','-n','12','--format=%h %s','--no-decorate']
    else {
      if(!args.path || !resolveInsideRoot(root,args.path) || privatePath(args.path))return reject('git_diff requires a non-private project-relative path.')
      if(args.base!==undefined&&!refOK(args.base)||args.head!==undefined&&!refOK(args.head))return reject('Only exact SHA, HEAD or HEAD~N revisions are allowed.')
      tail=['diff','--no-ext-diff','--no-textconv','--no-renames',args.base||'HEAD',...(args.head?[args.head]:[]),'--',args.path]
    }
    const result=run(tail)
    if(result.status!==0 || result.error)return reject('Git inspection failed or exceeded its bound.')
    const text=String(result.stdout||'')
    return {ok:true,rejected:false,text:text.length>24000?text.slice(0,24000)+'\n[Diff/output truncated; inspect a narrower range.]':text||'[No changes/results]'}
  }catch{return reject('Git inspection unavailable.')}
}

export function inspectIndependent(run,args) {
  args=args||{}
  if(!run?.root || !run.enabled)return reject('Independent local evidence is unavailable.')
  if(run.trace.length>=INSPECT_LIMIT)return reject('Inspection budget reached; report the evidence and gaps.')
  const op=args?.operation
  let result
  if(!OPS.includes(op))result=reject('Unsupported inspection operation.')
  else if(privatePath(args.path) || (args.path && (()=>{try{const abs=resolveInsideRoot(run.root,args.path);return !!abs&&privatePath(relative(realpathSync(run.root),realpathSync(abs)))}catch{return false}})()))result=reject('Private credential paths are not review evidence.')
  else if(op==='read' && typeof args.path !== 'string')result=reject('read requires a source path.')
  else if(op==='grep' && (!args.path || !resolveInsideRoot(run.root,args.path)))result=reject('grep requires a bounded project-relative source directory or file.')
  else if(op.startsWith('git_'))result=gitEvidence(run.root,args)
  else result=executeReadOnlyTool(run.root,op,args)
  if(op==='grep' && result.ok)result={...result,text:String(result.text).split('\n').filter(line=>!privatePath(line.split(':')[0])).join('\n')}
  const row={tool:op,args:{...args},ok:result.ok===true&&!result.rejected,rejected:result.rejected===true,
    resultAvailable:op==='read'&&result.ok===true&&!!result.evidence?.sha256,
    resultLines:String(result.text||'').split('\n').length,evidence:result.evidence||null}
  run.trace.push(row)
  run.onEvent?.({kind:'tool',tool:op,target:args.path||args.pattern||op,ok:row.ok})
  return {ok:row.ok,text:result.text,...(row.resultAvailable?{evidenceRef:result.evidence.ref,sha256:result.evidence.sha256}:{}),remaining:INSPECT_LIMIT-run.trace.length}
}
