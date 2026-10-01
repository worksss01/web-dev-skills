import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {containedPath,exists,readJSON,readText,writeFile,writeJSON,delay} from './common.mjs';

export async function prepareState(directory) {
  const root=path.resolve(directory);await fs.mkdir(root,{recursive:true,mode:0o700});
  const entries=await fs.readdir(root);
  if(entries.some(name=>!/^profile-/.test(name)&&!['session.json','session.previous.json','operation.lock','launch.lock','.context-key','.gitignore'].includes(name)))throw new Error('Use a dedicated state directory, not a project or mixed-content directory');
  if(process.platform!=='win32')await fs.chmod(root,0o700);
  const ignore=await containedPath(root,'.gitignore');
  const rules=['/profile-*/','/session.json','/session.previous.json','/operation.lock','/launch.lock','/.context-key'];
  const existing=await exists(ignore)?await readText(ignore,64000):'';
  const missing=rules.filter(rule=>!existing.split(/\r?\n/).includes(rule));
  if(missing.length)await writeFile(ignore,existing+(existing&&!existing.endsWith('\n')?'\n':'')+missing.join('\n')+'\n');
  const keyPath=await containedPath(root,'.context-key');
  if(!await exists(keyPath))await writeFile(keyPath,randomBytes(32).toString('hex')+'\n',{overwrite:false});
  const contextKey=(await readText(keyPath,256)).trim();
  if(!/^[a-f0-9]{64}$/.test(contextKey))throw new Error('Malformed private context key');
  return {root,contextKey};
}

export async function createProfile(root) {
  const profile=await fs.mkdtemp(path.join(root,'profile-'));
  await writeFile(path.join(profile,'.gitignore'),'*\n');
  await writeJSON(path.join(profile,'.web-debug-profile.json'),{owner:'web-debug',createdAt:new Date().toISOString()});
  return profile;
}

export async function purgeProfile(root,profile) {
  const relative=path.relative(path.resolve(root),path.resolve(profile));
  if(!/^profile-[A-Za-z0-9]+$/.test(relative))throw new Error('Refusing to purge a non-owned profile path');
  const resolved=await containedPath(root,relative);
  if((await fs.lstat(resolved)).isSymbolicLink())throw new Error('Refusing to purge a profile link');
  const marker=await readJSON(path.join(resolved,'.web-debug-profile.json'),1024);
  if(marker.owner!=='web-debug')throw new Error('Profile ownership marker missing');
  // Resolved target is an explicitly owned child of the selected task directory.
  await fs.rm(resolved,{recursive:true,maxRetries:6,retryDelay:150});
}

export async function closeChild(child,cdp) {
  if(!child.pid)return;
  try {await cdp?.send('Browser.close',{},2000);}catch{}
  const deadline=Date.now()+4000;
  while(child.exitCode===null&&child.signalCode===null&&Date.now()<deadline)await delay(50);
  if(child.exitCode===null&&child.signalCode===null)child.kill();
  for(let i=0;i<20&&child.exitCode===null&&child.signalCode===null;i++)await delay(50);
}
