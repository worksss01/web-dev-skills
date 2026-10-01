import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {options,required,readText,writeJSON,findExecutable,acquireLock,responseText} from './common.mjs';
import {exportReport} from './report.mjs';
const REPO='worksss01/web-dev-skills',hash=b=>createHash('sha256').update(b).digest('hex');
export async function github(method,endpoint,body,token,fetcher=fetch){
 if(!token||/[\r\n]/.test(token))throw new Error('GitHub authentication is required');
 const allowed=method==='GET'&&(endpoint==='/user'||new RegExp('^/repos/'+REPO+'/issues\\?state=all&creator=[A-Za-z0-9-]+&per_page=100&page=\\d+$').test(endpoint))||method==='POST'&&endpoint==='/repos/'+REPO+'/issues';
 if(!allowed)throw new Error('Unapproved reporting endpoint');
 const r=await fetcher('https://api.github.com'+endpoint,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json','User-Agent':'web-debug-report'},...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok){await r.body?.cancel();throw new Error('GitHub report request failed (HTTP '+r.status+')');}
 try{return JSON.parse(await responseText(r,2_000_000));}catch{throw new Error('Invalid GitHub report response');}
}
function issueURL(issue){if(!Number.isSafeInteger(issue.number)||issue.number<1||issue.html_url!==`https://github.com/${REPO}/issues/${issue.number}`)throw new Error('Unexpected issue receipt URL');return issue.html_url;}
export async function sendPrepared(p,{reviewedSha,token,request=github}={}){
 if(p.kind==='security')throw new Error('Security reports require the private vulnerability channel');
 if(reviewedSha!==p.sha256||hash(p.body)!==p.sha256)throw new Error('Review the exact preview and supply its SHA-256 before sending');
 const unlock=await acquireLock(path.join(path.dirname(p.receipt),'send.lock'));
 try{
  let previous;try{previous=JSON.parse(await readText(p.receipt,32000,{noFollow:true}));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(previous?.status==='sent'){issueURL({number:Number(previous.url?.split('/').pop()),html_url:previous.url});return {submitted:true,alreadySent:true,url:previous.url,contentChanged:previous.sha256!==p.sha256};}
  const me=await request('GET','/user',null,token);if(!/^[A-Za-z0-9-]+$/.test(me.login??''))throw new Error('Cannot establish reporter identity');
  const marker=`<!-- web-debug-report:${p.id} -->`;let complete=false;
  for(let page=1;page<=10;page++){
   const items=await request('GET',`/repos/${REPO}/issues?state=all&creator=${encodeURIComponent(me.login)}&per_page=100&page=${page}`,null,token);
   if(!Array.isArray(items))throw new Error('Invalid duplicate lookup');
   const match=items.find(i=>!i.pull_request&&i.user?.login===me.login&&typeof i.body==='string'&&i.body.includes(marker));
   if(match){const url=issueURL(match);await writeJSON(p.receipt,{status:'sent',id:p.id,sha256:p.sha256,url,recovered:true});return {submitted:true,alreadySent:true,url};}
   if(items.length<100){complete=true;break;}
  }
  if(!complete)throw new Error('Incomplete duplicate lookup; keep report local');
  if(previous)throw new Error('Previous delivery outcome uncertain; do not retry POST automatically');
  await writeJSON(p.receipt,{status:'pending',id:p.id,sha256:p.sha256},{overwrite:false});
  try{const issue=await request('POST',`/repos/${REPO}/issues`,{title:p.title,body:p.body+'\n'+marker+'\n',labels:['needs-triage']},token),url=issueURL(issue);await writeJSON(p.receipt,{status:'sent',id:p.id,sha256:p.sha256,url});return {submitted:true,url};}
  catch{throw new Error('Delivery outcome may be unknown. Receipt preserved; inspect the repository before another submission.');}
 }finally{await unlock();}
}
export async function prepare(directory,id,outbox){
 if(!/^wd-[a-f0-9-]{36}$/.test(id))throw new Error('Invalid report ID');
 const record=JSON.parse(await readText(path.join(path.resolve(directory),id+'.json'),512000,{noFollow:true}));
 if(record.input?.kind==='security')throw new Error('Private security reports: https://github.com/'+REPO+'/security/advisories/new');
 outbox=path.resolve(outbox);await fs.mkdir(outbox,{recursive:true,mode:0o700});
 const real=await fs.realpath(outbox);if((await fs.lstat(outbox)).isSymbolicLink()||(process.platform==='win32'?real.toLowerCase()!==outbox.toLowerCase():real!==outbox))throw new Error('Linked outbox refused');
 let owner;try{owner=JSON.parse(await readText(path.join(outbox,'owner.json'),4096,{noFollow:true}));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!owner){if((await fs.readdir(outbox)).length)throw new Error('Use an empty dedicated outbox');await writeJSON(path.join(outbox,'owner.json'),{owner:'web-debug-report-delivery'},{overwrite:false});}
 else if(owner.owner!=='web-debug-report-delivery')throw new Error('Invalid outbox owner');
 const preview=path.join(outbox,id+'.md');await exportReport(directory,id,preview,{audience:'public',overwrite:true});
 const body=await readText(preview,512000,{noFollow:true});if(Buffer.byteLength(body)>60000)throw new Error('Shorten the report before submission');
 return {id,kind:record.input.kind,title:'Web Debug: '+body.split('\n')[0].replace(/^# Web Debug report: /,'').slice(0,140),body,sha256:hash(body),preview,receipt:path.join(outbox,id+'.receipt.json')};
}
async function credential(){
 if(process.env.GH_TOKEN||process.env.GITHUB_TOKEN)return process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
 try{const {stdout}=await promisify(execFile)(await findExecutable('gh'),['auth','token','--hostname','github.com'],{windowsHide:true,timeout:10000,maxBuffer:16000});return stdout.trim();}catch{throw new Error('Sign in with gh or supply GH_TOKEN/GITHUB_TOKEN through host secret settings. Do not put credentials in reports.');}
}
export async function main(argv){
 const o=options(argv,['store','id','outbox','reviewed-sha'],[],1);
 if(o.help){console.log('report send --id ID [--store DIR] [--outbox DIR] [--reviewed-sha SHA256]\nWithout the hash: local preview only. After authorized review: send, deduplicate and save the receipt. Security reports stay private.');return;}
 const p=await prepare(o.store??'work/web-debug/reports',required(o,'id'),o.outbox??'work/web-debug/report-outbox');
 if(!o['reviewed-sha']){console.log(JSON.stringify({submitted:false,preview:p.preview,sha256:p.sha256,repository:REPO,note:'Read the preview and authorize public disclosure before passing --reviewed-sha.'},null,2));return;}
 console.log(JSON.stringify(await sendPrepared(p,{reviewedSha:o['reviewed-sha'],token:await credential()}),null,2));
}
