import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {args,required,writeJSON} from '../web-debug/scripts/common.mjs';
const exec=promisify(execFile);const options=args(process.argv.slice(2));
if(process.platform!=='win32'){console.log('SKIP: Windows smoke requires Windows');process.exit(0);}
const work=path.resolve(required(options,'work'));await fs.mkdir(work,{recursive:true});
const script=fileURLToPath(new URL('../web-debug/scripts/windows.ps1',import.meta.url));
const server=http.createServer((req,res)=>res.end('fixture'));await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port,checks=[];const shell=options.shell??'pwsh.exe';
try {
  const output=path.join(work,'windows-report.json');
  const {stdout}=await exec(shell,['-NoProfile','-File',script,'-ProjectRoot',work,'-Ports',String(port),'-OutFile',output],{windowsHide:true,timeout:20000,maxBuffer:2000000});
  const result=JSON.parse(stdout.replace(/^\uFEFF/,''));
  assert.equal(result.supported,true);assert(result.os?.caption);checks.push('Read the actual Windows product and PowerShell version');
  assert(result.tools.find(t=>t.name==='node.exe').found);checks.push('Detect installed tool paths without executing project tools');
  const p=result.ports.find(p=>p.port===port);assert.equal(p.querySucceeded,true);assert.equal(p.listening,true);assert(p.owners.some(o=>o.processId===process.pid));checks.push('Identify the process owning a controlled listening port');
  assert(server.listening);checks.push('Leave the inspected process and listening port running');
  assert.deepEqual(JSON.parse(await fs.readFile(output,'utf8')),result);checks.push('Save valid UTF-8 JSON evidence');
  const sentinel=path.join(work,'outside-fixture.txt'),link=path.join(work,'linked-output.json');await fs.writeFile(sentinel,'preserve fixture');
  try{await fs.symlink(sentinel,link,'file');}catch(error){if(error.code!=='EEXIST')throw error;}
  await assert.rejects(exec(shell,['-NoProfile','-File',script,'-ProjectRoot',work,'-OutFile',link],{windowsHide:true,timeout:20000}),/link|directory/);
  assert.equal(await fs.readFile(sentinel,'utf8'),'preserve fixture');checks.push('Refuse linked output without modifying its target');
  const gateway=fileURLToPath(new URL('../web-debug/scripts/debug.mjs',import.meta.url)),gatewayOut=path.join(work,'gateway.json');
  await exec(process.execPath,[gateway,'windows','--project',work,'--ports',`${port},1`,'--out',gatewayOut],{windowsHide:true,timeout:25000});
  const gatewayResult=JSON.parse(await fs.readFile(gatewayOut,'utf8'));assert.equal(gatewayResult.ports.length,2);assert(gatewayResult.ports.find(p=>p.port===port).listening);checks.push('Use multiple ports through the single Node entry point');
  await writeJSON(path.join(work,'windows-validation.json'),{testedAt:new Date().toISOString(),os:result.os,powerShell:result.powerShell,checks,allPassed:true});
  for(const check of checks)console.log('PASS '+check);
}finally{await new Promise(r=>server.close(r));}
