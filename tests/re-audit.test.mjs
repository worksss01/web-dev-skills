import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {validatePlan,planPath} from '../web-debug/scripts/plan.mjs';
import {readText} from '../web-debug/scripts/common.mjs';
import {inspectProject} from '../web-debug/scripts/project.mjs';

const plan=method=>({actions:[{type:'cdp',method}]});
async function fixture(){const root=path.resolve('work/re-audit-unit');await fs.mkdir(root,{recursive:true});return fs.mkdtemp(path.join(root,'case-'));}

test('N-1 debugger activation requires raw opt-in; cleanup and advanced debugging remain available',()=>{
  assert.throws(()=>validatePlan(plan('Debugger.enable')),/allow-raw-cdp/);
  validatePlan(plan('Debugger.enable'),{allowRawCdp:true});
  validatePlan(plan('Debugger.disable'));
});
test('N-2 direct browser file methods and nested Target escape routes are blocked even with raw opt-in',()=>{
  for(const method of ['DOM.setFileInputFiles','DOM.getFileInfo','Page.setDownloadBehavior','Browser.setDownloadBehavior','Target.createTarget','Target.sendMessageToTarget','Target.attachToTarget']) {
    for(const policy of [{},{allowRawCdp:true}])assert.throws(()=>validatePlan(plan(method),policy),/not supported/);
  }
  validatePlan(plan('Runtime.getIsolateId'),{allowRawCdp:true});
  // Session access is intentionally still privileged, not represented as file containment.
  validatePlan(plan('Storage.getCookies'),{allowRawCdp:true});
});
test('N-3 output input-directory matching is case-insensitive on every OS',()=>{
  for(const prefix of ['inputs','Inputs','INPUTS','iNpUtS']) {
    assert.throws(()=>planPath(prefix+'/capture.png','screenshot'),/inputs/);
    assert.throws(()=>planPath(prefix+'\\trace.json','traceStop'),/inputs/);
  }
  assert.equal(planPath('inputs/data.txt','input'),'inputs/data.txt');
  assert.equal(planPath('inputshots/capture.png','screenshot'),'inputshots/capture.png');
});
test('L-5 guarded descriptor reads reject static links, directories and oversized manifests',async()=>{
  const root=await fixture(),file=path.join(root,'source.json'),link=path.join(root,'alias.json');
  await fs.writeFile(file,'{"name":"fixture"}');await fs.symlink(file,link,'file');
  await assert.rejects(readText(link,2000000,{noFollow:true}),/symlink/);
  await assert.rejects(readText(root,2000000,{noFollow:true}),/regular/);
  await assert.rejects(readText(file,2,{noFollow:true}),/no larger/);
  assert.equal(JSON.parse(await readText(file,2000000,{noFollow:true})).name,'fixture');
  const hardlink=path.join(root,'package-manager-hardlink.json');await fs.link(file,hardlink);
  assert.equal(JSON.parse(await readText(hardlink,2000000,{noFollow:true})).name,'fixture');
});
test('L-5 project manifest replacement between lstat and open is detected before content is read',async t=>{
  const root=await fixture(),file=path.join(root,'package.json');await fs.writeFile(file,'{"name":"original"}');
  const open=fs.open;let swapped=false;
  t.mock.method(fs,'open',async function(candidate,...rest){
    if(candidate===file&&!swapped){swapped=true;await fs.rename(file,path.join(root,'previous.json'));await fs.writeFile(file,'{"name":"PRIVATE_REPLACEMENT_MUST_NOT_APPEAR"}');}
    return open.call(fs,candidate,...rest);
  });
  const report=await inspectProject(root);
  assert(swapped);assert.equal(report.packages.length,0);assert(!JSON.stringify(report).includes('PRIVATE_REPLACEMENT'));
  assert(report.warnings.some(w=>w.code==='unreadable-manifest'&&w.detail.includes('changed during verification')));
});
test('L-5 manifest growth after the initial check is bounded by the opened descriptor',async t=>{
  const root=await fixture(),file=path.join(root,'package.json');await fs.writeFile(file,'{}');
  const open=fs.open;let grown=false;
  t.mock.method(fs,'open',async function(candidate,...rest){if(candidate===file&&!grown){grown=true;await fs.appendFile(file,' '.repeat(2000001));}return open.call(fs,candidate,...rest);});
  const report=await inspectProject(root);assert(grown);assert.equal(report.packages.length,0);
  assert(report.warnings.some(w=>w.code==='unreadable-manifest'&&w.detail.includes('no larger')));
});
