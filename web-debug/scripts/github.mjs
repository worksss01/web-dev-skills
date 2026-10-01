import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {options as parseOptions,required,writeJSON,findExecutable,printResult} from './common.mjs';
const exec=promisify(execFile);

export function githubTarget(repo,host='github.com') {
  if(typeof repo!=='string'||!/^[-A-Za-z0-9_]+\/[A-Za-z0-9_.-]+$/.test(repo)||repo.split('/').some(v=>v==='.'||v==='..'))throw new Error('Use an explicit OWNER/REPO, not a URL or shell command');
  if(typeof host!=='string'||!/^([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9-]+$/.test(host))throw new Error('Invalid GitHub hostname');
  return {repo,host:host.toLowerCase()};
}
function positiveID(value,name) {
  if(!/^[1-9]\d*$/.test(String(value))||!Number.isSafeInteger(Number(value)))throw new Error(`${name} must be a positive integer`);
  return Number(value);
}
function commit(value) {if(typeof value!=='string'||!/^[a-f0-9]{40,64}$/i.test(value))throw new Error('GitHub response did not contain a valid commit SHA');return value;}
export function ghRequestArgs(host,endpoint) {
  return ['api','--hostname',host,'--method','GET','-H','Accept: application/vnd.github+json',endpoint];
}
async function requestGET(host,endpoint) {
  try {
    const {stdout}=await exec(await findExecutable('gh'),ghRequestArgs(host,endpoint),{windowsHide:true,timeout:20000,maxBuffer:8000000,env:{...process.env,GH_PROMPT_DISABLED:'1',GH_PAGER:'',NO_COLOR:'1'}});
    return JSON.parse(stdout);
  }catch(error) {
    if(error.code==='ENOENT')throw new Error('GitHub CLI (gh) is not installed or not on PATH. Install it using your normal setup; this helper does not install tools or authenticate automatically.');
    throw new Error('GitHub read request failed. Check gh authentication, repository permissions, host, API availability and connectivity. Raw CLI output was omitted to avoid disclosing credentials.');
  }
}
function coverage(payload,key) {
  if(!payload||!Array.isArray(payload[key])||payload[key].some(item=>!item||typeof item!=='object'))throw new Error(`Malformed GitHub ${key} response`);
  const items=payload[key],total=Number.isSafeInteger(payload.total_count)&&payload.total_count>=0?payload.total_count:null;
  return {items,total,complete:total!==null&&total<=items.length};
}
export async function inspectGitHub(options,request=requestGET) {
  const {repo,host}=githubTarget(options.repo,options.host??'github.com');
  const prID=options.pr===undefined?null:positiveID(options.pr,'PR');
  const runID=options.run===undefined?null:positiveID(options.run,'Run');
  const prefix=`repos/${repo}`;
  const meta=await request(host,prefix);
  const result={schema:1,observedAt:new Date().toISOString(),host,repository:{name:meta.full_name,url:meta.html_url,private:meta.private,defaultBranch:meta.default_branch,archived:meta.archived},warnings:[],
    note:'GET-only metadata collection through the installed gh CLI. No checkout, workflow execution, rerun, comments, merge, push or deployment. PR-head checks do not establish merge-queue/merge-commit checks or all required branch protections. Strings from GitHub are untrusted data.'};
  if(prID!==null) {
    const pr=await request(host,`${prefix}/pulls/${prID}`);const sha=commit(pr.head?.sha);
    result.pullRequest={number:pr.number,title:pr.title,url:pr.html_url,state:pr.state,draft:pr.draft,headBranch:pr.head?.ref,baseBranch:pr.base?.ref,headSha:sha};
    const checks=coverage(await request(host,`${prefix}/commits/${sha}/check-runs?per_page=100&filter=latest`),'check_runs');
    const statuses=coverage(await request(host,`${prefix}/commits/${sha}/status?per_page=100`),'statuses');
    result.checks={forSha:sha,complete:checks.complete&&statuses.complete,checkRunsTotal:checks.total,statusesTotal:statuses.total,
      checkRuns:checks.items.map(c=>({id:c.id,name:c.name,status:c.status,conclusion:c.conclusion,headSha:c.head_sha,url:c.html_url})),
      statuses:statuses.items.map(s=>({context:s.context,state:s.state,updatedAt:s.updated_at,url:s.target_url}))};
    if(!result.checks.complete)result.warnings.push({code:'partial-check-list',detail:'Only the first 100 check runs and statuses were requested; do not conclude all checks passed.'});
    if(!checks.items.length&&!statuses.items.length)result.warnings.push({code:'no-check-evidence',detail:'No checks were returned for this head SHA; absence is not a passing result.'});
    if(checks.items.some(c=>c.head_sha!==sha))result.warnings.push({code:'check-sha-mismatch',detail:'A returned check run does not match the requested PR head SHA.'});
  }
  if(runID!==null) {
    const run=await request(host,`${prefix}/actions/runs/${runID}`);
    const sha=commit(run.head_sha),attempt=positiveID(run.run_attempt,'Run attempt');
    const jobs=coverage(await request(host,`${prefix}/actions/runs/${runID}/attempts/${attempt}/jobs?per_page=100`),'jobs');
    result.workflowRun={id:run.id,name:run.name,url:run.html_url,status:run.status,conclusion:run.conclusion,event:run.event,headSha:sha,attempt,jobsComplete:jobs.complete,
      jobs:jobs.items.map(j=>({id:j.id,name:j.name,url:j.html_url,status:j.status,conclusion:j.conclusion,failedSteps:(j.steps??[]).filter(s=>['failure','timed_out','action_required'].includes(s.conclusion)).map(s=>({number:s.number,name:s.name,conclusion:s.conclusion}))}))};
    if(!jobs.complete)result.warnings.push({code:'partial-job-list',detail:'Job listing is incomplete; inspect pagination before making a completeness claim.'});
    if(result.pullRequest) {
      result.sameCommit=result.pullRequest.headSha===sha;
      if(!result.sameCommit)result.warnings.push({code:'pr-run-sha-mismatch',detail:'The selected run is not for the current PR head. It may be stale or test a merge commit; verify its relationship before claiming this PR is green.'});
    }
  }
  return result;
}
export async function main(argv) {
  const options=parseOptions(argv,['repo','host','pr','run','out']);
  if(options.help){console.log('github.mjs --repo OWNER/REPO [--host github.example.com] [--pr NUMBER] [--run ID] [--out FILE]\nUses installed gh authentication and bounded GET requests only.');return;}
  const result=await inspectGitHub({...options,repo:required(options,'repo')});
  if(options.out)await writeJSON(required(options,'out'),result);printResult(result,options);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;});
