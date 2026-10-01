import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {countEvents,validateEventMatch,summarizeReport,compareReports,summarizeTrace,addAccessibilityAudit} from '../web-debug/scripts/diagnostics.mjs';
import {inspectProject} from '../web-debug/scripts/project.mjs';
import {writeJSON} from '../web-debug/scripts/common.mjs';

const context={url:'http://localhost:3000/',viewport:{width:390,height:844,dpr:1}};
const base={ok:true,scenario:'menu',context,steps:[{type:'inspect',ok:true,result:{}}],events:[],droppedEvents:0};
test('event counts select the expected response and respect checkpoints',()=>{
  const events=[{kind:'response',status:200,url:'http://local/api'},{kind:'response',status:500,url:'http://local/api'},{kind:'console',level:'error',text:'bad state'}];
  assert.equal(countEvents(events,{kind:'response',urlIncludes:'/api',statusMin:400}),1);
  assert.equal(countEvents(events,{kind:'response',status:200},1),0);
  assert.equal(countEvents(events,{kind:'console',level:'error',textIncludes:'state'}),1);
});
test('event filter typos cannot silently pass absence assertions',()=>{
  for(const match of [{},{kind:'respnse'},{urlInclues:'/api'},{statusMin:600},{statusMin:500,statusMax:200}])assert.throws(()=>validateEventMatch(match));
});
test('analysis correlates failed responses, exceptions and collection steps',()=>{
  const result=summarizeReport({...base,events:[{kind:'response',status:500,url:'http://local/api?token=secret',step:3},{kind:'exception',text:'Error: render failed\n at app',step:4,stack:[{line:20}]}]});
  assert.equal(result.counts.httpErrors,1);assert.equal(result.counts.exceptions,1);
  assert.equal(result.findings.find(f=>f.code==='runtime-exception').evidence[0].step,4);
  assert(!JSON.stringify(result).includes('token=secret'));
  assert(result.findings.every(f=>f.conclusion==='signal-needs-investigation'));
});
test('canceled requests are counted separately from network failures',()=>{
  const result=summarizeReport({...base,events:[{kind:'network-error',canceled:true,id:'1'},{kind:'network-error',canceled:false,id:'2',error:'net::ERR_FAILED',corsErrorStatus:{corsError:'MissingAllowOriginHeader'}}]});
  assert.equal(result.counts.canceledRequests,1);assert.equal(result.counts.networkFailures,1);assert.equal(result.findings[0].code,'cors-failure');
});
test('UI candidates keep their viewport and affected element evidence',()=>{
  const result=summarizeReport({...base,steps:[{type:'audit',ok:true,result:{url:context.url,viewport:context.viewport,checks:[{rule:'broken-image',severity:'warning',count:2,evidence:['#hero','#avatar']}]}}]});
  assert.equal(result.counts.auditSignals,2);assert.match(result.findings[0].target,/390x844/);assert.deepEqual(result.findings[0].evidence[0].samples,['#hero','#avatar']);
});
test('accessibility names come from Chrome computed names, not inner text',()=>{
  const audit=addAccessibilityAudit({url:context.url,checks:[],coverage:{}},[{role:{value:'button'},name:{value:'Save'},ignored:false},{role:{value:'button'},name:{value:''},backendDOMNodeId:5,ignored:false},{role:{value:'link'},name:{value:''},ignored:true}]);
  assert.equal(audit.checks[0].count,1);assert.equal(audit.checks[0].evidence[0].backendDOMNodeId,5);
});
test('comparable captures distinguish absent, remaining and new signals',()=>{
  const before={...base,events:[{kind:'response',status:500,url:'http://local/api'}]};
  const after={...base,events:[{kind:'exception',text:'Error: new regression'}]};
  const result=compareReports(before,after);
  assert(result.comparable);assert.equal(result.absentAfter[0].code,'http-server-error');assert.equal(result.newAfter[0].code,'runtime-exception');assert.equal(result.remaining.length,0);
});
test('comparison refuses mismatched contexts or truncated event capture',()=>{
  assert.equal(compareReports(base,{...base,context:{...context,viewport:{width:1280,height:800,dpr:1}}}).comparable,false);
  assert.equal(compareReports(base,{...base,droppedEvents:3}).comparable,false);
  assert.equal(compareReports(base,{...base,context:null}).comparable,false);
  assert.equal(compareReports(base,{...base,scenario:'different-flow'}).comparable,false);
  assert.equal(compareReports({...base,context:{...context,urlKey:'query-one'}},{...base,context:{...context,urlKey:'query-two'}}).comparable,false);
  assert.match(compareReports({...base,context:{...context,urlKeyScope:'scope-one'}},{...base,context:{...context,urlKeyScope:'scope-two'}}).reason,/key scopes/);
});
test('a sampled UI scan cannot prove a clean before/after result',()=>{
  const report={...base,steps:[{type:'audit',ok:true,result:{checks:[],coverage:{truncated:true},viewport:context.viewport}}]};
  assert.equal(summarizeReport(report).auditCoverageComplete,false);
  assert.equal(compareReports(report,report).comparable,false);
});
test('trace triage converts duration units and preserves thread attribution',()=>{
  const result=summarizeTrace({traceEvents:[{ph:'M',name:'thread_name',pid:1,tid:2,args:{name:'CrRendererMain'}},{ph:'X',name:'FunctionCall',pid:1,tid:2,dur:80000},{ph:'X',name:'Layout',pid:1,tid:2,dur:5000},{ph:'X',name:'unrelated',dur:999999}]});
  assert.equal(result.topEvents[0].durationMs,80);assert(result.topEvents[0].rendererMainThread);assert.equal(result.sampleCount,2);assert.match(result.note,/overlap/);
});
test('project inventory distinguishes declared versions from installed packages without executing scripts',async()=>{
  const testRoot=path.resolve('work','diagnostics-unit');await fs.mkdir(testRoot,{recursive:true});const root=await fs.mkdtemp(path.join(testRoot,'project-'));
  await writeJSON(path.join(root,'package.json'),{name:'fixture',packageManager:'npm@10.0.0',scripts:{dev:'node malicious.js',test:'secret must not appear'},dependencies:{react:'^19.0.0',next:'^15.0.0'},workspaces:['apps/*']});
  await writeJSON(path.join(root,'node_modules/react/package.json'),{name:'react',version:'19.0.2'});
  await writeJSON(path.join(root,'apps/ui/package.json'),{name:'ui',dependencies:{react:'^19.0.0',vite:'^7.0.0'}});
  await fs.writeFile(path.join(root,'malicious.js'),"require('fs').writeFileSync('executed.txt','wrong')");
  await fs.writeFile(path.join(root,'.env'),'TOKEN=never-read-this');await fs.writeFile(path.join(root,'next.config.mjs'),"throw Error('do not execute config')");
  await fs.writeFile(path.join(root,'package-lock.json'),'{}');await fs.writeFile(path.join(root,'yarn.lock'),'');
  const result=await inspectProject(root);
  assert.equal(result.packages.length,2);const main=result.packages.find(p=>p.manifest==='package.json');
  assert.equal(main.frameworks.find(f=>f.name==='react').declared,'^19.0.0');assert.equal(main.frameworks.find(f=>f.name==='react').installed.version,'19.0.2');
  assert.equal(main.frameworks.find(f=>f.name==='next').installed,null);
  assert.equal(result.packages.find(p=>p.name==='ui').frameworks.find(f=>f.name==='react').installed.version,'19.0.2');
  assert(result.warnings.some(w=>w.code==='multiple-package-managers'));
  assert(result.configs.includes('next.config.mjs'));
  assert(!JSON.stringify(result).includes('never-read-this'));assert(!JSON.stringify(result).includes('secret must not appear'));
  await assert.rejects(fs.access(path.join(root,'executed.txt')));
});
