import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';
import {fileURLToPath} from 'node:url';import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {cases,manualCases} from '../evals/catalog.mjs';
import {options,required,writeJSON,readText} from '../web-debug/scripts/common.mjs';
import {redactText} from '../web-debug/scripts/report.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
async function workspace(output){const dir=path.resolve(output);if(!dir.startsWith(path.join(root,'work')+path.sep))throw new Error('Evaluation outputs must stay under project work/');await fs.mkdir(dir,{recursive:true});return dir;}
export async function grade(id,html,output){
 const c=cases[id];if(!c)throw new Error('Unknown case');const dir=await workspace(output),run=path.join(dir,randomUUID());await fs.mkdir(run);
 const server=http.createServer((req,res)=>{if(req.url!=='/'){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const plan=path.join(run,'plan.json'),capture=path.join(run,'capture.json');await writeJSON(plan,{name:id,actions:c.actions});
 let error=null;
 try{await promisify(execFile)(process.execPath,[path.join(root,'web-debug/scripts/debug.mjs'),'chrome','check','--url',`http://127.0.0.1:${server.address().port}/`,'--plan',plan,'--allow-script','--out',capture,'--state-dir',path.join(run,'chrome')],{cwd:root,windowsHide:true,timeout:60000,maxBuffer:1_000_000,env:{...process.env,WEB_DEBUG_UPDATE_CHECKED:'1'}});}catch(e){error=redactText(String(e.stderr||e.code||'Browser check failed')).slice(0,2000);await writeJSON(path.join(run,'runner-error.json'),{error,signal:e.signal??null});}
 finally{await new Promise(resolve=>server.close(resolve));}
 let report;try{report=JSON.parse(await fs.readFile(capture,'utf8'));}catch{throw new Error('Missing browser evidence; evaluation is not a pass. '+(error??''));}
 const assertions=report.steps?.filter(s=>s.type==='assert')??[];
 const passed=!error&&report.ok===true&&assertions.length===c.actions.filter(a=>a.type==='assert').length&&assertions.every(s=>s.ok===true);
 const result={schema:1,case:id,htmlSha256:hash(html),passed,assertions:assertions.map(s=>({ok:s.ok,error:s.error??null})),capture,scope:'Observed browser behavior for this fixture only; not a general model intelligence score.'};await writeJSON(path.join(run,'grade.json'),result);return result;
}
async function main(){
 const argv=process.argv.slice(2),command=argv[0],o=options(argv,['case','out','file','reviewed-sha'],[],1);
 if(o.help||!command){console.log('evaluate.mjs list\nevaluate.mjs prepare --case ID --out work/evals/candidate\nevaluate.mjs grade --case ID --file REVIEWED_INDEX.html --reviewed-sha SHA256 --out work/evals/results\nevaluate.mjs self-test --out work/evals/self-test\nReview candidate HTML before local execution; anonymous/untrusted reproductions belong in an isolated environment.');return;}
 if(command==='list'){console.log(JSON.stringify({browserCases:Object.entries(cases).map(([id,c])=>({id,task:c.task})),manualCases},null,2));return;}
 const dir=await workspace(required(o,'out'));
 if(command==='prepare'){const c=cases[required(o,'case')];if(!c)throw new Error('Unknown case');await fs.writeFile(path.join(dir,'index.html'),c.html(false),{flag:'wx'});await fs.writeFile(path.join(dir,'TASK.md'),c.task+'\nReport the cause, patch and actual verification. Do not read the reference solution or grader.\n',{flag:'wx'});console.log(JSON.stringify({prepared:true,case:o.case}));}
 else if(command==='grade'){const html=await readText(required(o,'file'),1_000_000,{noFollow:true});if(hash(html)!==o['reviewed-sha'])throw new Error('Review the exact HTML before running it on this host');const r=await grade(required(o,'case'),html,dir);console.log(JSON.stringify(r));if(!r.passed)process.exitCode=1;}
 else if(command==='self-test'){const results=[];for(const [id,c] of Object.entries(cases)){const buggy=await grade(id,c.html(false),dir),fixed=await grade(id,c.html(true),dir);if(buggy.passed||!fixed.passed)throw new Error('Grader failed its baseline/reference control: '+id);results.push({case:id,bugDetected:!buggy.passed,referencePassed:fixed.passed});}await writeJSON(path.join(dir,'summary.json'),{results,independentAgentTested:false,manualCasesGraded:false});console.log(JSON.stringify(results));}
 else throw new Error('Unknown evaluation command');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
