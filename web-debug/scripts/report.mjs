import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {VERSION,options,required,readText,writeFile,writeJSON,acquireLock,assertDistinctPaths} from './common.mjs';

export const ORIGINS=['skill-code','skill-guidance','external-knowledge','provider','project','unknown'];
const OWNED=new Set(['skill-code','skill-guidance']);
const STATUSES=['new','needs-info','confirmed','in-progress','resolved','duplicate'];
const KINDS=['bug','compatibility','security','feedback'];
const COMPONENTS=['chrome','plan','diagnostics','project','analyze','copy','edge','github','windows','knowledge','install','report','instructions','other'];
const INPUT_KEYS=['title','kind','suspectedOrigin','component','affectedVersion','summary','expected','actual','steps','evidence','environment'];
const ENV_KEYS=['agent','node','platform','browser','provider','providerVersion'];
const ID=/^wd-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const VERSION_RE=/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const object=(value,label)=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${label} must be an object`);};
function keys(value,allowed,label){object(value,label);for(const key of Object.keys(value))if(!allowed.includes(key))throw new Error(`Unknown ${label} field: ${key}`);}
function choice(value,allowed,label){if(!allowed.includes(value))throw new Error(`Invalid ${label}; choose ${allowed.join(', ')}`);return value;}
function identifier(value){if(typeof value!=='string'||!ID.test(value))throw new Error('Use the exact wd-UUID report ID');return value;}

// Best-effort minimization only. Never promise arbitrary prose or evidence is secret-free.
export function redactText(value,stats={changes:0}) {
  let result=value;
  const replace=(pattern,replacement)=>{result=result.replace(pattern,(...args)=>{const next=typeof replacement==='function'?replacement(...args):replacement;if(next!==args[0])stats.changes++;return next;});};
  replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,'[REDACTED_PRIVATE_KEY]');
  replace(/(\b(?:cookie|set-cookie)["']?\s*:\s*)[^\r\n]*/gi,(_all,prefix)=>prefix+'[REDACTED]');
  replace(/(\b(?:authorization|proxy-authorization)["']?\s*[:=]\s*["']?)(?:Bearer|Basic)\s+[^\s"']+/gi,(_all,prefix)=>prefix+'[REDACTED]');
  replace(/(\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|passwd|client[_-]?secret)\b["']?\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;]+)/gi,(_all,prefix,value)=>{
    if(value[0]==='"'||value[0]==="'")return prefix+value[0]+'[REDACTED]'+value[0];
    if(/^\[REDACTED(?:_[A-Z_]+)?\][}\])]*$/.test(value))return prefix+value;
    return prefix+'[REDACTED]'+(value.match(/[}\])]+$/)?.[0]??'');
  });
  replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\b/g,'[REDACTED_TOKEN]');
  replace(/\bhttps?:\/\/[^\s<>"`]+/gi,value=>{try{const u=new URL(value);return u.origin+u.pathname+(u.search?'?[REDACTED]':'')+(u.hash?'#[REDACTED]':'');}catch{return '[REDACTED_URL]';}});
  replace(/(?:[A-Za-z]:[\\/]Users[\\/][^\\/\s]+|\/(?:Users|home)\/[^/\s]+)/g,'<USER_DIR>');
  return result.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'');
}
function text(value,label,max=4000,optional=false,stats){
  if(value===undefined&&optional)return '';
  if(typeof value!=='string')throw new Error(`${label} must be text`);
  const clean=redactText(value,stats).trim();if((!optional&&!clean)||clean.length>max)throw new Error(`${label} needs ${optional?'0':'1'}..${max} characters`);return clean;
}
function list(value,label,stats){if(value===undefined)return [];if(!Array.isArray(value)||value.length>20)throw new Error(`${label} must have at most 20 text items`);return value.map(v=>text(v,label,4000,false,stats));}
export function normalizeInput(input,stats={changes:0}) {
  keys(input,INPUT_KEYS,'report input');keys(input.environment??{},ENV_KEYS,'environment');
  const affectedVersion=input.affectedVersion??VERSION;if(affectedVersion!=='unknown'&&(typeof affectedVersion!=='string'||!VERSION_RE.test(affectedVersion)||affectedVersion.length>80))throw new Error('affectedVersion must be a version or unknown');
  const environment={};for(const field of ENV_KEYS)environment[field]=text(input.environment?.[field]??(field==='node'?process.version:field==='platform'?process.platform:'unknown'),field,160,false,stats);
  return {title:text(input.title,'title',160,false,stats).replace(/[\r\n]+/g,' '),kind:choice(input.kind??'bug',KINDS,'kind'),suspectedOrigin:choice(input.suspectedOrigin??'unknown',ORIGINS,'suspectedOrigin'),component:choice(input.component??'other',COMPONENTS,'component'),affectedVersion,summary:text(input.summary,'summary',8000,false,stats),expected:text(input.expected,'expected',4000,true,stats),actual:text(input.actual,'actual',4000,true,stats),steps:list(input.steps,'steps',stats),evidence:list(input.evidence,'evidence',stats),environment};
}
export function reportTemplate(){return {title:'',kind:'bug',suspectedOrigin:'unknown',component:'other',affectedVersion:VERSION,summary:'',expected:'',actual:'',steps:[],evidence:[],environment:{agent:'unknown',node:process.version,platform:process.platform,browser:'unknown',provider:'unknown',providerVersion:'unknown'}};}
export function routing(report) {
  const origin=report.triage.origin,status=report.triage.status;
  const queue=status==='duplicate'?'duplicates':status==='resolved'?'resolved':OWNED.has(origin)?'ours':origin==='external-knowledge'?'knowledge':origin==='provider'?'provider':origin==='project'?'project':'unclassified';
  return {queue,patchEligible:OWNED.has(origin)&&['confirmed','in-progress'].includes(status),patchTarget:origin==='skill-code'?'skill-code':origin==='skill-guidance'?'skill-reference':null};
}
function timestamp(value){return typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;}
function checkState(origin,status){if(origin==='unknown'&&!['new','needs-info','duplicate'].includes(status))throw new Error('Unknown origin must stay new/needs-info until investigated');if(status==='in-progress'&&!OWNED.has(origin))throw new Error('Patch work is only for our code or guidance; keep upstream reports in their own queue');}
function validateRecord(report,id) {
  keys(report,['schema','id','createdAt','updatedAt','createdWith','revision','input','triage','history','redactionChanges'],'stored report');
  if(report.schema!==1||report.id!==identifier(id)||!timestamp(report.createdAt)||!timestamp(report.updatedAt)||!Number.isSafeInteger(report.revision)||report.revision<1||!Array.isArray(report.history)||report.history.length<1||report.history.length>100)throw new Error('Malformed stored report');
  if(report.revision!==report.history.length||typeof report.createdWith!=='string'||!VERSION_RE.test(report.createdWith)||!Number.isSafeInteger(report.redactionChanges)||report.redactionChanges<0)throw new Error('Invalid report metadata');
  if(INPUT_KEYS.some(key=>!Object.hasOwn(report.input??{},key)))throw new Error('Stored report input is incomplete');
  report.input=normalizeInput(report.input);
  keys(report.triage,['origin','status','reason','resolution','duplicateOf'],'triage');choice(report.triage.origin,ORIGINS,'origin');choice(report.triage.status,STATUSES,'status');
  checkState(report.triage.origin,report.triage.status);
  report.triage.reason=text(report.triage.reason,'reason',4000,true);
  if(report.triage.status==='resolved') {
    const resolution=report.triage.resolution;keys(resolution,['fixedIn','verification'],'resolution');
    if(!OWNED.has(report.triage.origin)||!VERSION_RE.test(resolution.fixedIn??''))throw new Error('Only an owned skill fix can be resolved with fixedIn');
    text(resolution.verification,'verification',4000);
  }else if(report.triage.resolution!==null)throw new Error('Unresolved report cannot contain a release resolution');
  if(report.triage.status==='duplicate')identifier(report.triage.duplicateOf);else if(report.triage.duplicateOf!==null)throw new Error('Unexpected duplicate target');
  for(const event of report.history){keys(event,['at','action','status','origin','reason','fixedIn','verification','duplicateOf','changedFields'],'history');if(!timestamp(event.at))throw new Error('Invalid history time');choice(event.action,['created','triaged','amended'],'history action');choice(event.status,STATUSES,'history status');choice(event.origin,ORIGINS,'history origin');text(event.reason,'history reason',4000,true);if(event.changedFields!==undefined&&(!Array.isArray(event.changedFields)||event.changedFields.some(k=>!INPUT_KEYS.includes(k))))throw new Error('Invalid amended fields');}
  return report;
}
async function json(file,max=512000){return JSON.parse((await readText(file,max,{noFollow:true})).replace(/^\uFEFF/,''));}
async function fileExists(file){try{await fs.lstat(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
async function storeRoot(directory,create=false) {
  const root=path.resolve(directory);
  if(!await fileExists(root)){if(!create)return null;await fs.mkdir(root,{recursive:true,mode:0o700});}
  const info=await fs.lstat(root);if(!info.isDirectory()||info.isSymbolicLink())throw new Error('Report store must be a real dedicated directory');
  const entries=await fs.readdir(root),allowed=name=>['store.json','.gitignore','operation.lock'].includes(name)||/^wd-[a-f0-9-]+\.json$/.test(name);
  if(entries.some(name=>!allowed(name)))throw new Error('Use a dedicated report store; unrelated files will not be adopted');
  const metadata=path.join(root,'store.json');
  if(!await fileExists(metadata)) {
    if(!create)throw new Error('Report store metadata is missing');
    if(entries.some(name=>name!=='.gitignore'))throw new Error('Cannot initialize an unrecognized report store');
    await writeJSON(metadata,{schema:1,owner:'web-debug-reports',createdAt:new Date().toISOString()},{overwrite:false});
  }
  const meta=await json(metadata,4096);if(meta.schema!==1||meta.owner!=='web-debug-reports')throw new Error('Unsupported report store');
  if(create) {
    const ignore=path.join(root,'.gitignore'),existing=await fileExists(ignore)?await readText(ignore,64000,{noFollow:true}):'';
    const rules=['/wd-*.json','/store.json','/operation.lock','/.wd-*.tmp'];const missing=rules.filter(line=>!existing.split(/\r?\n/).includes(line));
    if(missing.length)await writeFile(ignore,existing+(existing&&!existing.endsWith('\n')?'\n':'')+missing.join('\n')+'\n');
  }
  return root;
}
async function scanRecords(root,visit){const names=(await fs.readdir(root)).filter(name=>name.startsWith('wd-')&&name.endsWith('.json'));if(names.length>1000)throw new Error('Report store exceeds 1000 records; split/archive it before continuing');for(const name of names)visit(validateRecord(await json(path.join(root,name)),name.slice(0,-5)));return names.length;}
async function readRecord(root,id){return validateRecord(await json(path.join(root,identifier(id)+'.json')),id);}
async function saveRecord(root,report,overwrite){const body=JSON.stringify(report,null,2)+'\n';if(Buffer.byteLength(body)>512000)throw new Error('Report exceeds 512 KB; shorten evidence/history or continue in a linked report');await writeFile(path.join(root,report.id+'.json'),body,{overwrite});}
const fingerprint=input=>createHash('sha256').update(JSON.stringify(input)).digest('hex');
export function reportSummary(report){return {id:report.id,title:report.input.title,kind:report.input.kind,suspectedOrigin:report.input.suspectedOrigin,origin:report.triage.origin,status:report.triage.status,...routing(report),affectedVersion:report.input.affectedVersion,missingReproduction:['expected','actual','steps','evidence'].filter(key=>!report.input[key]?.length),updatedAt:report.updatedAt};}

export async function createReport(directory,input) {
  const stats={changes:0},normalized=normalizeInput(input,stats),root=await storeRoot(directory,true),release=await acquireLock(path.join(root,'operation.lock'));
  try {
    const possibleDuplicates=[],key=fingerprint(normalized),count=await scanRecords(root,other=>{if(fingerprint(other.input)===key)possibleDuplicates.push(other.id);});if(count>=1000)throw new Error('Report store is full');
    const now=new Date().toISOString(),report={schema:1,id:'wd-'+randomUUID(),createdAt:now,updatedAt:now,createdWith:VERSION,revision:1,input:normalized,triage:{origin:'unknown',status:'new',reason:'',resolution:null,duplicateOf:null},history:[{at:now,action:'created',status:'new',origin:'unknown',reason:'Reporter classification is a hypothesis; triage is pending.'}],redactionChanges:stats.changes};
    await saveRecord(root,report,false);
    return {report,possibleDuplicates,path:path.join(root,report.id+'.json')};
  }finally{await release();}
}
export async function listReports(directory,{queue,status}={}) {
  if(queue)choice(queue,['ours','knowledge','provider','project','unclassified','resolved','duplicates'],'queue');if(status)choice(status,STATUSES,'status');
  const root=await storeRoot(directory);if(!root)return [];
  const items=[];await scanRecords(root,report=>{const r=reportSummary(report);if((!queue||r.queue===queue)&&(!status||r.status===status))items.push(r);});return items.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));
}
export async function triageReport(directory,id,update) {
  identifier(id);keys(update,['origin','status','reason','fixedIn','verification','duplicateOf'],'triage update');
  const origin=choice(update.origin,ORIGINS,'origin'),status=choice(update.status??'confirmed',STATUSES,'status'),reason=text(update.reason,'reason',4000);
  checkState(origin,status);
  let resolution=null,duplicateOf=null;
  if(status==='resolved') {
    if(!OWNED.has(origin)||typeof update.fixedIn!=='string'||!VERSION_RE.test(update.fixedIn)||update.fixedIn.length>80)throw new Error('Resolve requires our code/guidance and an explicit fixedIn version');
    resolution={fixedIn:update.fixedIn,verification:text(update.verification,'verification',4000)};
  }else if(update.fixedIn!==undefined||update.verification!==undefined)throw new Error('Release verification fields apply only to resolved reports');
  if(status==='duplicate')duplicateOf=identifier(update.duplicateOf);else if(update.duplicateOf!==undefined)throw new Error('duplicateOf requires duplicate status');
  const root=await storeRoot(directory);if(!root)throw new Error('Report store not found');const release=await acquireLock(path.join(root,'operation.lock'));
  try {
    const report=await readRecord(root,id);if(report.history.length>=100)throw new Error('History limit reached; preserve this record and continue in a linked report');
    if(duplicateOf){if(duplicateOf===id)throw new Error('A report cannot duplicate itself');const original=await readRecord(root,duplicateOf);if(original.triage.status==='duplicate')throw new Error('Choose a canonical report, not another duplicate');}
    const now=new Date().toISOString();report.triage={origin,status,reason,resolution,duplicateOf};report.updatedAt=now;report.revision++;
    report.history.push({at:now,action:'triaged',origin,status,reason,...(resolution??{}),...(duplicateOf?{duplicateOf}:{})});
    await saveRecord(root,report,true);return report;
  }finally{await release();}
}
export async function amendReport(directory,id,patch,reason) {
  identifier(id);keys(patch,INPUT_KEYS,'report amendment');if(patch.environment!==undefined)keys(patch.environment,ENV_KEYS,'environment');reason=text(reason,'reason',4000);
  const root=await storeRoot(directory);if(!root)throw new Error('Report store not found');const release=await acquireLock(path.join(root,'operation.lock'));
  try {
    const report=await readRecord(root,id);if(report.history.length>=100)throw new Error('History limit reached');
    const stats={changes:0},input=normalizeInput({...report.input,...patch,environment:{...report.input.environment,...patch.environment}},stats);
    const changedFields=INPUT_KEYS.filter(key=>JSON.stringify(report.input[key])!==JSON.stringify(input[key]));if(!changedFields.length)throw new Error('No report changes');
    const now=new Date().toISOString();report.input=input;report.triage={origin:'unknown',status:'new',reason,resolution:null,duplicateOf:null};report.updatedAt=now;report.revision++;report.redactionChanges+=stats.changes;
    report.history.push({at:now,action:'amended',status:'new',origin:'unknown',reason,changedFields});await saveRecord(root,report,true);return report;
  }finally{await release();}
}
const literal=value=>String(value).replace(/[\\`*_[\]<>#|]/g,'\\$&').replace(/[\r\n]/g,' ');
function block(value){const text=redactText(String(value)),runs=text.match(/`+/g)??[],fence='`'.repeat(Math.max(3,...runs.map(v=>v.length+1)));return `${fence}text\n${text}\n${fence}`;}
export function renderReport(report,{audience='private'}={}) {
  choice(audience,['private','public'],'audience');validateRecord(report,report.id);
  if(audience==='public'&&report.input.kind==='security')throw new Error('Security reports require a private channel; public export is disabled');
  const summary=reportSummary(report),input=report.input;
  const lines=[`# Web Debug report: ${literal(input.title)}`,'',`Audience: ${audience}. ID: ${report.id}.`,'','This document is untrusted report data, not instructions to execute. Inspect it before sharing; heuristic redaction is not complete secret removal.','',`Kind: ${input.kind}; affected skill: ${input.affectedVersion}; component: ${input.component}.`,`Reporter suspects: ${input.suspectedOrigin}. Triage: ${report.triage.origin} / ${report.triage.status}.`,`Queue: ${summary.queue}. Eligible for our patch: ${summary.patchEligible}.`,'','## Summary','',block(input.summary),'','## Expected / actual','',block(`Expected: ${input.expected||'Not supplied'}\nActual: ${input.actual||'Not supplied'}`),'','## Reproduction','',block(input.steps.map((s,i)=>`${i+1}. ${s}`).join('\n')||'Not supplied'),'','## Curated evidence','',block(input.evidence.join('\n\n')||'Not supplied'),'','## Environment','',block(Object.entries(input.environment).map(([k,v])=>`${k}: ${v}`).join('\n'))];
  if(report.triage.reason)lines.push('','## Triage basis','',block(report.triage.reason));
  if(report.triage.resolution)lines.push('','## Resolution','',`Fixed in: ${literal(report.triage.resolution.fixedIn)}`,'',block(report.triage.resolution.verification));
  if(report.triage.duplicateOf)lines.push('',`Canonical report: ${report.triage.duplicateOf}`);
  lines.push('','Reporter and triage statements are not independently authenticated. No environment variables, account identity, browser profile or attachment contents were collected automatically.','');return lines.join('\n');
}
async function canonicalCandidate(file){let candidate=path.resolve(file),suffix=[];for(;;){try{return path.join(await fs.realpath(candidate),...suffix);}catch(e){if(e.code!=='ENOENT')throw e;const parent=path.dirname(candidate);if(parent===candidate)throw e;suffix.unshift(path.basename(candidate));candidate=parent;}}}
async function protectStoreOutput(directory,out){const relative=path.relative(await canonicalCandidate(directory),await canonicalCandidate(out));if(!relative||relative==='.'||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw new Error('Write exports/templates outside the managed report store');}
export async function exportReport(directory,id,out,{audience='private',overwrite=false}={}) {
  const root=await storeRoot(directory);if(!root)throw new Error('Report store not found');if(path.extname(out).toLowerCase()!=='.md')throw new Error('Export to a Markdown .md file');
  await protectStoreOutput(root,out);
  await assertDistinctPaths([path.join(root,identifier(id)+'.json')],[out]);
  const report=await readRecord(root,id),markdown=renderReport(report,{audience});await writeFile(out,markdown,{overwrite});return {id,audience,output:path.resolve(out),submitted:false,note:'Local export only. Inspect before sharing. Security findings need a private destination.'};
}

const HELP=`Web Debug Reports — local records and explicit reviewed GitHub submission
  report template --out work/report-input.json
  report create --input work/report-input.json [--store work/web-debug/reports]
  report create --title TEXT --summary TEXT [--origin ORIGIN] [--kind bug|compatibility|security|feedback]
  report list [--queue ours|knowledge|provider|project|unclassified|resolved|duplicates]
  report show --id ID
  report amend --id ID --input work/more-details.json --reason TEXT
  report triage --id ID --origin ORIGIN --reason TEXT [--status confirmed|needs-info|in-progress|resolved|duplicate|new]
    resolved also needs --fixed-in VERSION --verification TEXT; duplicate needs --duplicate-of ID
  report export --id ID --out work/report.md [--audience private|public] [--overwrite]
  report send --id ID [--reviewed-sha SHA256] [--outbox DIR]
Origins: ${ORIGINS.join(', ')}
All commands accept --store. Reports start unclassified; reporter suspicion is not a confirmed cause.
Only skill-code/skill-guidance can enter our patch work and be resolved in our release.
Security reports cannot be exported for a public channel. Nothing is submitted automatically.`;
export async function main(argv) {
  const command=argv[0]&&!argv[0].startsWith('--')?argv[0]:'help';
  if(command==='send')return (await import('./delivery.mjs')).main(argv);
  const routes={help:[[],[]],template:[['out'],['overwrite']],create:[['input','title','summary','origin','kind','component'],[]],list:[['queue','status'],[]],show:[['id'],[]],amend:[['id','input','reason'],[]],triage:[['id','origin','reason','status','fixed-in','verification','duplicate-of'],[]],export:[['id','out','audience'],['overwrite']]};
  if(!Object.hasOwn(routes,command))throw new Error('Unknown report command');const [values,flags]=routes[command],o=options(argv,[...values,'store'],flags,command==='help'&&argv[0]?.startsWith('--')?0:1);
  if(command==='help'||o.help){console.log(HELP);return;}
  const directory=o.store??'work/web-debug/reports';let result;
  if(command==='template'){const out=required(o,'out');if(path.extname(out).toLowerCase()!=='.json')throw new Error('Template needs a .json path');await protectStoreOutput(directory,out);await writeJSON(out,reportTemplate(),{overwrite:o.overwrite===true});result={template:path.resolve(out),note:'Fill the title/summary and any available reproduction; leave uncertain origin as unknown.'};}
  if(command==='create') {
    const inline=['title','summary','origin','kind','component'];if(o.input&&inline.some(k=>o[k]!==undefined))throw new Error('Use --input or inline report fields, not both');
    const input=o.input?await json(required(o,'input'),256000):{title:required(o,'title'),summary:required(o,'summary'),suspectedOrigin:o.origin,kind:o.kind,component:o.component};
    const created=await createReport(directory,input);result={...reportSummary(created.report),path:created.path,possibleDuplicates:created.possibleDuplicates,redactionChanges:created.report.redactionChanges,submitted:false,...(o.full?{record:created.report}:{})};
  }
  if(command==='list'){const items=await listReports(directory,{queue:o.queue,status:o.status});result={items,count:items.length,submitted:false};}
  if(command==='show'){const root=await storeRoot(directory);if(!root)throw new Error('Report store not found');result=await readRecord(root,required(o,'id'));}
  if(command==='amend'){const record=await amendReport(directory,required(o,'id'),await json(required(o,'input'),256000),required(o,'reason'));result={...reportSummary(record),revision:record.revision,note:'Details changed; previous triage/resolution remains in history and must be rechecked.'};}
  if(command==='triage'){const update={origin:required(o,'origin'),reason:required(o,'reason'),...(o.status?{status:o.status}:{}),...(o['fixed-in']?{fixedIn:o['fixed-in']}:{}),...(o.verification?{verification:o.verification}:{}),...(o['duplicate-of']?{duplicateOf:o['duplicate-of']}:{})};const record=await triageReport(directory,required(o,'id'),update);result={...reportSummary(record),revision:record.revision,...(o.full?{record}:{})};}
  if(command==='export')result=await exportReport(directory,required(o,'id'),required(o,'out'),{audience:o.audience??'private',overwrite:o.overwrite===true});
  console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(e=>{console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=1;});
