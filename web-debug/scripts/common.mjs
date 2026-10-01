import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const VERSION='1.6.2';

export function args(argv) {
  const result = Object.assign(Object.create(null),{_:[]});
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (!value.startsWith('--')) { result._.push(value); continue; }
    const name = value.slice(2);
    if (!name || name.includes('=')) throw new Error('Use --name value, not --name=value');
    if (Object.hasOwn(result, name)) throw new Error(`Duplicate option --${name}`);
    result[name] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return result;
}
export function options(argv,values=[],flags=[],positionals=0) {
  const result=args(argv),allowedFlags=new Set(['help','compact','full',...flags]),allowedValues=new Set(values);
  if(result._.length>positionals)throw new Error('Unexpected positional argument');
  for(const [key,value] of Object.entries(result)) {
    if(key==='_')continue;
    if(allowedFlags.has(key)){if(value!==true)throw new Error(`--${key} is a flag; do not supply a value`);}
    else if(allowedValues.has(key))required(result,key);
    else throw new Error(`Unknown option --${key}`);
  }
  if(result.compact&&result.full)throw new Error('Use --compact or --full, not both');
  return result;
}
export function required(options, key) {
  if (typeof options[key] !== 'string' || !options[key]) throw new Error(`Missing --${key} value`);
  return options[key];
}
export function number(value, fallback, min, max) {
  if(value!==undefined&&(typeof value!=='number'&&typeof value!=='string'||typeof value==='string'&&!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)))throw new Error('Expected a numeric value');
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Expected number between ${min} and ${max}`);
  return n;
}
export async function readText(file,maxBytes=8000000,{noFollow=false}={}) {
  const before=noFollow?await fs.lstat(file,{bigint:true}):null;
  if(before&&(before.isSymbolicLink()||!before.isFile()))throw new Error('Input must be a regular file without a final symlink');
  const handle=await fs.open(file,noFollow?constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0):'r');
  try {
    const stat=await handle.stat({bigint:true});
    if(before&&(before.dev!==stat.dev||before.ino!==stat.ino))throw new Error('Input changed during verification');
    if(!stat.isFile()||stat.size>maxBytes)throw new Error(`Input must be a regular file no larger than ${maxBytes} bytes`);
    const chunks=[];let size=0;
    for await(const chunk of handle.createReadStream({autoClose:false})) {size+=chunk.length;if(size>maxBytes)throw new Error(`Input exceeds ${maxBytes} bytes`);chunks.push(chunk);}
    const buffer=Buffer.concat(chunks);
    if(buffer[0]===0xff&&buffer[1]===0xfe){if((buffer.length-2)%2)throw new Error('Malformed UTF-16 file');return buffer.subarray(2).toString('utf16le');}
    if(buffer[0]===0xfe&&buffer[1]===0xff){const body=buffer.subarray(2);if(body.length%2)throw new Error('Malformed UTF-16 file');return Buffer.from(body).swap16().toString('utf16le');}
    return buffer.toString('utf8');
  }finally{await handle.close();}
}
export async function readJSON(file,maxBytes=8000000) { return JSON.parse((await readText(file,maxBytes)).replace(/^\uFEFF/,'')); }
export async function appendPrivate(file,text) {
  let before=null;try{before=await fs.lstat(file,{bigint:true});if(!before.isFile()||before.isSymbolicLink()||before.nlink>1n)throw new Error('Append target must be a regular unlinked file');}catch(error){if(error.code!=='ENOENT')throw error;}
  const flags=constants.O_WRONLY|constants.O_APPEND|constants.O_CREAT|(constants.O_NOFOLLOW??0);
  const handle=await fs.open(file,flags,0o600);
  try {const actual=await handle.stat({bigint:true});if(!actual.isFile()||actual.nlink>1n||before&&(actual.dev!==before.dev||actual.ino!==before.ino))throw new Error('Append target changed during verification');await handle.writeFile(text);}
  finally{await handle.close();}
}
export async function atomicOutput(file,writer,{overwrite=true}={}) {
  const destination=path.resolve(file),parent=path.dirname(destination);
  await fs.mkdir(parent,{recursive:true,mode:0o700});
  try {const info=await fs.lstat(destination);if(!info.isFile()||info.isSymbolicLink()||info.nlink>1)throw new Error('Output must not replace a symlink, hardlink or non-file');if(!overwrite)throw new Error('Output already exists; use --overwrite deliberately');}catch(error){if(error.code!=='ENOENT')throw error;}
  const temporary=path.join(parent,`.${path.basename(destination)}.${randomUUID()}.tmp`);
  try {await writer(temporary);await fs.chmod(temporary,0o600);if(overwrite)await fs.rename(temporary,destination);else {try{await fs.link(temporary,destination);}catch(error){if(!['ENOTSUP','EPERM','EXDEV'].includes(error.code))throw error;await fs.copyFile(temporary,destination,constants.COPYFILE_EXCL);}}}
  finally{await fs.unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
}
export async function writeFile(file,value,policy){return atomicOutput(file,temporary=>fs.writeFile(temporary,value,{flag:'wx',mode:0o600}),policy);}
export async function writeJSON(file, value, policy) { await writeFile(file, JSON.stringify(value, null, 2) + '\n', policy); }
export async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }
export async function assertDistinctPaths(inputs,outputs) {
  const identity=async file=>{const absolute=path.resolve(file instanceof URL?fileURLToPath(file):file);let real=absolute,info=null;try{real=await fs.realpath(absolute);info=await fs.stat(absolute);}catch(error){if(error.code!=='ENOENT')throw error;}return {real:process.platform==='win32'?real.toLowerCase():real,info};};
  const before=await Promise.all(inputs.filter(Boolean).map(identity)),after=await Promise.all(outputs.filter(Boolean).map(identity));
  const same=(a,b)=>a.real===b.real||a.info&&b.info&&a.info.dev===b.info.dev&&a.info.ino!==0&&a.info.ino===b.info.ino;
  if(after.some((a,i)=>before.some(b=>same(a,b))||after.slice(0,i).some(b=>same(a,b))))throw new Error('Output paths must be distinct from input files and each other');
}
export async function containedPath(root,relative) {
  if(typeof relative!=='string'||path.isAbsolute(relative)||path.win32.isAbsolute(relative)||relative.split(/[\\/]/).some(p=>p==='..'))throw new Error('Path must remain inside its data directory');
  const realRoot=await fs.realpath(root);let current=realRoot;
  for(const part of relative.split(/[\\/]/).filter(Boolean)) {
    current=path.join(current,part);
    try {const real=await fs.realpath(current),rel=path.relative(realRoot,real);if(rel==='..'||rel.startsWith(`..${path.sep}`)||path.isAbsolute(rel))throw new Error('Path resolves outside its data directory');}
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
  return current;
}
export async function acquireLock(file) {
  let handle;try{handle=await fs.open(file,'wx',0o600);}catch(error){if(error.code==='EEXIST'){let owner='unknown';try{const lock=await readJSON(file,4096);if(Number.isSafeInteger(lock.pid)&&lock.pid>0){try{process.kill(lock.pid,0);owner=`PID ${lock.pid} exists`;}catch(e){owner=e.code==='ESRCH'?`stale: PID ${lock.pid} is absent`:'PID status unavailable';}}}catch{}throw new Error(`Operation already locked: ${path.basename(file)} (${owner}). Inspect the owner before removing this lock.`);}throw error;}
  await handle.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
  return async()=>{await handle.close();await fs.unlink(file);};
}
export async function findExecutable(name) {
  if(!/^[A-Za-z0-9_.-]+$/.test(name))throw new Error('Invalid executable name');
  const names=process.platform==='win32'&&!path.extname(name)?[name+'.exe',name+'.com']:[name];
  for(let directory of (process.env.PATH??'').split(path.delimiter)) {
    directory=directory.replace(/^"|"$/g,'');if(!path.isAbsolute(directory))continue;
    for(const base of names){const candidate=path.join(directory,base);try{if((await fs.stat(candidate)).isFile()){await fs.access(candidate,process.platform==='win32'?0:1);return await fs.realpath(candidate);}}catch{}}
  }
  const error=new Error(`${name} is not installed on the absolute PATH`);error.code='ENOENT';throw error;
}
export function printResult(value,opts={}) {
  if(!opts.compact||!opts.out){console.log(JSON.stringify(value,null,2));return;}
  const brief=items=>items.slice(0,12).map(({code,priority,count,target,error,detail})=>({code,priority,count,target,error,detail}));
  const summary={output:path.resolve(opts.out),...(typeof value?.ok==='boolean'?{ok:value.ok}:{}),...(value?.summary?{summary:{...value.summary,findings:brief(value.summary.findings),findingGroups:value.summary.findings.length}}:{}),...(value?.counts?{counts:value.counts}:{}),...(value?.findings?{findings:brief(value.findings),findingGroups:value.findings.length}:{}),...(value?.warnings?{warnings:value.warnings.slice(0,12)}:{}),...(value?.comparison?{comparison:{comparable:value.comparison.comparable,reason:value.comparison.reason,absentAfter:value.comparison.absentAfter?.length,newAfter:value.comparison.newAfter?.length,remaining:value.comparison.remaining?.length}}:{}),...(Array.isArray(value)?{items:value.length,preview:value.slice(0,5)}:{}),...(value?.packages?{packages:value.packages.length}:{}),...(value?.report?{items:value.report.length}:{}),...(value?.steps?.some(s=>!s.ok)?{firstFailure:value.steps.find(s=>!s.ok)}:{}),note:'Detailed evidence is retained in the output. Use --full for full stdout.'};
  if(value?.metrics)summary.metrics=value.metrics;
  if(value?.report)summary.review={required:value.report.filter(r=>r.reviewRequired).length,errors:value.report.filter(r=>r.error).slice(0,12).map(({id,error})=>({id,error}))};
  if(Array.isArray(value))summary.needingReview=value.filter(r=>r.reviewRequired||r.reviewOverdue).length;
  if(value?.id)summary.id=value.id;if(value?.migrated!==undefined)summary.migrated=value.migrated;if(value?.verified!==undefined)summary.verified=value.verified;
  if(value?.hops)summary.responses=value.hops.map(h=>({url:h.url,status:h.status,tlsAuthorized:h.tls?.authorized,securityFindings:h.security?.findings}));
  if(value?.repository)summary.repository=value.repository.name;
  if(value?.pullRequest)summary.pullRequest={number:value.pullRequest.number,headSha:value.pullRequest.headSha};
  if(value?.workflowRun)summary.workflowRun={id:value.workflowRun.id,status:value.workflowRun.status,conclusion:value.workflowRun.conclusion,sameCommit:value.sameCommit};
  if(value?.os)summary.os=value.os;if(value?.ports)summary.ports=value.ports;
  console.log(JSON.stringify(summary,null,2));
}
export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function responseText(response,maxBytes=8000000) {
  const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>maxBytes)throw new Error(`Response exceeds ${maxBytes} bytes`);chunks.push(chunk);}return Buffer.concat(chunks).toString('utf8');
}
export function assertNode() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 4) || !globalThis.WebSocket) throw new Error('Node.js 22.4+ with built-in WebSocket is required');
}
export function loopbackURL(value, protocols = ['http:']) {
  const u = new URL(value);
  if (!protocols.includes(u.protocol) || !['127.0.0.1', '[::1]', 'localhost'].includes(u.hostname) || u.username || u.password) {
    throw new Error('The debugging endpoint must use a loopback address with no credentials');
  }
  if(u.hostname==='localhost')u.hostname='127.0.0.1';
  return u;
}
export function pageURL(value) {
  if (value === 'about:blank') return value;
  const u = new URL(value);
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw new Error('Use an http(s) page URL without embedded credentials');
  return u.href;
}
export async function fetchJSON(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return JSON.parse((await responseText(response)).replace(/^\uFEFF/,''));
}

export class CDP {
  constructor(socket,{maxMessageBytes=32000000}={}) {
    this.socket = socket; this.nextID = 0; this.pending = new Map(); this.listeners = new Set();this.protocolErrors=0;
    socket.addEventListener('message', event => {
      let message;
      if(typeof event.data!=='string'||Buffer.byteLength(event.data)>maxMessageBytes){this.protocolErrors++;this.fail(new Error('Unsupported or oversized CDP message; narrow the capture or explicitly adjust the message budget'));socket.close();return;}
      try { message = JSON.parse(event.data);if(!message||typeof message!=='object'||Array.isArray(message))throw new Error('Invalid CDP message'); } catch {this.protocolErrors++;return;}
      if (message.id) {
        const p = this.pending.get(message.id);
        if (!p) return;
        this.pending.delete(message.id); clearTimeout(p.timer);
        message.error ? p.reject(new Error(`${p.method}: ${message.error.message}`)) : p.resolve(message.result ?? {});
      } else if(typeof message.method==='string'&&message.params&&typeof message.params==='object') {for(const fn of this.listeners){try{fn(message);}catch{this.protocolErrors++;}}}
      else this.protocolErrors++;
    });
    socket.addEventListener('close', () => this.fail(new Error('CDP connection closed')));
    socket.addEventListener('error', () => this.fail(new Error('CDP connection failed')));
  }
  static async connect(url,options={}) {
    const socket = new WebSocket(loopbackURL(url,['ws:']).href);
    const client = new CDP(socket,options);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { socket.close(); reject(new Error('CDP connection timeout')); }, 5000);
      socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Cannot open CDP WebSocket')); }, { once: true });
    });
    return client;
  }
  fail(error) {
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(error); }
    this.pending.clear();
  }
  send(method, params = {}, timeout = 15000,sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextID;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, timeout);
      this.pending.set(id, { resolve, reject, timer, method });
      try { this.socket.send(JSON.stringify({ id, method, params,...(sessionId?{sessionId}:{}) })); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  session(sessionId) {
    const parent=this;
    return {send:(method,params,timeout)=>parent.send(method,params,timeout,sessionId),on:fn=>parent.on(message=>{if(message.sessionId===sessionId)fn(message);}),get protocolErrors(){return parent.protocolErrors;}};
  }
  close() { this.fail(new Error('CDP client closed')); this.socket.close(); }
}
