import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,verify,randomUUID} from 'node:crypto';
import {options,required,readJSON,readText,writeJSON,acquireLock,responseText} from './common.mjs';

export const REPOSITORY='worksss01/web-dev-skills';
export const MARKER='.web-debug-update.json';
const SELF=fileURLToPath(new URL('..',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const VERSION=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
function keysOnly(o,keys){if(!o||Array.isArray(o)||Object.keys(o).some(k=>!keys.includes(k)))throw new Error('Unexpected update fields');}
export function safeFile(name){
 if(typeof name!=='string'||name.length>180||!(/^(?:SKILL\.md|LICENSE|scripts\/[a-z0-9-]+\.(?:mjs|ps1)|references\/[a-z0-9-]+\.(?:md|json)|agents\/openai\.yaml)$/.test(name)))throw new Error('Unsafe update path');
 if(name.split('/').some(p=>/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))throw new Error('Device paths are not allowed');
 return name;
}
function base64(value,max){if(typeof value!=='string'||value.length>max*1.4||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw new Error('Invalid base64 update data');const b=Buffer.from(value,'base64');if(b.length>max||b.toString('base64')!==value)throw new Error('Oversized or noncanonical update data');return b;}
export function verifyEnvelope(envelope,trust){
 keysOnly(envelope,['schema','keyId','payload','signature']);
 if(envelope.schema!==1)throw new Error('Unsupported envelope');
 const key=trust.keys.find(k=>k.id===envelope.keyId&&!k.revoked);if(!key)throw new Error('Unknown/revoked publisher key');
 const bytes=base64(envelope.payload,8_000_000),signature=base64(envelope.signature,128);
 if(signature.length!==64||!verify(null,bytes,key.pem,signature))throw new Error('Publisher signature verification failed');
 const p=JSON.parse(bytes.toString('utf8'));keysOnly(p,['schema','version','compatibilityEpoch','channel','files']);
 if(p.schema!==1||!VERSION.test(p.version)||p.compatibilityEpoch!==1||p.channel!=='stable')throw new Error('Unsupported release compatibility/channel');
 if(!p.files||Array.isArray(p.files)||Object.keys(p.files).length>150||!p.files['SKILL.md']||!p.files['scripts/update.mjs']||!p.files['LICENSE'])throw new Error('Incomplete update payload');
 let total=0;const names=new Set(),files={};
 for(const [name,data] of Object.entries(p.files)){safeFile(name);if(names.has(name.toLowerCase()))throw new Error('Aliased update paths');names.add(name.toLowerCase());files[name]=base64(data,2_000_000);total+=files[name].length;}
 if(total>8_000_000)throw new Error('Expanded update too large');
 if(!files['scripts/common.mjs']?.toString().includes(`export const VERSION='${p.version}'`))throw new Error('Payload version disagrees with helper');
 return {...p,files,payloadSha256:hash(bytes),keyId:key.id};
}
export async function inventory(root){
 const result={};
 async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isSymbolicLink())throw new Error('Linked installation refused');if(e.isDirectory())await walk(p);else if(e.isFile()){const name=path.relative(root,p).split(path.sep).join('/');if(name===MARKER)continue;safeFile(name);result[name]=hash(await fs.readFile(p));}else throw new Error('Unexpected installation entry');}}
 await assertDirectory(root);await walk(root);return result;
}
async function assertDirectory(dir){
 let p=path.resolve(dir);
 for(;;){const s=await fs.lstat(p);if(s.isSymbolicLink()||!s.isDirectory())throw new Error('Directory links are not supported');const parent=path.dirname(p);if(parent===p)break;p=parent;}
 return fs.realpath(dir);
}
const same=(a,b)=>JSON.stringify(Object.entries(a).sort())===JSON.stringify(Object.entries(b).sort());
const hashes=p=>Object.fromEntries(Object.entries(p.files).map(([n,b])=>[n,hash(b)]));
async function trust(){return readJSON(new URL('../references/release-keys.json',import.meta.url),16000);}
async function localJSON(file,max){try{return JSON.parse(await readText(file,max,{noFollow:true}));}catch(e){if(e.code==='ENOENT')throw e;throw new Error('Invalid or linked updater metadata');}}
async function bundle(file){return verifyEnvelope(await readJSON(file,12_000_000),await trust());}
async function marker(root){
 const m=await localJSON(path.join(root,MARKER),100000);
 if(m.schema!==1||m.owner!=='web-debug-updates'||!VERSION.test(m.version)||m.root!==await fs.realpath(root)||m.compatibilityEpoch!==1||!m.baseline||typeof m.auto!=='boolean'||typeof m.allowMinor!=='boolean')throw new Error('Invalid update enrollment');
 const dir=await assertDirectory(m.stateDir),state=await localJSON(path.join(dir,'owner.json'),4096);
 if(state.owner!=='web-debug-updates'||state.root!==m.root)throw new Error('State directory belongs to a different installation');
 return m;
}
export async function enroll(root,payload,stateDir,{auto=false,allowMinor=false}={}){
 root=await assertDirectory(root);stateDir=path.resolve(stateDir);
 if(root===stateDir||stateDir.startsWith(root+path.sep)||root.startsWith(stateDir+path.sep))throw new Error('Keep updater state separate from the installation');
 if(!same(await inventory(root),hashes(payload)))throw new Error('Installation differs from signed release; preserve local edits');
 try{await fs.lstat(path.join(root,MARKER));throw new Error('Already enrolled; use status/disable or deliberate migration');}catch(e){if(e.code!=='ENOENT')throw e;}
 await fs.mkdir(stateDir,{recursive:true,mode:0o700});await assertDirectory(stateDir);
 if((await fs.readdir(stateDir)).length)throw new Error('Use an empty dedicated updater state directory');
 await writeJSON(path.join(stateDir,'owner.json'),{owner:'web-debug-updates',root});
 const m={schema:1,owner:'web-debug-updates',root,stateDir:await fs.realpath(stateDir),version:payload.version,compatibilityEpoch:1,baseline:hashes(payload),auto,allowMinor,lastCheckedAt:null,lastBackup:null};
 await writeJSON(path.join(root,MARKER),m,{overwrite:false});return {enrolled:true,version:m.version,auto,allowMinor};
}
export function canUpgrade(from,to,minor=false){
 if(!VERSION.test(from)||!VERSION.test(to))return false;
 const a=from.split('.').map(Number),b=to.split('.').map(Number);
 return a[0]===b[0]&&(minor||a[1]===b[1])&&(b[1]>a[1]||b[1]===a[1]&&b[2]>a[2]);
}
async function promote(root,stage,expected){
 const parent=path.dirname(root),old=path.join(parent,'.web-debug-old-'+randomUUID());
 if(path.dirname(path.resolve(old))!==parent)throw new Error('Invalid replacement path');
 if(!same(await inventory(root),expected))throw new Error('Local edits appeared; update cancelled');
 await fs.rename(root,old);
 try{await fs.rename(stage,root);}catch(e){await fs.rename(old,root);throw e;}
 // Delete only this exact temporary old installation, after inventory recheck.
 if(path.dirname(await fs.realpath(old))!==parent||!path.basename(old).startsWith('.web-debug-old-')||!same(await inventory(old),expected))throw new Error('Old installation preserved for review');
 await fs.rm(old,{recursive:true});
}
export async function applyUpdate(root,payload){
 root=await assertDirectory(root);let m=await marker(root);const unlock=await acquireLock(path.join(m.stateDir,'operation.lock'));
 try{
  m=await marker(root);
  if(payload.version===m.version)return {updated:false,reason:'already-current',version:m.version};
  if(!canUpgrade(m.version,payload.version,m.allowMinor))throw new Error('Downgrade, major or unenrolled minor update refused');
  if(!same(await inventory(root),m.baseline))throw new Error('Local edits preserved; automatic update blocked');
  const id=randomUUID(),backup=path.join(m.stateDir,'backup-'+id),stage=path.join(path.dirname(root),'.web-debug-stage-'+id);
  await fs.cp(root,backup,{recursive:true,errorOnExist:true,force:false});
  if(!same(await inventory(backup),m.baseline))throw new Error('Backup verification failed');
  await fs.mkdir(stage,{mode:0o700});
  for(const [name,data] of Object.entries(payload.files)){const p=path.join(stage,...name.split('/'));await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,data,{flag:'wx',mode:0o600});}
  const next={...m,version:payload.version,baseline:hashes(payload),lastBackup:'backup-'+id,lastCheckedAt:new Date().toISOString()};
  await writeJSON(path.join(stage,MARKER),next,{overwrite:false});
  if(!same(await inventory(stage),next.baseline))throw new Error('Staging verification failed');
  await promote(root,stage,m.baseline);return {updated:true,from:m.version,to:next.version,backup:next.lastBackup};
 }finally{await unlock();}
}
export async function rollback(root){
 root=await assertDirectory(root);const m=await marker(root),unlock=await acquireLock(path.join(m.stateDir,'operation.lock'));
 try{
  if(!/^backup-[a-f0-9-]{36}$/.test(m.lastBackup??''))throw new Error('No rollback backup');
  if(!same(await inventory(root),m.baseline))throw new Error('Local edits preserved; rollback blocked');
  const backup=path.join(m.stateDir,m.lastBackup),previous=await localJSON(path.join(backup,MARKER),100000);
  if(previous.root!==root||previous.stateDir!==m.stateDir||!same(await inventory(backup),previous.baseline))throw new Error('Backup changed; rollback blocked');
  const stage=path.join(path.dirname(root),'.web-debug-stage-'+randomUUID());await fs.cp(backup,stage,{recursive:true,errorOnExist:true,force:false});
  previous.auto=false;await writeJSON(path.join(stage,MARKER),previous); // Prevent an immediate re-upgrade loop.
  await promote(root,stage,m.baseline);return {rolledBack:true,version:previous.version,auto:false};
 }finally{await unlock();}
}
export async function publicJSON(url,fetcher=fetch){
 const signal=AbortSignal.timeout(25000);
 for(let i=0;i<6;i++){
  const u=new URL(url),allowed=u.hostname==='api.github.com'||u.hostname==='github.com'||u.hostname==='release-assets.githubusercontent.com';
  if(!allowed||u.protocol!=='https:'||u.username||u.password||u.port)throw new Error('Untrusted release destination');
  const r=await fetcher(u.href,{signal,redirect:'manual',headers:{Accept:'application/json','User-Agent':'web-debug-updater'}});
  if([301,302,303,307,308].includes(r.status)){const location=r.headers.get('location');await r.body?.cancel();if(!location)throw new Error('Missing release redirect');url=new URL(location,u).href;continue;}
  if(!r.ok){await r.body?.cancel();throw new Error('Release download HTTP '+r.status);}
  return JSON.parse(await responseText(r,12_000_000));
 }
 throw new Error('Too many release redirects');
}
export async function latest(){
 const release=await publicJSON(`https://api.github.com/repos/${REPOSITORY}/releases/latest`),version=release.tag_name?.replace(/^v/,'');
 if(!VERSION.test(version)||release.draft||release.prerelease)throw new Error('Not a stable release');
 const name=`web-debug-update-${version}.json`,expected=`https://github.com/${REPOSITORY}/releases/download/v${version}/${name}`;
 if(!release.assets?.some(a=>a.name===name&&a.browser_download_url===expected&&a.size<=12_000_000))throw new Error('Signed update asset unavailable');
 const p=verifyEnvelope(await publicJSON(expected),await trust());if(p.version!==version)throw new Error('Release tag/signature version mismatch');return p;
}
export async function autoUpdate(root=SELF){
 let m;try{m=await marker(root);}catch(e){if(e.code==='ENOENT')return {updated:false,reason:'not-enrolled'};throw e;}
 if(!m.auto)return {updated:false,reason:'auto-disabled'};
 const age=Date.now()-Date.parse(m.lastCheckedAt);if(Number.isFinite(age)&&age>=0&&age<86400000)return {updated:false,reason:'not-due'};
 // Failed checks keep the current installation and back off until the next day.
 const unlock=await acquireLock(path.join(m.stateDir,'operation.lock'));
 try{m=await marker(root);m.lastCheckedAt=new Date().toISOString();await writeJSON(path.join(root,MARKER),m);}finally{await unlock();}
 const p=await latest();return applyUpdate(root,p);
}
export async function main(argv){
 const command=argv[0]??'help',o=options(argv,['install','bundle','state'],['auto','allow-minor'],1),root=path.resolve(o.install??SELF);
 if(o.help||command==='help'){console.log('update status|check|auto|apply|rollback|disable [--install DIR]\nupdate enroll --bundle SIGNED.json --state DEDICATED_DIR [--auto] [--allow-minor]\nupdate apply --bundle SIGNED.json\nNo enrollment means no background checks. Auto runs at CLI startup, at most daily; it is not a resident service.');return;}
 let result;
 if(command==='enroll')result=await enroll(root,await bundle(required(o,'bundle')),required(o,'state'),{auto:o.auto===true,allowMinor:o['allow-minor']===true});
 else if(command==='apply')result=await applyUpdate(root,o.bundle?await bundle(o.bundle):await latest());
 else if(command==='rollback')result=await rollback(root);
 else if(command==='auto')result=await autoUpdate(root);
 else if(command==='check'){const p=await latest();result={available:p.version,signatureVerified:true};}
 else if(command==='status'){try{const m=await marker(root);result={enrolled:true,version:m.version,auto:m.auto,localEdits:!same(await inventory(root),m.baseline)};}catch(e){if(e.code!=='ENOENT')throw e;result={enrolled:false};}}
 else if(command==='disable'){const m=await marker(root);m.auto=false;await writeJSON(path.join(root,MARKER),m);result={auto:false};}
 else throw new Error('Unknown update command');
 console.log(JSON.stringify(result,null,2));
}
