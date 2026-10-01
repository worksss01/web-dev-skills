import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {args,required,writeJSON} from '../web-debug/scripts/common.mjs';
const exec=promisify(execFile),o=args(process.argv.slice(2)),work=path.resolve(required(o,'work')),state=path.join(work,'state');await fs.mkdir(work,{recursive:true});
const cli=fileURLToPath(new URL('../web-debug/scripts/chrome.mjs',import.meta.url)),checks=[],baseline=[];let requests=0;
const server=http.createServer((q,r)=>{requests++;r.setHeader('Content-Type','text/html');r.end('<!doctype html><html lang="en"><title>Drag fixture</title><body style="margin:0"><div id="drop" style="width:100vw;height:100vh">Drop here</div><script>const drop=document.querySelector("#drop");drop.addEventListener("dragover",e=>e.preventDefault());drop.addEventListener("drop",async e=>{e.preventDefault();window.received={files:e.dataTransfer.files.length,text:e.dataTransfer.getData("text/plain")};if(e.dataTransfer.files.length)window.received.fileText=await e.dataTransfer.files[0].text();});</script></body></html>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/`;
const pass=label=>{checks.push(label);console.log('PASS '+label);};
async function run(tool,plan,flags=[],expected=0){try{const r=await exec(process.execPath,[tool,'check','--url',url,'--state-dir',state,'--plan',plan,...flags],{windowsHide:true,timeout:30000,maxBuffer:6000000});assert.equal(expected,0);return JSON.parse(r.stdout);}catch(e){if(expected&&e.code===expected)return JSON.parse(e.stdout||e.stderr);throw e;}}
async function save(name,actions){const file=path.join(work,name+'.json');await writeJSON(file,{name,actions});return file;}
const drag=data=>['dragEnter','dragOver','drop'].map(type=>({type:'cdp',method:'Input.dispatchDragEvent',params:{type,x:100,y:100,data}}));
try {
  const file=path.join(work,'synthetic-source.txt'),sentinel='SYNTHETIC_LOCAL_FILE_FIXTURE_ONLY';await fs.writeFile(file,sentinel);
  const filesPlan=await save('local-files',[{type:'waitForSelector',selector:'#drop'},...drag({items:[],files:[file],dragOperationsMask:1}),{type:'waitFor',expression:`window.received?.fileText===${JSON.stringify(sentinel)}`,timeoutMs:2000}]);
  if(o.baseline){try{const report=await run(path.resolve(o.baseline,'scripts/chrome.mjs'),filesPlan,['--allow-raw-cdp']);baseline.push({id:'N-2-file-drag',actualSyntheticFileRead:report.ok,browser:report.browser,scope:'A generated fixture file in this work directory; no personal files or external upload'});}catch(e){baseline.push({id:'N-2-file-drag',actualSyntheticFileRead:false,error:String(e.message).slice(0,400)});}}
  for(const flags of [[],['--allow-raw-cdp']]){const count=requests,r=await run(cli,filesPlan,flags,1);assert.match(r.error,/Dragging local files/);assert.equal(requests,count);assert.equal(await fs.readFile(file,'utf8'),sentinel);pass(`File drag is rejected before navigation ${flags.length?'with':'without'} raw opt-in`);}
  for(const method of ['Extensions.loadUnpacked','PWA.launchFilesInApp','FutureDomain.readLocalFile']){const count=requests,r=await run(cli,await save(method,[{type:'cdp',method,params:{files:[file],path:work}}]),['--allow-raw-cdp'],1);assert.match(r.error,/domain.*not supported/);assert.equal(requests,count);}
  pass('Extension/PWA and unknown-domain plans fail before browser navigation');
  let browser;
  for(const files of [undefined,[]]){
    const data={items:[{mimeType:'text/plain',data:'plain drag fixture'}],dragOperationsMask:1,...(files?{files}:{})};
    const plan=await save(files?'empty-files':'data-only',[{type:'waitForSelector',selector:'#drop'},...drag(data),{type:'waitFor',expression:'window.received?.text === "plain drag fixture" && window.received.files === 0',timeoutMs:2000}]);
    const r=await run(cli,plan,['--allow-raw-cdp']);assert(r.ok);assert(r.profilePurged);browser=r.browser;pass(`Actual data-only drag/drop remains functional ${files?'with an empty files array':'without a files field'}`);
  }
  await writeJSON(path.join(work,'file-drag-validation.json'),{testedAt:new Date().toISOString(),browser,platform:process.platform,checks,count:checks.length,allPassed:true,baseline});
}finally{await new Promise(r=>server.close(r));}
