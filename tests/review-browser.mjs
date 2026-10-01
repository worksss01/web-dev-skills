import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {args,required,writeJSON} from '../web-debug/scripts/common.mjs';
import {purgeProfile} from '../web-debug/scripts/browser-state.mjs';
import {compareReports} from '../web-debug/scripts/diagnostics.mjs';
const exec=promisify(execFile),o=args(process.argv.slice(2)),work=path.resolve(required(o,'work'));await fs.mkdir(work,{recursive:true});
const state=path.join(work,'state'),cli=fileURLToPath(new URL('../web-debug/scripts/chrome.mjs',import.meta.url)),checks=[];
const pass=label=>{checks.push(label);console.log('PASS '+label);};let requests=0;
const server=http.createServer((q,r)=>{requests++;r.writeHead(200,{'Content-Type':'text/html'});r.end('<!doctype html><html lang="en"><head><title>Review fixture</title></head><body><main><h1>Review</h1><p id="contrast" style="color:rgb(120,120,120);background-color:rgb(120,120,120)">Low contrast</p><input id="name"><button id="button">Test</button></main><script>console.error("fixture startup error");fetch("/initial-data");window.getComputedStyle=()=>({display:"none",visibility:"hidden",opacity:"0"});document.querySelectorAll=()=>[];</script></body></html>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/?token=TESTSECRET123`;
async function cmd(command,extra=[],expected=0){try{const r=await exec(process.execPath,[cli,command,...extra],{windowsHide:true,timeout:35000,maxBuffer:8000000});assert.equal(expected,0);return JSON.parse(r.stdout);}catch(e){if(expected&&e.code===expected)return JSON.parse(e.stdout||e.stderr);throw e;}}
async function check(name,actions,extra=[],expected=0){const plan=path.join(work,name+'.json');await writeJSON(plan,{name:'review-fixture',actions});return cmd('check',['--state-dir',state,'--url',url,'--plan',plan,...extra],expected);}
let live=false;
try {
  const entry=fileURLToPath(new URL('../web-debug/scripts/debug.mjs',import.meta.url)),quickFile=path.join(work,'quick.json');
  const quick=JSON.parse((await exec(process.execPath,[entry,'chrome','check','--url',url,'--state-dir',state,'--out',quickFile,'--overwrite'],{windowsHide:true,timeout:35000,maxBuffer:8000000})).stdout);
  const quickReport=JSON.parse(await fs.readFile(quickFile,'utf8'));
  assert(quick.ok);assert(!quick.steps);assert(quickReport.steps.some(s=>s.type==='audit'));assert(quickReport.securityPolicy.readOnly);assert(quickReport.profilePurged);pass('Quick entry-point check needs no plan, saves full evidence, prints compact output and closes Chrome');
  let r=await check('observe',[{type:'waitForSelector',selector:'main'},{type:'inspect'},{type:'audit'},{type:'designAudit'},{type:'screenshot',path:'screen.png'}],['--read-only','--overwrite','--keep-profile']);
  assert(r.ok);assert.equal(r.transport,'pipe');assert(!JSON.stringify(r).includes('TESTSECRET123'));pass('L-1 inspect/navigation/context known URL fields redact query values');
  assert(r.events.some(e=>e.kind==='console'&&e.text==='fixture startup error'));assert(r.events.some(e=>e.kind==='request'&&e.url.includes('/initial-data')));pass('Pipe capture begins before initial document scripts and requests');
  assert(r.steps.find(s=>s.type==='inspect').result.headings.length>0);assert(r.steps.find(s=>s.type==='designAudit').result.checks.some(c=>c.rule==='simple-text-contrast-candidate'&&c.count>0));pass('L-3 automatic observations resist page-world DOM/style overrides');
  assert.notEqual(r.context.urlKey,createHash('sha256').update(url).digest('hex'));const privateKey=(await fs.readFile(path.join(state,'.context-key'),'utf8')).trim();assert(!JSON.stringify(r).includes(privateKey));pass('I-3 URL identity uses a private HMAC key absent from the report');
  await assert.rejects(fs.access(path.join(r.profileRetained,'DevToolsActivePort')));await assert.rejects(fs.access(path.join(state,'session.json')));pass('M-2 pipe check creates no CDP TCP endpoint/session');
  await exec('git',['init',work],{windowsHide:true});const relative=path.relative(work,r.profileRetained).split(path.sep).join('/')+'/.web-debug-profile.json';await exec('git',['-C',work,'check-ignore',relative],{windowsHide:true});await exec('git',['-C',work,'check-ignore','state/.context-key'],{windowsHide:true});pass('M-3 generated state/profile/key files are ignored by Git');
  await purgeProfile(state,r.profileRetained);
  const before=r;const after=await check('observe-again',[{type:'waitForSelector',selector:'main'},{type:'inspect'},{type:'audit'},{type:'designAudit'},{type:'screenshot',path:'screen.png'}],['--read-only','--overwrite']);
  assert(after.profilePurged);assert(compareReports(before,after).comparable);pass('Pipe mode purges its temporary profile and retains comparable HMAC context');
  const sentinel=path.join(work,'existing.png');await fs.writeFile(sentinel,'must remain');let count=requests;
  r=await check('no-clobber',[{type:'screenshot',path:'existing.png'}],[],1);assert.match(r.error,/overwrite/);assert.equal(await fs.readFile(sentinel,'utf8'),'must remain');assert.equal(requests,count);pass('H-1 existing artifact writes require CLI opt-in before browser launch');
  r=await check('traversal',[{type:'screenshot',path:'../../escape.png'}],[],1);assert.match(r.error,/relative|traversal/);assert.equal(requests,count);pass('H-1 traversal is rejected before any page request');
  const inputs=path.join(work,'inputs'),outside=path.join(work,'outside');await fs.mkdir(outside,{recursive:true});await fs.mkdir(inputs,{recursive:true});await fs.writeFile(path.join(outside,'secret.txt'),'fixture');
  try{await fs.symlink(path.join(outside,'secret.txt'),path.join(inputs,'linked.txt'),'file');}catch(e){if(e.code!=='EEXIST')throw e;}
  r=await check('linked-input',[{type:'fill',selector:'input',file:'inputs/linked.txt'}],[],1);assert.match(r.error,/outside|unlinked/);pass('H-1 input links cannot escape the curated input directory');
  await fs.writeFile(path.join(inputs,'approved.txt'),'approved fixture');
  r=await check('approved-input',[{type:'fill',selector:'#name',file:'inputs/approved.txt'},{type:'assert',expression:"document.getElementById('name').value==='approved fixture'"}],['--allow-script']);assert(r.ok);pass('Curated file input and explicitly enabled script assertions remain functional');
  r=await check('raw-denied',[{type:'cdp',method:'Network.getCookies'}],[],1);assert.match(r.error,/allow-raw-cdp/);pass('H-2 non-allowlisted CDP requires an explicit caller flag');
  r=await check('raw-allowed',[{type:'cdp',method:'Runtime.getIsolateId'}],['--allow-raw-cdp']);assert(r.ok);assert(r.summary.securityPolicy.cdpMethods.includes('Runtime.getIsolateId'));pass('Advanced CDP remains available with an explicit flag and method audit trail');
  r=await check('script-readonly',[{type:'eval',expression:'1'}],['--read-only'],1);assert.match(r.error,/read-only/);pass('Read-only mode refuses custom JavaScript');
  r=await check('result-budget',[{type:'eval',expression:"'x'.repeat(3000)"}],['--allow-script','--max-result-kb','1']);assert(r.steps.find(s=>s.type==='eval').resultTruncated);assert.equal(r.summary.captureComplete,false);pass('L-4 oversized eval output is omitted and marked incomplete');
  r=await cmd('launch',['--state-dir',state,'--headless'],1);assert.match(r.error,/allow-tcp-debugging/);pass('Persistent TCP debugging requires deliberate opt-in');
  const launch=await cmd('launch',['--state-dir',state,'--headless','--allow-tcp-debugging']);live=true;
  r=await cmd('status',['--endpoint',launch.endpoint],1);assert.match(r.error,/allow-external-browser/);pass('M-1 external endpoints require explicit consent at the caller');
  const target=(await cmd('new',['--state-dir',state,'--url',url])).targetId;
  const tabs=await cmd('tabs',['--state-dir',state]);assert(!JSON.stringify(tabs).includes('TESTSECRET123'));pass('L-1 tab listing redacts URL query values');
  const externalPlan=path.join(work,'external.json');await writeJSON(externalPlan,{actions:[{type:'eval',expression:'1'}]});
  r=await cmd('run',['--endpoint',launch.endpoint,'--allow-external-browser','--tab',target,'--plan',externalPlan],1);assert.match(r.error,/read-only/);pass('M-1 external browser defaults to observation-only actions');
  await writeJSON(externalPlan,{name:'external-observation',actions:[{type:'waitForSelector',selector:'main'},{type:'inspect'}]});
  const a=await cmd('run',['--endpoint',launch.endpoint,'--allow-external-browser','--tab',target,'--plan',externalPlan]);
  const b=await cmd('run',['--endpoint',launch.endpoint,'--allow-external-browser','--tab',target,'--plan',externalPlan]);
  assert(compareReports(a,b).comparable);pass('External observation captures retain comparable private HMAC context within their work directory');
  const stopped=await cmd('stop',['--state-dir',state,'--purge-profile']);live=false;assert(stopped.profilePurged);await assert.rejects(fs.access(launch.profile));pass('M-3 explicit purge removes only the owned profile');
  await writeJSON(path.join(work,'review-browser-validation.json'),{testedAt:new Date().toISOString(),checks,allPassed:true,transport:'pipe and opt-in TCP',count:checks.length});
}finally{if(live)await cmd('stop',['--state-dir',state,'--purge-profile']);await new Promise(r=>server.close(r));}
