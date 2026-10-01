import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateCdpAction} from '../web-debug/scripts/plan.mjs';
import {options,required,writeJSON,fetchJSON} from '../web-debug/scripts/common.mjs';

const fileHint=(name,description)=>/^(?:files?|fileNames?|filePaths?|downloadPath|path|directory(?:Path)?)$/i.test(name??'')||/\b(?:file\s*paths?|filenames?|local files?|file system|filesystem|on disk|unpacked extension|directory)\b/i.test(description??'');

// These describe specific non-filesystem input fields, not whole-method exemptions.
const reviewedFields=new Map([
  ['DOM.pushNodeByPathToFrontend:path','DOM node traversal path, not an OS filesystem path.'],
  ['Page.setInterceptFileChooserDialog:(command)','Controls chooser interception/cancellation; no file-path input or direct file-read request. Does not establish browser isolation.'],
  ...['Network.deleteCookies:path','Network.setCookie:path','Network.setCookies:cookies[].path','Storage.setCookies:cookies[].path'].map(key=>[key,'Cookie URL path attribute, not an OS filesystem path; cookie changes remain privileged raw operations.'])
]);

export function scanProtocol(protocol,validate=validateCdpAction) {
  if(!protocol||!Array.isArray(protocol.domains)||!protocol.domains.length)throw new Error('Missing protocol domains');
  const types=new Map(),unresolved=new Set(),limits=new Set();let cycles=0;
  for(const domain of protocol.domains)for(const type of domain.types??[])types.set(domain.domain+'.'+type.id,type);
  function walk(node,domain,field,seen=new Set(),depth=0) {
    if(depth>20){limits.add(field);return {sample:null,hints:[]};}
    let hints=fileHint(node.name,node.description)?[{field,description:(node.description??'').slice(0,300)}]:[];
    if(node.$ref){const key=node.$ref.includes('.')?node.$ref:domain+'.'+node.$ref;if(seen.has(key)){cycles++;return {sample:null,hints};}const type=types.get(key);if(!type){unresolved.add(key);return {sample:null,hints};}const next=walk(type,key.split('.')[0],field,new Set([...seen,key]),depth+1);return {sample:next.sample,hints:[...hints,...next.hints]};}
    if(node.type==='object'||node.properties){const sample={};for(const property of node.properties??[]){const value=walk(property,domain,field?field+'.'+property.name:property.name,seen,depth+1);sample[property.name]=value.sample;hints.push(...value.hints);}return {sample,hints};}
    if(node.type==='array'){const value=walk(node.items??{},domain,field+'[]',seen,depth+1);return {sample:[value.sample],hints:[...hints,...value.hints]};}
    if(node.enum?.length)return {sample:node.enum[0],hints};
    return {sample:node.type==='boolean'?true:['number','integer'].includes(node.type)?1:node.name==='url'?'https://example.invalid/':'__schema_probe_not_executed__',hints};
  }
  const candidates=[];let commands=0;
  for(const domain of protocol.domains)for(const command of domain.commands??[]) {
    commands++;const method=domain.domain+'.'+command.name;
    const value=walk({type:'object',properties:command.parameters??[]},domain.domain,'');
    if(/File|Directory|Download|Unpacked/.test(command.name)||fileHint('',command.description))value.hints.push({field:'(command)',description:(command.description??'').slice(0,300)});
    if(!value.hints.length)continue;
    const hints=[...new Map(value.hints.map(h=>[h.field,h])).values()];let error=null;
    try{validate({type:'cdp',method,params:value.sample},{allowRawCdp:true});}catch(e){error=e.message;}
    const policyBlocked=!!error&&/not supported|drag.*files/i.test(error);
    const remaining=hints.filter(h=>!reviewedFields.has(method+':'+h.field));
    candidates.push({method,fields:hints,policyBlocked,policyError:error,needsReview:!policyBlocked&&remaining.length>0,reviewNotes:hints.map(h=>reviewedFields.get(method+':'+h.field)).filter(Boolean)});
  }
  return {schemaVersion:protocol.version,domains:protocol.domains.length,commands,candidates,needsReview:candidates.filter(c=>c.needsReview).map(c=>c.method),coverage:{unresolvedRefs:[...unresolved],depthLimited:[...limits],cyclesSkipped:cycles},note:'Heuristic review of command input names/descriptions and transitive type references. Probe params are validated locally and NEVER sent to Chrome. No findings is not proof of filesystem isolation; unlabelled semantics and future methods can escape this heuristic.'};
}

export async function main(argv) {
  const o=options(argv,['work','chrome']),work=path.resolve(required(o,'work')),state=path.join(work,'state');await fs.mkdir(work,{recursive:true});
  const cli=fileURLToPath(new URL('../web-debug/scripts/chrome.mjs',import.meta.url)),exec=promisify(execFile);let launched=false;
  async function command(args){return JSON.parse((await exec(process.execPath,[cli,...args],{windowsHide:true,timeout:30000,maxBuffer:4000000})).stdout);}
  try {
    const browser=await command(['launch','--state-dir',state,'--headless','--allow-tcp-debugging',...(o.chrome?['--chrome',o.chrome]:[])]);launched=true;
    const protocol=await fetchJSON(browser.endpoint+'/json/protocol');
    await writeJSON(path.join(work,'protocol-schema.json'),protocol);
    const report={testedAt:new Date().toISOString(),browser:browser.browser,protocolSha256:createHash('sha256').update(JSON.stringify(protocol)).digest('hex'),...scanProtocol(protocol)};
    const stopped=await command(['stop','--state-dir',state,'--purge-profile']);launched=false;report.profilePurged=stopped.profilePurged;
    await writeJSON(path.join(work,'protocol-review.json'),report);
    console.log(JSON.stringify({commands:report.commands,candidates:report.candidates.map(c=>({method:c.method,fields:c.fields.map(f=>f.field),policyBlocked:c.policyBlocked})),needsReview:report.needsReview,coverage:report.coverage,profilePurged:report.profilePurged},null,2));
    if(report.needsReview.length||report.coverage.unresolvedRefs.length||report.coverage.depthLimited.length||!report.profilePurged)process.exitCode=1;
  }finally{if(launched)await command(['stop','--state-dir',state,'--purge-profile']);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
