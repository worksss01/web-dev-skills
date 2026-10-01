import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { args, required, writeJSON } from '../web-debug/scripts/common.mjs';
import {compareReports,summarizeTrace} from '../web-debug/scripts/diagnostics.mjs';

const exec=promisify(execFile);
const options=args(process.argv.slice(2));
const work=path.resolve(required(options,'work'));
await fs.mkdir(work,{recursive:true});
const cli=fileURLToPath(new URL('../web-debug/scripts/chrome.mjs',import.meta.url));
const state=path.join(work,'chrome-state');
let repaired=false,launched=false;
const checks=[];
function passed(name) { checks.push(name);console.log(`PASS ${name}`); }
const server=http.createServer((req,res)=>{
  if(req.url.startsWith('/api')) {res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');return;}
  if(req.url!=='/') {res.writeHead(404);res.end('missing');return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Web Debug smoke fixture</title><style>
  body{font:16px system-ui;margin:24px;background:#f2f6fc;color:#142840} main{max-width:900px} .card{background:white;padding:24px;border:1px solid #aebfd3;border-radius:12px;box-sizing:border-box;width:${repaired?'100%':'720px'}} button,input{font:inherit;padding:10px;margin:8px 0} button{background:#174e8c;color:white;border:0;border-radius:5px} #cover{position:relative;width:150px;height:48px} #blocked{width:150px;margin:0} #overlay{position:absolute;inset:0;background:#aaa} @media(prefers-color-scheme:dark){body{background:#142840;color:white}.card{background:#203c5e}} </style></head>
  <body><main><h1>Direct Chrome verification</h1><div class="card"><h2>Local test form</h2><label for="name">Name</label><br><input id="name" value="old"><br><button id="save">Save locally</button><p id="result" aria-live="polite">Waiting</p><p>This fixture tests a real Chrome connection without provider browser tools.</p></div><div id="cover"><button id="blocked">Covered button</button><div id="overlay"></div></div><p><button class="duplicate">One</button><button class="duplicate">Two</button></p></main>
  <script>console.info('fixture ready'); document.querySelector('#save').addEventListener('click', async ()=>{ await fetch('/api?token=fixture-secret');document.querySelector('#result').textContent='Saved '+document.querySelector('#name').value;console.warn('fixture action warning');fetch('/missing');setTimeout(()=>{throw Error('fixture intentional exception')},0); });</script></body></html>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/`;
async function run(command, extra=[], expected=0) {
  try {
    const trusted=command==='launch'?['--allow-tcp-debugging']:command==='run'?['--allow-script','--overwrite']:[];
    const {stdout}=await exec(process.execPath,[cli,command,'--state-dir',state,...trusted,...extra],{timeout:45000,maxBuffer:8000000,windowsHide:true});
    assert.equal(expected,0,`Expected ${command} to fail`);return JSON.parse(stdout);
  } catch(error) {
    if(error.code===expected && expected!==0) return JSON.parse(error.stdout || error.stderr);
    throw error;
  }
}
let target;
async function plan(name,actions,expected=0) {
  const file=path.join(work,`${name}.json`);await writeJSON(file,{actions});
  return run('run',['--tab',target,'--plan',file,'--out',path.join(work,`${name}-report.json`)],expected);
}
try {
  const launch=await run('launch',['--headless',...(options.chrome?['--chrome',options.chrome]:[])]);launched=true;
  assert.match(launch.browser,/Chrome\//);passed('Launch isolated Chrome profile');
  assert.equal((await run('status')).owned,true);passed('Read browser identity');
  target=(await run('new',['--url','about:blank'])).targetId;
  assert((await run('tabs')).some(t=>t.id===target));passed('Create and explicitly select tab');
  const broken=await plan('before',[
    {type:'viewport',width:390,height:844},{type:'navigate',url},
    {type:'waitFor',expression:"document.readyState==='complete' && !!document.querySelector('#save')"},
    {type:'inspect'},{type:'audit'},{type:'screenshot',path:'before.png'},
    {type:'assert',expression:'document.documentElement.scrollWidth <= innerWidth+1',message:'Reproduced horizontal overflow'}
  ],1);
  assert.equal(broken.ok,false);assert.match(broken.steps.at(-1).error,/overflow/);passed('Reproduce overflow and return nonzero assertion failure');
  assert(broken.summary.findings.some(f=>f.code==='ui-horizontal-overflow'));passed('Automatically identify overflow with viewport and element evidence');
  repaired=true;
  const fixed=await plan('after',[
    {type:'viewport',width:390,height:844},{type:'traceStart'},{type:'navigate',url},
    {type:'waitFor',expression:"document.readyState==='complete' && !!document.querySelector('#save')"},
    {type:'fill',selector:'#name',text:'Chrome ทดสอบ'},
    {type:'checkpoint',name:'save-flow'},
    {type:'click',selector:'#save'},
    {type:'waitEvent',since:'save-flow',match:{kind:'response',urlIncludes:'/api',status:200}},
    {type:'waitFor',expression:"document.querySelector('#result').textContent === 'Saved Chrome ทดสอบ'"},
    {type:'wait',ms:350},
    {type:'assertEvents',since:'save-flow',match:{kind:'response',urlIncludes:'/api',status:200},minCount:1,maxCount:1},
    {type:'assert',expression:'document.documentElement.scrollWidth <= innerWidth+1'},
    {type:'inspect'},{type:'accessibility'},{type:'metrics'},
    {type:'screenshot',path:'after-mobile.png',fullPage:true},
    {type:'media',colorScheme:'dark',reducedMotion:true},
    {type:'assert',expression:"matchMedia('(prefers-color-scheme: dark)').matches && matchMedia('(prefers-reduced-motion: reduce)').matches"},
    {type:'viewport',width:1280,height:800},
    {type:'screenshot',path:'after-desktop.png'},
    {type:'traceStop',path:'trace.json'}
  ]);
  assert.equal(fixed.ok,true);passed('Replay repaired layout at mobile and desktop sizes');
  passed('Fill Unicode text and dispatch pointer click with observable state change');
  passed('Wait for and assert the actual API response within an explicit checkpoint');
  assert(fixed.events.some(e=>e.kind==='console'&&e.text.includes('fixture action warning')));passed('Capture console while actions execute');
  assert(fixed.events.some(e=>e.kind==='exception'&&e.text.includes('fixture intentional exception')));passed('Capture runtime exception');
  assert(fixed.events.find(e=>e.kind==='exception').stack.some(f=>f.line>0));passed('Capture application stack locations and event collection steps');
  assert(fixed.events.some(e=>e.kind==='request-finished'&&e.durationMs>=0));passed('Capture completed-request timing and transferred bytes');
  assert(fixed.events.some(e=>e.kind==='response'&&e.status===404));passed('Capture HTTP error separately from transport failure');
  assert(fixed.events.some(e=>e.kind==='request'&&e.url.includes('/api')));
  assert(!JSON.stringify(fixed.events).includes('fixture-secret'));passed('Redact query values in network evidence');
  assert(fixed.steps.find(s=>s.type==='accessibility').result.nodes.some(n=>n.name?.value==='Name'));passed('Read actual accessibility labels');
  assert(fixed.steps.find(s=>s.type==='metrics').result.metrics.length>0);passed('Read CDP performance metrics');
  const trace=JSON.parse(await fs.readFile(path.join(work,'trace.json'),'utf8'));
  assert(Array.isArray(trace.traceEvents)&&trace.traceEvents.length>0);passed('Stream parseable performance trace to disk');
  assert(summarizeTrace(trace).topEvents.length>0);passed('Analyze timing samples from a real Chrome trace');
  for(const name of ['before.png','after-mobile.png','after-desktop.png']) {
    const data=await fs.readFile(path.join(work,name));assert.equal(data.subarray(1,4).toString(),'PNG');
  }passed('Write real PNG screenshots');
  const blocked=await plan('blocked',[{type:'click',selector:'#blocked'}],1);
  assert.match(blocked.steps[0].error,/covered/);passed('Refuse covered element click');
  const duplicate=await plan('duplicate',[{type:'click',selector:'.duplicate'}],1);
  assert.match(duplicate.steps[0].error,/exactly one/);passed('Refuse ambiguous selector');
  const keyboard=await plan('keyboard',[
    {type:'click',selector:'#name'},{type:'key',key:'Tab'},
    {type:'assert',expression:"document.activeElement.id==='save'"},
    {type:'key',key:'Enter'},{type:'wait',ms:200},
    {type:'assert',expression:"!matchMedia('(prefers-color-scheme: dark)').matches"}
  ]);
  assert(keyboard.ok);passed('Dispatch keyboard focus/activation and clear media overrides after a plan');
  const bad=await plan('bad-script',[{type:'eval',expression:"throw new Error('page evaluation failure')"}],1);
  assert.match(bad.steps[0].error,/page evaluation failure/);passed('Propagate page evaluation exceptions');

  const eventFailure=await plan('event-regression',[
    {type:'checkpoint',name:'fresh'},{type:'eval',expression:"fetch('/missing')"},
    {type:'waitEvent',since:'fresh',match:{kind:'response',urlIncludes:'/missing',status:404}},
    {type:'assertEvents',since:'fresh',match:{kind:'response',statusMin:400},maxCount:0}
  ],1);
  assert.match(eventFailure.steps.at(-1).error,/Event count/);passed('Fail a network regression even when the page still renders');
  const auditBad=await plan('audit-before',[
    {type:'eval',expression:"(() => {const image=document.createElement('img');image.id='bad-image';image.src='/missing-image';image.width=60;image.height=60;document.body.append(image);const button=document.createElement('button');button.id='unnamed';document.body.append(button);return true})()"},
    {type:'waitFor',expression:"document.querySelector('#bad-image').complete"},{type:'audit'}
  ]);
  const auditCheck=auditBad.steps.find(s=>s.type==='audit').result.checks;
  assert(auditCheck.some(c=>c.rule==='broken-image'&&c.count>0));assert(auditCheck.some(c=>c.rule==='unnamed-control'&&c.count>0));
  passed('Find broken images and unnamed controls using real DOM and accessibility tree');
  const auditFixed=await plan('audit-after',[
    {type:'eval',expression:"document.querySelector('#bad-image').remove();document.querySelector('#unnamed').remove();true"},{type:'audit'}
  ]);
  const comparison=compareReports(auditBad,auditFixed);
  assert(comparison.comparable);assert(comparison.absentAfter.some(f=>f.code==='ui-broken-image'));assert(!comparison.newAfter.length);
  passed('Compare matching captures and identify UI signals absent after repair');
  const analyzer=fileURLToPath(new URL('../web-debug/scripts/analyze.mjs',import.meta.url));
  await exec(process.execPath,[analyzer,'--report',path.join(work,'after-report.json'),'--trace',path.join(work,'trace.json'),'--out',path.join(work,'analysis.json'),'--markdown',path.join(work,'analysis.md')],{timeout:15000,maxBuffer:8000000,windowsHide:true});
  assert((await fs.readFile(path.join(work,'analysis.md'),'utf8')).includes('Browser evidence review'));passed('Generate offline JSON and Markdown investigation reports');

  const seoBefore=await plan('seo-before',[
    {type:'eval',expression:"(() => {const meta=document.createElement('meta');meta.name='robots';meta.content='noindex';meta.id='test-robots';document.head.append(meta);const ld=document.createElement('script');ld.type='application/ld+json';ld.id='test-jsonld';ld.textContent='{invalid json';document.head.append(ld);return true})()"},
    {type:'seoAudit',indexing:'public'}
  ]);
  const seoFindings=seoBefore.steps.find(s=>s.type==='seoAudit').result;
  assert(seoFindings.checks.some(c=>c.rule==='noindex-needs-intent-check'&&c.count===1));
  assert(seoFindings.checks.some(c=>c.rule==='invalid-json-ld-syntax'&&c.count===1));passed('Detect a public-page noindex signal and malformed JSON-LD in Chrome');
  const privateSEO=await plan('seo-private',[{type:'seoAudit',indexing:'private'}]);
  assert(!privateSEO.steps[0].result.checks.some(c=>c.rule==='noindex-needs-intent-check'));passed('Respect deliberate noindex on private pages');
  assert.equal(compareReports(seoBefore,privateSEO).comparable,false);passed('Do not compare SEO audits with different indexing intent');
  const seoAfter=await plan('seo-after',[
    {type:'eval',expression:"(() => {document.querySelector('#test-robots').remove();document.querySelector('#test-jsonld').textContent=JSON.stringify({'@context':'https://schema.org','@graph':[{'@type':'WebPage','name':'Fixture'}]});const meta=document.createElement('meta');meta.name='description';meta.content='A local verification fixture.';document.head.append(meta);const canonical=document.createElement('link');canonical.rel='canonical';canonical.href=location.origin+'/';document.head.append(canonical);return true})()"},
    {type:'seoAudit',indexing:'public'}
  ]);
  const seoFixed=seoAfter.steps.find(s=>s.type==='seoAudit').result;
  assert(seoFixed.structuredData[0].syntaxValid);assert(seoFixed.structuredData[0].types.includes('WebPage'));assert(!seoFixed.checks.some(c=>c.count>0));passed('Recognize repaired metadata and parse JSON-LD graph types without executing data');
  assert(compareReports(seoBefore,seoAfter).absentAfter.some(f=>f.code==='seo-invalid-json-ld-syntax'));passed('Compare SEO observations before and after a targeted repair');
  const designBefore=await plan('design-before',[
    {type:'eval',expression:"(() => {const p=document.createElement('p');p.id='low-contrast';p.textContent='Contrast fixture';p.style.cssText='color:rgb(120,120,120);background-color:rgb(120,120,120);font-size:16px';document.body.append(p);const b=document.createElement('button');b.id='tiny-control';b.textContent='x';b.style.cssText='width:10px;height:10px;padding:0';document.body.append(b);const complex=document.createElement('p');complex.id='complex-color';complex.textContent='Gradient fixture';complex.style.cssText='color:white;background-color:white;background-image:linear-gradient(black,white)';document.body.append(complex);return true})()"},
    {type:'designAudit'}
  ]);
  const design=designBefore.steps.find(s=>s.type==='designAudit').result;
  assert(design.checks.some(c=>c.rule==='simple-text-contrast-candidate'&&c.evidence.some(e=>e.element==='#low-contrast'&&e.ratio===1)));
  assert(design.checks.some(c=>c.rule==='small-control-candidate'&&c.evidence.some(e=>e.element==='#tiny-control')));passed('Measure simple text contrast and undersized control candidates');
  assert(design.contrast.complexSamplesSkipped>0);assert(!design.contrast.measured.some(e=>e.element==='#complex-color'));passed('Skip complex gradient contrast instead of inventing a ratio');
  const designAfter=await plan('design-after',[
    {type:'eval',expression:"document.querySelector('#low-contrast').style.color='black';document.querySelector('#low-contrast').style.backgroundColor='white';document.querySelector('#tiny-control').style.width='44px';document.querySelector('#tiny-control').style.height='44px';true"},
    {type:'designAudit'}
  ]);
  assert(compareReports(designBefore,designAfter).absentAfter.some(f=>f.code==='design-simple-text-contrast-candidate'));passed('Verify design signals after fixing measured contrast and control size');
  const missing=await run('run',['--plan',path.join(work,'before.json')],1);
  assert.match(missing.error,/tab/);passed('Require an explicit target');
  try {await exec(process.execPath,[cli,'status','--endpoint','http://example.com:9222'],{windowsHide:true});throw new Error('remote endpoint accepted');}
  catch(error) {assert.match(error.stderr,/loopback/);}passed('Refuse remote debugging endpoint');
  const sessionFile=path.join(state,'session.json');
  const session=JSON.parse(await fs.readFile(sessionFile,'utf8'));
  await writeJSON(sessionFile,{...session,browserPath:'/devtools/browser/wrong-instance'});
  try {const wrong=await run('status',[],1);assert.match(wrong.error,/Stale session/);}
  finally {await writeJSON(sessionFile,session);}passed('Reject stale browser identity');
  try {await exec(process.execPath,[cli,'stop','--endpoint',session.endpoint,'--allow-external-browser'],{windowsHide:true});throw new Error('external stop accepted');}
  catch(error) {assert.match(error.stderr,/owned/);}passed('Refuse closing an externally attached browser');
  await writeJSON(path.join(work,'validation.json'),{testedAt:new Date().toISOString(),platform:process.platform,node:process.version,browser:launch.browser,checks,allPassed:true});
} finally {
  if(launched) {await run('stop');console.log('Closed owned test Chrome; profile retained in work.');}
  await new Promise(resolve=>server.close(resolve));
}
