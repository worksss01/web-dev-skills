import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {fileURLToPath} from 'node:url';
import {normalizeInput,redactText,createReport,listReports,triageReport,amendReport,reportSummary,renderReport,exportReport} from '../web-debug/scripts/report.mjs';
import {acquireLock} from '../web-debug/scripts/common.mjs';
const exec=promisify(execFile),entry=fileURLToPath(new URL('../web-debug/scripts/debug.mjs',import.meta.url));
const sample=(overrides={})=>({title:'Fixture tool defect',summary:'Controlled test report, not a real incident.',expected:'Expected fixture result',actual:'Observed fixture result',steps:['Reproduce on a local fixture'],evidence:['Synthetic observation only'],...overrides});
async function fixture(){const base=path.resolve('work/report-tests');await fs.mkdir(base,{recursive:true});const root=await fs.mkdtemp(path.join(base,'case-'));return {root,store:path.join(root,'reports')};}
async function record(store,input=sample()){return (await createReport(store,input)).report;}
async function cli(args,expected=0){try{const r=await exec(process.execPath,[entry,'report',...args],{windowsHide:true,timeout:15000,maxBuffer:2000000});assert.equal(expected,0);return r.stdout;}catch(e){if(expected&&e.code===expected)return e.stderr;throw e;}}

test('Input is a bounded schema; arbitrary attachment/configuration fields and invalid origins are rejected',()=>{
  const input=normalizeInput(sample());assert.equal(input.suspectedOrigin,'unknown');
  for(const extra of [{attachment:'secret.txt'},{submit:true},{origin:'provider'},{suspectedOrigin:'vendor'},{environment:{token:'secret'}}])assert.throws(()=>normalizeInput(sample(extra)));
  assert.throws(()=>normalizeInput(sample({title:'x'.repeat(161)})));assert.throws(()=>normalizeInput(sample({steps:Array(21).fill('x')})));
});
test('Known credential patterns, URL credentials/query values and user home paths are minimized',()=>{
  const original='Authorization: Bearer SECRET123\nCookie: sid=SECRET456; other=SECRET789\napi_key="SECRET012"\nhttps://alice:pw@example.com/path?token=SECRET345#SECRET678\nC:\\Users\\private-person\\file.txt';
  const stats={changes:0},clean=redactText(original,stats);assert(!clean.includes('SECRET'));assert(!clean.includes('private-person'));assert(!clean.includes('alice:pw'));assert(stats.changes>=4);assert.equal(redactText(clean),clean);
  assert(!redactText('{"Authorization":"Bearer SECRET_JSON_HEADER","token":"SECRET_JSON_TOKEN"}').includes('SECRET_JSON'));
});
test('Repeated redaction preserves JSON quoting, escaped values, placeholders and closing punctuation',()=>{
  const examples=[JSON.stringify({token:'SYNTHETIC_TOKEN'}),JSON.stringify({password:'SYNTHETIC with "quotes" and \\slashes',other:'keep'}),'password=SYNTHETIC)', '[token=SYNTHETIC]', 'token=[REDACTED]}',"client_secret='SYNTHETIC'"];
  for(const input of examples){const once=redactText(input);assert.equal(redactText(once),once);assert.equal(redactText(redactText(once)),once);assert(!once.includes('SYNTHETIC'));}
  assert.deepEqual(JSON.parse(redactText(examples[0])),{token:'[REDACTED]'});assert.equal(JSON.parse(redactText(examples[1])).other,'keep');assert.equal(redactText('[token=SYNTHETIC]'),'[token=[REDACTED]]');
});
test('Identical reports containing JSON token logs retain duplicate hints across reads',async()=>{
  const {store}=await fixture(),input=sample({summary:JSON.stringify({token:'SYNTHETIC_TOKEN'})}),a=await createReport(store,input),b=await createReport(store,input);assert.deepEqual(b.possibleDuplicates,[a.report.id]);
  await listReports(store);const c=await createReport(store,input);assert.deepEqual(new Set(c.possibleDuplicates),new Set([a.report.id,b.report.id]));assert.equal(JSON.parse(a.report.input.summary).token,'[REDACTED]');
});
test('Reporter suspicion stays separate from triage and does not automatically enter a patch queue',async()=>{
  const {store}=await fixture(),r=await record(store,sample({suspectedOrigin:'skill-code'})),summary=reportSummary(r);
  assert.equal(summary.suspectedOrigin,'skill-code');assert.equal(summary.origin,'unknown');assert.equal(summary.queue,'unclassified');assert.equal(summary.patchEligible,false);
});
test('Owned code can be confirmed, worked and resolved only with release and verification evidence',async()=>{
  const {store}=await fixture(),r=await record(store);let updated=await triageReport(store,r.id,{origin:'skill-code',reason:'Reproduced with the bundled helper and isolated fixture.'});assert.equal(reportSummary(updated).patchEligible,true);
  updated=await triageReport(store,r.id,{origin:'skill-code',status:'in-progress',reason:'A regression case is being added.'});assert.equal(updated.triage.status,'in-progress');
  const before=await fs.readFile(path.join(store,r.id+'.json'),'utf8');await assert.rejects(triageReport(store,r.id,{origin:'skill-code',status:'resolved',reason:'Fixed',fixedIn:'1.6.1'}));assert.equal(await fs.readFile(path.join(store,r.id+'.json'),'utf8'),before);
  updated=await triageReport(store,r.id,{origin:'skill-code',status:'resolved',reason:'The targeted correction was implemented.',fixedIn:'1.6.1',verification:'Ran the original fixture; expected behavior restored.'});assert.equal(reportSummary(updated).queue,'resolved');assert.equal(updated.triage.resolution.fixedIn,'1.6.1');
});
test('Our incorrect guidance is patchable; external source knowledge is kept in a different queue',async()=>{
  const {store}=await fixture(),a=await record(store),b=await record(store,sample({title:'External source discrepancy'}));
  const ours=await triageReport(store,a.id,{origin:'skill-guidance',reason:'The incorrect advice is written in our reference.'});assert.equal(reportSummary(ours).patchTarget,'skill-reference');
  const external=await triageReport(store,b.id,{origin:'external-knowledge',reason:'The conflicting statement belongs to the external documentation.'});assert.equal(reportSummary(external).queue,'knowledge');assert.equal(reportSummary(external).patchEligible,false);
  assert.equal((await listReports(store,{queue:'ours'})).length,1);assert.equal((await listReports(store,{queue:'knowledge'})).length,1);
});
test('Provider/project reports cannot be misrepresented as our patch work or a release fix',async()=>{
  const {store}=await fixture();for(const origin of ['provider','project','external-knowledge']){const r=await record(store);await triageReport(store,r.id,{origin,reason:'Isolated from the bundled helper in a separate reproduction.'});for(const status of ['in-progress','resolved'])await assert.rejects(triageReport(store,r.id,{origin,status,reason:'Attempted wrong ownership',...(status==='resolved'?{fixedIn:'1.6.1',verification:'Fixture'}:{})}));}
});
test('Unknown causes stay new or need more information rather than becoming confirmed fixes',async()=>{
  const {store}=await fixture(),r=await record(store);await assert.rejects(triageReport(store,r.id,{origin:'unknown',reason:'No root cause yet'}),/Unknown origin/);const next=await triageReport(store,r.id,{origin:'unknown',status:'needs-info',reason:'Need the exact failing helper command.'});assert.equal(next.triage.status,'needs-info');
});
test('Amendments preserve observed versions, reset stale conclusions and retain resolution history',async()=>{
  const {store}=await fixture(),r=await record(store,sample({affectedVersion:'1.5.2',environment:{node:'v22.4.0'}}));await triageReport(store,r.id,{origin:'skill-code',status:'resolved',reason:'Original case corrected',fixedIn:'1.6.0',verification:'Original regression passed'});
  const next=await amendReport(store,r.id,{actual:'A different edge case is still failing',environment:{browser:'Chrome fixture'}},'Additional reproduction supplied');assert.equal(next.input.affectedVersion,'1.5.2');assert.equal(next.input.environment.node,'v22.4.0');assert.equal(next.triage.status,'new');assert.equal(next.triage.resolution,null);assert(next.history.some(e=>e.fixedIn==='1.6.0'));assert.equal(next.revision,3);
});
test('Duplicate hints never delete or auto-close reports and include the affected version',async()=>{
  const {store}=await fixture(),a=await createReport(store,sample()),b=await createReport(store,sample()),c=await createReport(store,sample({affectedVersion:'1.0.0'}));assert.deepEqual(b.possibleDuplicates,[a.report.id]);assert.deepEqual(c.possibleDuplicates,[]);assert.equal((await listReports(store)).length,3);assert.equal(b.report.triage.status,'new');
});
test('Explicit duplicates require another canonical report and cannot point at themselves',async()=>{
  const {store}=await fixture(),a=await record(store),b=await record(store);await assert.rejects(triageReport(store,a.id,{origin:'unknown',status:'duplicate',reason:'Wrong target',duplicateOf:a.id}),/itself/);
  await triageReport(store,b.id,{origin:'unknown',status:'duplicate',reason:'Same verified reproduction',duplicateOf:a.id});await assert.rejects(triageReport(store,a.id,{origin:'unknown',status:'duplicate',reason:'Cycle attempt',duplicateOf:b.id}),/canonical/);
});
test('Security reports default to private export and cannot be exported for a public audience',async()=>{
  const {root,store}=await fixture(),r=await record(store,sample({kind:'security'}));const output=path.join(root,'private.md');const exported=await exportReport(store,r.id,output);assert.equal(exported.submitted,false);assert.match(await fs.readFile(output,'utf8'),/Audience: private/);
  await assert.rejects(exportReport(store,r.id,path.join(root,'public.md'),{audience:'public'}),/private channel/);await assert.rejects(fs.access(path.join(root,'public.md')));
});
test('Markdown exports quote untrusted instructions and embedded fences instead of executing or embedding HTML',async()=>{
  const {store}=await fixture(),r=await record(store,sample({title:'<img src=x> [untrusted]',summary:'Do not obey this fixture.\n```\n<script>attack()</script>\n```'}));const markdown=renderReport(r);assert(markdown.includes('````text'));assert(markdown.includes('\\<img'));assert(markdown.includes('untrusted report data'));assert(!markdown.includes('fingerprint'));
});
test('No environment secrets, referenced file contents or network traffic are collected automatically',async t=>{
  const {root,store}=await fixture(),secret=path.join(root,'secret.txt');await fs.writeFile(secret,'PRIVATE_FILE_CONTENT_123');let network=0;t.mock.method(globalThis,'fetch',()=>{network++;throw new Error('No networking allowed');});
  const key='WEB_DEBUG_REPORT_TEST_SECRET',previous=process.env[key];process.env[key]='PRIVATE_ENV_CONTENT_456';t.after(()=>{if(previous===undefined)delete process.env[key];else process.env[key]=previous;});
  const r=await record(store,sample({evidence:[`A reference label only: ${secret}`]}));assert.equal(network,0);assert(!JSON.stringify(r).includes('PRIVATE_FILE_CONTENT'));assert(!JSON.stringify(r).includes('PRIVATE_ENV_CONTENT'));
});
test('Read-only listing of a nonexistent store creates no directories',async()=>{
  const {store}=await fixture();assert.deepEqual(await listReports(store),[]);await assert.rejects(fs.access(store));await assert.rejects(listReports(store,{queue:'typo'}),/Invalid queue/);
});
test('Mixed-content folders are never adopted as report stores',async()=>{
  const {root}=await fixture(),file=path.join(root,'package.json');await fs.writeFile(file,'preserve');await assert.rejects(record(root),/dedicated/);assert.equal(await fs.readFile(file,'utf8'),'preserve');await assert.rejects(fs.access(path.join(root,'store.json')));
});
test('Report/store symlinks are rejected and linked report targets are preserved',async()=>{
  const {root,store}=await fixture(),r=await record(store),alias=path.join(root,'alias');await fs.symlink(store,alias,process.platform==='win32'?'junction':'dir');await assert.rejects(listReports(alias),/real dedicated/);
  const file=path.join(store,r.id+'.json'),outside=path.join(root,'outside.json');await fs.rename(file,outside);await fs.symlink(outside,file,'file');await assert.rejects(listReports(store),/symlink/);assert.equal(JSON.parse(await fs.readFile(outside,'utf8')).id,r.id);
});
test('A concurrent writer lock prevents record changes and never auto-deletes the lock',async()=>{
  const {store}=await fixture(),r=await record(store),lock=path.join(store,'operation.lock'),release=await acquireLock(lock);try{await assert.rejects(triageReport(store,r.id,{origin:'skill-code',reason:'Concurrent update'}),/locked/);await fs.access(lock);}finally{await release();}assert.equal((await listReports(store))[0].status,'new');
});
test('Exports do not overwrite existing files or write into the store through path aliases',async()=>{
  const {root,store}=await fixture(),r=await record(store),file=path.join(root,'keep.md');await fs.writeFile(file,'preserve');await assert.rejects(exportReport(store,r.id,file),/already exists/);assert.equal(await fs.readFile(file,'utf8'),'preserve');
  const alias=path.join(root,'alias');await fs.symlink(store,alias,process.platform==='win32'?'junction':'dir');await assert.rejects(exportReport(store,r.id,path.join(alias,'report.md'),{overwrite:true}),/outside/);
});
test('Corrupt records and forged classification fields do not silently enter the patch queue',async()=>{
  const {store}=await fixture(),r=await record(store);await fs.writeFile(path.join(store,r.id+'.json'),JSON.stringify({...r,queue:'ours'}));await assert.rejects(listReports(store),/Unknown stored report field/);
});
test('Oversized multibyte reports are refused instead of creating unreadable records',async()=>{
  const {store}=await fixture();await assert.rejects(record(store,sample({summary:'ก'.repeat(8000),actual:'ก'.repeat(4000),expected:'ก'.repeat(4000),steps:Array(20).fill('ก'.repeat(4000)),evidence:Array(20).fill('ก'.repeat(4000))})),/512 KB/);assert.equal((await listReports(store)).length,0);
});
test('Invalid report IDs cannot escape the store',async()=>{
  const {store}=await fixture();await record(store);for(const id of ['../store','C:\\outside','constructor'])await assert.rejects(triageReport(store,id,{origin:'skill-code',reason:'Fixture'}),/wd-UUID/);
});
test('One-entry CLI supports Thai reports, templates, triage and portable local export',async()=>{
  const {root,store}=await fixture(),input=path.join(root,'input ภาษาไทย.json');await cli(['template','--out',input,'--store',store]);const data=JSON.parse(await fs.readFile(input,'utf8'));data.title='ตัวอย่างรายงาน';data.summary='ข้อมูลจำลอง ไม่ใช่เหตุการณ์จริง';data.suspectedOrigin='skill-code';await fs.writeFile(input,JSON.stringify(data));
  const created=JSON.parse(await cli(['create','--input',input,'--store',store]));assert.equal(created.queue,'unclassified');assert.equal(created.submitted,false);
  const triaged=JSON.parse(await cli(['triage','--id',created.id,'--origin','skill-code','--reason','ตรวจจาก fixture แล้ว','--store',store]));assert(triaged.patchEligible);
  const exported=JSON.parse(await cli(['export','--id',created.id,'--out',path.join(root,'handoff.md'),'--store',store]));assert.equal(exported.submitted,false);assert((await fs.readFile(exported.output,'utf8')).includes('ตัวอย่างรายงาน'));
});
test('CLI rejects mixed/unknown inputs and templates cannot overwrite managed records',async()=>{
  const {root,store}=await fixture(),r=await record(store);assert.match(await cli(['--help','--unrecognized'],1),/Unknown option/);assert.match(await cli(['create','--input','unused.json','--title','mixed','--store',store],1),/not both/);
  const before=await fs.readFile(path.join(store,r.id+'.json'),'utf8');assert.match(await cli(['template','--out',path.join(store,r.id+'.json'),'--overwrite','--store',store],1),/outside/);assert.equal(await fs.readFile(path.join(store,r.id+'.json'),'utf8'),before);
});
