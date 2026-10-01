import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {inspectEdge,probeOnce,targetURL,explainEdge} from '../web-debug/scripts/edge.mjs';
import {inspectGitHub,githubTarget,ghRequestArgs} from '../web-debug/scripts/github.mjs';
import {inspectProject} from '../web-debug/scripts/project.mjs';
import {writeJSON} from '../web-debug/scripts/common.mjs';

test('edge probe refuses credential-bearing and non-http URLs',()=>{
  for(const value of ['https://user:secret@example.com','file:///secret','javascript:alert(1)'])assert.throws(()=>targetURL(value));
});
test('edge HEAD probe collects diagnostic headers without cookies or response bodies',async()=>{
  let observed;
  const server=http.createServer((req,res)=>{observed={method:req.method,headers:req.headers};res.writeHead(522,{'server':'cloudflare','cf-ray':'fixture-ray','cf-cache-status':'MISS','set-cookie':'secret=never-export','x-secret-header':'never-export','content-type':'text/plain'});res.end('private body');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try {
    const result=await inspectEdge(`http://127.0.0.1:${server.address().port}/?secret=value`);
    assert.equal(observed.method,'HEAD');assert.equal(observed.headers.authorization,undefined);assert.equal(observed.headers.cookie,undefined);
    assert(result.findings.some(f=>f.code==='cloudflare-522'));
    assert(!JSON.stringify(result).includes('never-export'));assert(!JSON.stringify(result).includes('private body'));assert(!result.target.includes('secret=value'));
    assert.equal(result.dns.inputIsIP,true);
  }finally{await new Promise(r=>server.close(r));}
});
test('edge metadata cannot imply an origin certificate was inspected',()=>{
  const findings=explainEdge([{status:526,headers:{'cf-ray':'fixture'},tls:{daysUntilExpiry:10}}]);
  assert(findings.some(f=>f.code==='cloudflare-526'));assert(findings.some(f=>f.code==='certificate-expiry-window'&&/not an origin/.test(f.detail)));
  assert.equal(explainEdge([{status:522,headers:{}}])[0].code,'http-error');
});
test('redirect follow stops at origin boundary without contacting that destination',async()=>{
  const calls=[];
  const result=await inspectEdge('https://example.com/',{follow:true,lookup:async()=>({}),probe:async url=>{calls.push(url);return {status:302,url,headers:{},redirect:'https://other.example/path'};}});
  assert.equal(result.redirectStop,'origin-changed');assert.equal(calls.length,1);
});
test('redirect loops are bounded and not retried indefinitely',async()=>{
  let calls=0;
  const result=await inspectEdge('https://example.com/',{follow:true,lookup:async()=>({}),probe:async url=>{calls++;return {status:302,url,headers:{},redirect:url};}});
  assert.equal(result.redirectStop,'loop');assert.equal(calls,1);
});
test('failed direct DNS queries do not override a successful OS and HTTP result',async()=>{
  const result=await inspectEdge('https://example.com/',{lookup:async()=>({A:{error:'ETIMEOUT'},AAAA:{error:'ETIMEOUT'},systemLookup:{addresses:[{address:'192.0.2.1',family:4}]}}),probe:async url=>({url,status:200,headers:{},redirect:null})});
  assert.equal(result.hops[0].status,200);assert(result.findings.some(f=>f.code==='dns-record-query-incomplete'));assert(!result.findings.some(f=>f.code==='http-error'));
});
test('malformed redirects become probe errors instead of uncaught callback exceptions',async()=>{
  const server=http.createServer((req,res)=>{res.writeHead(302,{location:'https://['});res.end();});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{await assert.rejects(probeOnce(`http://127.0.0.1:${server.address().port}/`),/Invalid URL/);}finally{await new Promise(r=>server.close(r));}
});
test('GitHub identifiers do not accept shell syntax or arbitrary endpoints',()=>{
  assert.equal(githubTarget('owner/repo').host,'github.com');
  for(const repo of ['owner/repo;echo bad','https://github.com/owner/repo','owner/../secret','-x'])assert.throws(()=>githubTarget(repo));
  assert.throws(()=>githubTarget('owner/repo','github.com/path'));
  assert.deepEqual(ghRequestArgs('github.com','repos/o/r').slice(0,5),['api','--hostname','github.com','--method','GET']);
});
const sha='a'.repeat(40),older='b'.repeat(40);
function fakeGithub({runSha=sha,empty=false,truncated=false}={}) {
  const calls=[];
  return {calls,request:async(host,endpoint)=>{
    calls.push({host,endpoint});
    if(endpoint==='repos/owner/repo')return {full_name:'owner/repo',default_branch:'main',private:true,html_url:'https://github.com/owner/repo'};
    if(endpoint.endsWith('/pulls/7'))return {number:7,title:'Fixture',head:{sha,ref:'fix'},base:{ref:'main'},body:'private body must not be copied'};
    if(endpoint.includes('/check-runs?'))return {total_count:truncated?101:empty?0:1,check_runs:empty?[]:[{id:1,name:'build',head_sha:sha,status:'completed',conclusion:'success',output:{text:'private log must not be copied'}}]};
    if(endpoint.endsWith('/status?per_page=100'))return {total_count:0,statuses:[]};
    if(endpoint.endsWith('/actions/runs/9'))return {id:9,name:'CI',head_sha:runSha,run_attempt:2,status:'completed',conclusion:'failure',event:'pull_request'};
    if(endpoint.endsWith('/actions/runs/9/attempts/2/jobs?per_page=100'))return {total_count:1,jobs:[{id:8,name:'test',status:'completed',conclusion:'failure',steps:[{number:2,name:'Unit test',conclusion:'failure'},{number:1,name:'Setup',conclusion:'success'}]}]};
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  }};
}
test('GitHub report correlates the exact PR SHA and selected run attempt',async()=>{
  const fake=fakeGithub();const result=await inspectGitHub({repo:'owner/repo',pr:'7',run:'9'},fake.request);
  assert(result.sameCommit);assert.equal(result.checks.forSha,sha);assert.equal(result.workflowRun.attempt,2);
  assert.equal(result.workflowRun.jobs[0].failedSteps[0].name,'Unit test');
  assert(fake.calls.some(c=>c.endpoint.includes(`/commits/${sha}/check-runs`)));
  assert(!JSON.stringify(result).includes('private body'));assert(!JSON.stringify(result).includes('private log'));
});
test('stale or merge-commit CI runs are not represented as the current PR head',async()=>{
  const result=await inspectGitHub({repo:'owner/repo',pr:'7',run:'9'},fakeGithub({runSha:older}).request);
  assert.equal(result.sameCommit,false);assert(result.warnings.some(w=>w.code==='pr-run-sha-mismatch'));
});
test('missing or truncated checks cannot be treated as an all-green verdict',async()=>{
  const empty=await inspectGitHub({repo:'owner/repo',pr:'7'},fakeGithub({empty:true}).request);assert(empty.warnings.some(w=>w.code==='no-check-evidence'));
  const partial=await inspectGitHub({repo:'owner/repo',pr:'7'},fakeGithub({truncated:true}).request);assert.equal(partial.checks.complete,false);assert(partial.warnings.some(w=>w.code==='partial-check-list'));
});
test('project inventory discovers Cloudflare tooling and workflow filenames without executing configuration',async()=>{
  const base=path.resolve('work/platform-unit');await fs.mkdir(base,{recursive:true});const root=await fs.mkdtemp(path.join(base,'fixture-'));
  await writeJSON(path.join(root,'package.json'),{devDependencies:{wrangler:'^4.0.0','@cloudflare/vite-plugin':'^1.0.0'}});
  await fs.writeFile(path.join(root,'wrangler.jsonc'),'not parsed or executed');
  await fs.mkdir(path.join(root,'.github/workflows'),{recursive:true});await fs.writeFile(path.join(root,'.github/workflows/ci.yml'),'TOKEN: do-not-read-this');
  const result=await inspectProject(root);
  assert(result.packages[0].frameworks.some(p=>p.name==='wrangler'));assert(result.configs.includes('wrangler.jsonc'));assert(result.workflows.includes('.github/workflows/ci.yml'));assert(!JSON.stringify(result).includes('do-not-read-this'));
});
