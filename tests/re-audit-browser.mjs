import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {args,required,writeJSON} from '../web-debug/scripts/common.mjs';

const exec=promisify(execFile),options=args(process.argv.slice(2)),work=path.resolve(required(options,'work'));
await fs.mkdir(work,{recursive:true});
const cli=fileURLToPath(new URL('../web-debug/scripts/chrome.mjs',import.meta.url)),state=path.join(work,'state'),checks=[],baseline=[];
const pass=label=>{checks.push(label);console.log('PASS '+label);};let requests=0;
const server=http.createServer((q,r)=>{requests++;r.setHeader('Content-Type','text/html');r.end('<!doctype html><html lang="en"><title>Re-audit fixture</title><body><main><h1>Debugger fixture</h1><input type="file"></main><script>setInterval(()=>{debugger;},50);</script></body></html>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`;
async function run(tool,extra,expected=0){try{const r=await exec(process.execPath,[tool,'check','--state-dir',state,'--url',url,...extra],{windowsHide:true,timeout:45000,maxBuffer:8000000});assert.equal(expected,0);return JSON.parse(r.stdout);}catch(e){if(expected&&e.code===expected)return JSON.parse(e.stdout||e.stderr);throw e;}}
async function scenario(name,actions){const file=path.join(work,name+'.json');await writeJSON(file,{name,actions});return file;}
try {
  const debuggerPlan=await scenario('debugger',[{type:'cdp',method:'Debugger.enable'},{type:'wait',ms:250},{type:'inspect'},{type:'audit'}]);
  if(options.baseline){const started=Date.now(),r=await run(path.resolve(options.baseline,'scripts/chrome.mjs'),['--plan',debuggerPlan],1);assert(r.steps.some(s=>s.type==='inspect'&&!s.ok&&/timeout/i.test(s.error)));assert(!r.steps.some(s=>s.type==='audit'));baseline.push({id:'N-1',confirmed:true,elapsedMs:Date.now()-started,failure:r.steps.find(s=>!s.ok)});}
  let count=requests;
  let r=await run(cli,['--plan',debuggerPlan],1);assert.match(r.error,/allow-raw-cdp/);assert.equal(requests,count);pass('N-1 default debugger activation is refused before opening the page');
  r=await run(cli,[]);assert(r.ok);assert(r.steps.some(s=>s.type==='audit'&&s.ok));pass('N-1 quick observation succeeds on a page containing repeated debugger statements');
  const inputs=path.join(work,'inputs');await fs.mkdir(inputs,{recursive:true});
  let caseInsensitive=false;try{caseInsensitive=(await fs.stat(inputs)).ino===(await fs.stat(path.join(work,'Inputs'))).ino;}catch{}
  const casingPlan=await scenario('casing',[{type:'screenshot',path:'Inputs/capture.png'}]);
  if(options.baseline&&caseInsensitive){r=await run(path.resolve(options.baseline,'scripts/chrome.mjs'),['--plan',casingPlan,'--overwrite']);assert(r.ok);assert((await fs.stat(path.join(inputs,'capture.png'))).size>0);baseline.push({id:'N-3',confirmed:true,caseInsensitiveFilesystem:true});}
  const sentinel=path.join(inputs,'capture.png');await fs.writeFile(sentinel,'preserve approved input');count=requests;
  r=await run(cli,['--plan',casingPlan,'--overwrite'],1);assert.match(r.error,/inputs/);assert.equal(requests,count);assert.equal(await fs.readFile(sentinel,'utf8'),'preserve approved input');pass('N-3 mixed-case output cannot overwrite approved inputs, even with overwrite enabled');
  const alias=path.join(work,'input-alias');await fs.symlink(inputs,alias,process.platform==='win32'?'junction':'dir');
  r=await run(cli,['--plan',await scenario('alias',[{type:'screenshot',path:'input-alias/capture.png'}]),'--overwrite'],1);assert.match(r.error,/links/);assert.equal(await fs.readFile(sentinel,'utf8'),'preserve approved input');pass('N-3 internal directory aliases cannot bypass the input/output boundary');
  for(const method of ['DOM.setFileInputFiles','DOM.getFileInfo','Page.setDownloadBehavior','Target.sendMessageToTarget']) {
    count=requests;r=await run(cli,['--plan',await scenario(method.replace('.','-'),[{type:'cdp',method}]),'--allow-raw-cdp'],1);assert.match(r.error,/not supported/);assert.equal(requests,count);
  }
  pass('N-2 browser file and nested-target methods are rejected before Chrome launch despite raw opt-in');
  r=await run(cli,['--plan',await scenario('advanced',[{type:'cdp',method:'Runtime.getIsolateId'},{type:'screenshot',path:'evidence/capture.png'}]),'--allow-raw-cdp']);assert(r.ok);assert(r.securityPolicy.rawCdpEnabled);assert.match(r.securityPolicy.planPathGuards,/not a browser or OS sandbox/);assert((await fs.stat(path.join(work,'evidence/capture.png'))).size>0);pass('Advanced diagnostics and regular screenshot output still work with explicit policy recorded');
  await writeJSON(path.join(work,'re-audit-browser-validation.json'),{testedAt:new Date().toISOString(),platform:process.platform,node:process.version,browser:r.browser,caseInsensitiveFilesystem:caseInsensitive,checks,allPassed:true,count:checks.length,baseline});
}finally{await new Promise(r=>server.close(r));}
