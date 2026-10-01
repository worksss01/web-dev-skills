import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';

async function inventory(directory) {
  const files=[];
  async function walk(current){for(const entry of await fs.readdir(current,{withFileTypes:true})){const file=path.join(current,entry.name);if(entry.isSymbolicLink())throw new Error('Skill installation does not copy symlinks inside the source/target');if(entry.isDirectory())await walk(file);else if(entry.isFile()){const relative=path.relative(directory,file).split(path.sep).join('/');files.push([relative,(await packageFile(directory,relative,64000000)).sha256]);}else throw new Error('Unsupported skill file type');}}
  await walk(directory);return JSON.stringify(files.sort((a,b)=>a[0].localeCompare(b[0])));
}

async function packageFile(root,relative,maxBytes,capture=false) {
  let file=root,info;
  for(const component of relative.split('/')) {
    file=path.join(file,component);info=await fs.lstat(file,{bigint:true});
    if(info.isSymbolicLink())throw new Error(`Package links are not supported: ${relative}`);
  }
  if(!info.isFile()||info.size>maxBytes)throw new Error(`Invalid or oversized package file: ${relative}`);
  const handle=await fs.open(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
  try {
    const opened=await handle.stat({bigint:true});
    if(!opened.isFile()||opened.dev!==info.dev||opened.ino!==info.ino||opened.size>maxBytes)throw new Error(`Package file changed during verification: ${relative}`);
    const digest=createHash('sha256'),chunks=[];let bytes=0;
    for await(const chunk of handle.createReadStream({autoClose:false})) {bytes+=chunk.length;if(bytes>maxBytes)throw new Error(`Package file exceeds size limit: ${relative}`);digest.update(chunk);if(capture)chunks.push(chunk);}
    return {sha256:digest.digest('hex'),bytes,...(capture?{text:Buffer.concat(chunks).toString('utf8')}: {})};
  }finally{await handle.close();}
}

export async function verifyPackage(directory) {
  const root=await fs.realpath(path.resolve(directory));
  const manifest=await packageFile(root,'MANIFEST.sha256',1000000,true);
  const lines=manifest.text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
  if(!lines.length||lines.length>4096)throw new Error('Manifest must contain 1..4096 entries');
  const entries=new Map(),identities=new Set();
  for(const line of lines) {
    const match=/^([a-fA-F0-9]{64})  (.+)$/.exec(line);if(!match)throw new Error('Malformed SHA-256 manifest entry');
    const [,digest,relative]=match,components=relative.split('/'),identity=relative.toLowerCase();
    if(path.posix.isAbsolute(relative)||path.win32.isAbsolute(relative)||/[\\\x00-\x1f<>:"|?*]/.test(relative)||components.some(p=>!p||p==='.'||p==='..'||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))||identity==='manifest.sha256')throw new Error('Manifest paths must be portable relative files; no traversal, devices or self-entry');
    if(identities.has(identity))throw new Error('Duplicate or case-aliased manifest entry');
    identities.add(identity);entries.set(relative,digest.toLowerCase());
  }
  if(!entries.has('install.mjs')||!entries.has('web-debug/SKILL.md'))throw new Error('Manifest must cover the installer and skill entry point');
  let bytes=0;
  for(const [relative,expected] of entries) {
    const actual=await packageFile(root,relative,64000000);bytes+=actual.bytes;
    if(bytes>256000000)throw new Error('Package exceeds the verification size budget');
    if(actual.sha256!==expected)throw new Error(`Manifest hash mismatch: ${relative}`);
  }
  const skillInventory=JSON.stringify([...entries].filter(([name])=>name.startsWith('web-debug/')).map(([name,digest])=>[name.slice('web-debug/'.length),digest]).sort((a,b)=>a[0].localeCompare(b[0])));
  if(await inventory(path.join(root,'web-debug'))!==skillInventory)throw new Error('Skill contains unlisted, missing or changed files');
  return {filesVerified:entries.size,bytesVerified:bytes,skillInventory,publisherAuthenticated:false};
}

async function main() {
  const source=path.dirname(fileURLToPath(import.meta.url));
  // Validate the extracted kit before loading its skill helpers or creating destinations.
  // This is integrity checking, not authentication of this verifier or the publisher.
  const verified=await verifyPackage(source);
  const {options:parseOptions,required,exists,findExecutable,containedPath}=await import('./web-debug/scripts/common.mjs');
  const options=parseOptions(process.argv.slice(2),['project','target']);
  if(options.help || !options.project) {
    console.log('node install.mjs --project PATH [--target both|codex|claude]\nVerifies the full-kit manifest, then copies web-debug into project-local skill folders. Existing installations are preserved. Manifest integrity does not authenticate the publisher; compare the ZIP hash from a trusted separate channel before running code.');return;
  }
  const project=await fs.realpath(path.resolve(required(options,'project')));
  // A repository root can contain subprojects; do not create files outside the requested root.
  let root;
  try {root=execFileSync(await findExecutable('git'),['-C',project,'rev-parse','--show-toplevel'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
  catch {throw new Error('The target must be inside an existing Git repository');}
  const target=options.target || 'both';
  if(!['both','codex','claude'].includes(target)) throw new Error('target must be both, codex or claude');
  const relative=target==='both'?['.agents/skills/web-debug','.claude/skills/web-debug']:[target==='codex'?'.agents/skills/web-debug':'.claude/skills/web-debug'];
  const destinations=relative.map(p=>path.join(project,p));
  const sourceInventory=verified.skillInventory,current=[];
  // Preflight all destinations before copying. Refuse symlinked parent paths escaping the project.
  for(const destination of destinations) {
    await containedPath(project,path.relative(project,destination));
    if(await exists(destination)) {if(await inventory(destination)===sourceInventory){current.push(destination);continue;}throw new Error(`Existing skill preserved: ${destination}. Compare and update it explicitly.`);}
    let parent=path.dirname(destination);
    while(!await exists(parent)) parent=path.dirname(parent);
    const real=await fs.realpath(parent);
    const rel=path.relative(project,real);
    if(rel==='..'||rel.startsWith(`..${path.sep}`)||path.isAbsolute(rel)) throw new Error('Installation parent resolves outside the requested project');
  }
  for(const destination of destinations) {
    if(current.includes(destination))continue;
    await fs.mkdir(path.dirname(destination),{recursive:true});
    const staging=path.join(path.dirname(destination),`.web-debug-stage-${randomUUID()}`);
    await fs.mkdir(staging);
    try {const copy=path.join(staging,'content');await fs.cp(path.join(source,'web-debug'),copy,{recursive:true,errorOnExist:true,force:false});if(await inventory(copy)!==sourceInventory)throw new Error('Source changed during installation; retry from a stable source');if(await exists(destination))throw new Error('Installation destination appeared during copy; existing files preserved');await fs.rename(copy,destination);}
    finally {if(await exists(staging)){await containedPath(project,path.relative(project,staging));await fs.rm(staging,{recursive:true});}}
  }
  console.log(JSON.stringify({installed:destinations,alreadyCurrent:current,repository:root,integrity:{manifest:'MANIFEST.sha256',filesVerified:verified.filesVerified,publisherAuthenticated:false},note:'Identical installs are reusable; differing files are preserved. If one target failed, retry safely after resolving it. Update both copies from the same reviewed source.'},null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
