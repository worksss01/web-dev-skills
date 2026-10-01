import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {verifyPackage} from '../install.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const exec=promisify(execFile),kit=fileURLToPath(new URL('..',import.meta.url));
async function manifest(root){const records=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.name==='MANIFEST.sha256')continue;const file=path.join(dir,e.name);if(e.isDirectory())await walk(file);else records.push(`${hash(await fs.readFile(file))}  ${path.relative(root,file).split(path.sep).join('/')}`);}}await walk(root);await fs.writeFile(path.join(root,'MANIFEST.sha256'),records.sort().join('\n')+'\n');}
async function fixture(){const base=path.resolve('work/install-integrity');await fs.mkdir(base,{recursive:true});const root=await fs.mkdtemp(path.join(base,'case-'));await fs.mkdir(path.join(root,'web-debug'));for(const [name,value] of [['install.mjs','fixture installer'],['README.md','fixture instructions'],['web-debug/SKILL.md','fixture skill'],['web-debug/ข้อความ test.txt','fixture Thai content']])await fs.writeFile(path.join(root,name),value);await manifest(root);return root;}

test('Intact manifest verifies all listed files and Unicode/space paths without claiming publisher identity',async()=>{
  const result=await verifyPackage(await fixture());assert.equal(result.filesVerified,4);assert.equal(result.publisherAuthenticated,false);assert.equal(JSON.parse(result.skillInventory).length,2);
});
test('Modified skill content is rejected by its manifest hash',async()=>{
  const root=await fixture();await fs.appendFile(path.join(root,'web-debug/SKILL.md'),'changed');await assert.rejects(verifyPackage(root),/Manifest hash mismatch/);
});
test('Missing skill or non-skill evidence files are rejected as incomplete extraction',async()=>{
  for(const relative of ['web-debug/SKILL.md','README.md']){const root=await fixture();await fs.unlink(path.join(root,relative));await assert.rejects(verifyPackage(root),/ENOENT/);}
});
test('Missing manifest cannot silently fall back to unchecked installation',async()=>{
  const root=await fixture();await fs.unlink(path.join(root,'MANIFEST.sha256'));await assert.rejects(verifyPackage(root),/ENOENT/);
});
test('Extra unlisted skill content is rejected before copying',async()=>{
  const root=await fixture();await fs.writeFile(path.join(root,'web-debug/extra.md'),'unexpected instructions');await assert.rejects(verifyPackage(root),/unlisted/);
});
test('Duplicate and case-aliased manifest paths are rejected on every OS',async()=>{
  for(const name of ['web-debug/SKILL.md','WEB-DEBUG/skill.md']){const root=await fixture();await fs.appendFile(path.join(root,'MANIFEST.sha256'),`${hash('fixture skill')}  ${name}\n`);await assert.rejects(verifyPackage(root),/Duplicate or case-aliased/);}
});
test('Malformed hashes, traversal, absolute paths, devices and self-entries cannot become package reads',async()=>{
  const root=await fixture(),file=path.join(root,'MANIFEST.sha256');
  for(const value of ['not-a-hash  web-debug/SKILL.md',...['../outside','/absolute','C:/outside','web-debug\\bad','web-debug/a:stream','web-debug/CON','web-debug/file.','MANIFEST.sha256'].map(name=>`${hash('fixture')}  ${name}`)]){
    await fs.writeFile(file,value+'\n');await assert.rejects(verifyPackage(root),/Malformed|portable relative/);
  }
});
test('Manifest entries cannot traverse static file or parent-directory links',async()=>{
  for(const directory of [false,true]){
    const root=await fixture(),outside=await fixture(),relative=directory?'linked/README.md':'linked.md';
    await fs.symlink(directory?outside:path.join(outside,'README.md'),path.join(root,directory?'linked':'linked.md'),directory?(process.platform==='win32'?'junction':'dir'):'file');
    await fs.appendFile(path.join(root,'MANIFEST.sha256'),`${hash('fixture instructions')}  ${relative}\n`);await assert.rejects(verifyPackage(root),/Package links/);
  }
});
test('The manifest itself cannot be a link',async()=>{
  const root=await fixture(),original=path.join(root,'original.sha256'),file=path.join(root,'MANIFEST.sha256');await fs.rename(file,original);await fs.symlink(original,file,'file');await assert.rejects(verifyPackage(root),/Package links/);
});
test('Manifest coverage must include the installer and skill entry point',async()=>{
  for(const omitted of ['install.mjs','web-debug/SKILL.md']){const root=await fixture(),file=path.join(root,'MANIFEST.sha256');await fs.writeFile(file,(await fs.readFile(file,'utf8')).split('\n').filter(line=>!line.endsWith('  '+omitted)).join('\n'));await assert.rejects(verifyPackage(root),/must cover/);}
});
test('Changing a file and its manifest can still verify: integrity is not authentication',async()=>{
  const root=await fixture();await fs.appendFile(path.join(root,'web-debug/SKILL.md'),'rewritten content');await manifest(root);const result=await verifyPackage(root);assert.equal(result.publisherAuthenticated,false);
});
test('Oversized manifest is rejected before parsing its contents',async()=>{
  const root=await fixture();await fs.writeFile(path.join(root,'MANIFEST.sha256'),'x'.repeat(1000001));await assert.rejects(verifyPackage(root),/oversized/);
});
test('Installer CLI verifies before importing a damaged skill helper or creating target directories',async()=>{
  const base=path.resolve('work/install-integrity');await fs.mkdir(base,{recursive:true});const root=await fs.mkdtemp(path.join(base,'cli-')),bundle=path.join(root,'bundle'),project=path.join(root,'project');await fs.mkdir(bundle);await fs.mkdir(project);
  await fs.copyFile(path.join(kit,'install.mjs'),path.join(bundle,'install.mjs'));await fs.cp(path.join(kit,'web-debug'),path.join(bundle,'web-debug'),{recursive:true});await manifest(bundle);
  await fs.writeFile(path.join(bundle,'web-debug/scripts/common.mjs'),'this is not valid JavaScript!');
  await assert.rejects(exec(process.execPath,[path.join(bundle,'install.mjs'),'--project',project],{windowsHide:true}),error=>error.code===1&&/Manifest hash mismatch/.test(error.stderr)&&!/SyntaxError/.test(error.stderr));
  assert.deepEqual(await fs.readdir(project),[]);
});
