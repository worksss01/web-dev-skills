import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';
import {generateKeyPairSync,sign,createHash,randomUUID} from 'node:crypto';
import {verifyEnvelope,enroll,applyUpdate,rollback,inventory,canUpgrade,publicJSON,setAuto,MARKER} from '../web-debug/scripts/update.mjs';
import {createReport} from '../web-debug/scripts/report.mjs';
import {prepare,sendPrepared,github} from '../web-debug/scripts/delivery.mjs';
import {recordClaim,assessKnowledge,versionMatches} from '../web-debug/scripts/knowledge-review.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const {privateKey,publicKey}=generateKeyPairSync('ed25519'),trust={keys:[{id:'fixture',pem:publicKey.export({format:'pem',type:'spki'}).toString()}]};
function signed(version='1.7.0',extra={}){const files={'SKILL.md':'Fixture skill','LICENSE':'Fixture license','scripts/update.mjs':'// fixture updater','scripts/common.mjs':`export const VERSION='${version}';`,...extra};const p={schema:1,version,compatibilityEpoch:1,channel:'stable',files:Object.fromEntries(Object.entries(files).map(([n,b])=>[n,Buffer.from(b).toString('base64')]))};const bytes=Buffer.from(JSON.stringify(p));return {schema:1,keyId:'fixture',payload:bytes.toString('base64'),signature:sign(null,bytes,privateKey).toString('base64')};}
async function fixture(){const base=path.resolve('work/maintenance-tests');await fs.mkdir(base,{recursive:true});return fs.mkdtemp(path.join(base,'case-'));}
async function installed(root,p){await fs.mkdir(root);for(const [name,b] of Object.entries(p.files)){const file=path.join(root,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,b);}}
test('signed updates authenticate bytes and reject tampering, unknown keys and unsafe paths',()=>{
 const valid=signed();assert.equal(verifyEnvelope(valid,trust).version,'1.7.0');
 assert.throws(()=>verifyEnvelope({...valid,payload:Buffer.from('{}').toString('base64')},trust),/signature/);
 assert.throws(()=>verifyEnvelope({...valid,keyId:'other'},trust),/Unknown/);
 assert.throws(()=>verifyEnvelope(signed('1.7.0',{'../escape':'x'}),trust),/path/);
 assert.throws(()=>verifyEnvelope(signed('1.7.0',{'scripts/con.mjs':'x'}),trust),/Device/);
 assert.equal(canUpgrade('1.7.0','1.7.1'),true);assert.equal(canUpgrade('1.7.0','1.8.0'),false);assert.equal(canUpgrade('1.7.0','1.8.0',true),true);assert.equal(canUpgrade('1.7.1','1.7.0'),false);assert.equal(canUpgrade('1.7.0','2.0.0',true),false);
});
test('enrollment, update and rollback preserve verified content and disable auto after rollback',async()=>{
 const dir=await fixture(),root=path.join(dir,'skill'),p=verifyEnvelope(signed(),trust);await installed(root,p);
 await enroll(root,p,path.join(dir,'state'),{auto:true});
 const next=verifyEnvelope(signed('1.7.1',{'references/new.md':'New reference'}),trust);
 const result=await applyUpdate(root,next);assert.equal(result.to,'1.7.1');assert((await inventory(root))['references/new.md']);
 const back=await rollback(root);assert.equal(back.version,'1.7.0');assert.equal(back.auto,false);assert.equal((await inventory(root))['references/new.md'],undefined);assert.equal((await setAuto(root,true)).auto,true);
});
test('updater refuses user edits, downgrade, linked content and modified backups',async()=>{
 const dir=await fixture(),root=path.join(dir,'skill'),p=verifyEnvelope(signed(),trust);await installed(root,p);await enroll(root,p,path.join(dir,'state'));
 await fs.appendFile(path.join(root,'SKILL.md'),' User note');await assert.rejects(applyUpdate(root,verifyEnvelope(signed('1.7.1'),trust)),/Local edits/);assert.match(await fs.readFile(path.join(root,'SKILL.md'),'utf8'),/User note/);
 await fs.writeFile(path.join(root,'SKILL.md'),p.files['SKILL.md']);await assert.rejects(applyUpdate(root,verifyEnvelope(signed('1.6.9'),trust)),/Downgrade/);
 await applyUpdate(root,verifyEnvelope(signed('1.7.1'),trust));const marker=JSON.parse(await fs.readFile(path.join(root,MARKER),'utf8'));await fs.appendFile(path.join(marker.stateDir,marker.lastBackup,'SKILL.md'),'tamper');await assert.rejects(rollback(root),/Backup changed/);
});
test('release fetch refuses redirects outside trusted hosts without forwarding credentials',async()=>{
 const calls=[];await assert.rejects(publicJSON('https://api.github.com/repos/fixture',async(url,options)=>{calls.push({url,options});return new Response('',{status:302,headers:{location:'https://evil.example/collect'}});}),/Untrusted/);
 assert.equal(calls.length,1);assert.equal(calls[0].options.headers.Authorization,undefined);
});
test('updater rejects linked enrollment and file payloads without reading their targets',async()=>{
 const dir=await fixture(),root=path.join(dir,'skill'),p=verifyEnvelope(signed(),trust);await installed(root,p);await enroll(root,p,path.join(dir,'state'));
 const marker=path.join(root,MARKER),outside=path.join(dir,'marker-backup.json');await fs.rename(marker,outside);await fs.symlink(outside,marker,'file');
 await assert.rejects(applyUpdate(root,verifyEnvelope(signed('1.7.1'),trust)),/linked updater metadata/);
 await fs.unlink(marker);await fs.rename(outside,marker);
 const file=path.join(root,'LICENSE'),external=path.join(dir,'license.txt');await fs.rename(file,external);await fs.symlink(external,file,'file');await assert.rejects(inventory(root),/Linked/);
});
async function reportFixture(kind='bug'){
 const dir=await fixture(),store=path.join(dir,'reports'),r=await createReport(store,{title:'Synthetic tool failure',summary:'Controlled fixture only; no real credentials.',kind});const p=await prepare(store,r.report.id,path.join(dir,'outbox'));return {dir,store,p};
}
test('report preview is local and security reports cannot enter public submission',async()=>{
 const {p}=await reportFixture();let calls=0;await assert.rejects(sendPrepared(p,{reviewedSha:'wrong',request:async()=>{calls++;}}),/exact preview/);assert.equal(calls,0);
 await assert.rejects(reportFixture('security'),/Private security/);
});
test('reviewed report delivery records a real receipt and deduplicates repeat requests',async()=>{
 const {p}=await reportFixture();let posts=0;
 const request=async(method,url)=>url==='/user'?{login:'fixture-owner'}:method==='GET'?[]:(posts++,{number:42,html_url:'https://github.com/worksss01/web-dev-skills/issues/42'});
 const first=await sendPrepared(p,{reviewedSha:p.sha256,token:'fixture-auth',request});assert(first.submitted);
 const second=await sendPrepared(p,{reviewedSha:p.sha256,token:'fixture-auth',request});assert(second.alreadySent);assert.equal(posts,1);
});
test('uncertain delivery never blindly retries and can recover by authenticated author plus marker',async()=>{
 const {p}=await reportFixture();let posts=0,visible=false;
 const request=async(method,url)=>{if(url==='/user')return {login:'fixture-owner'};if(method==='GET')return visible?[{number:73,html_url:'https://github.com/worksss01/web-dev-skills/issues/73',user:{login:'fixture-owner'},body:`<!-- web-debug-report:${p.id} -->`}]:[];posts++;throw new Error('Synthetic timeout');};
 await assert.rejects(sendPrepared(p,{reviewedSha:p.sha256,token:'fixture-auth',request}),/unknown/);
 await assert.rejects(sendPrepared(p,{reviewedSha:p.sha256,token:'fixture-auth',request}),/uncertain/);assert.equal(posts,1);
 visible=true;assert((await sendPrepared(p,{reviewedSha:p.sha256,token:'fixture-auth',request})).alreadySent);assert.equal(posts,1);
});
test('report transport is fixed to GitHub and does not expose response bodies on failure',async()=>{
 await assert.rejects(github('GET','/other',null,'fixture-auth'),/Unapproved/);
 await assert.rejects(github('POST','/repos/worksss01/web-dev-skills/issues',{},'fixture-auth',async()=>new Response('SYNTHETIC_PRIVATE_RESPONSE',{status:403})),e=>!e.message.includes('SYNTHETIC')&&e.message.includes('403'));
});
test('claim reviews bind to source hash/quote and distinguish exact, wrong and unknown versions',async()=>{
 const dir=await fixture(),text='Official-reference fixture: the page expects matching server and client markup. No network was used.';await fs.mkdir(path.join(dir,'snapshots'));await fs.writeFile(path.join(dir,'snapshots','react.txt'),text);await fs.writeFile(path.join(dir,'ledger.json'),JSON.stringify({schema:2,sources:{'react-hydration':{sha256:hash(text),snapshot:'snapshots/react.txt',lastError:null}}}));
 const claim={id:'hydrate-match',topic:'hydration',sourceId:'react-hydration',sha256:hash(text),package:'react',versions:['19.x'],statement:'Server/client markup must match.',quote:'the page expects matching server and client markup',decision:'verified',reason:'Reviewed the controlled fixture against its expected wording.'};
 await recordClaim(dir,claim);assert.equal((await assessKnowledge(dir,{react:'19.1.0'})).claims[0].usable,true);assert.equal((await assessKnowledge(dir,{react:'18.3.0'})).claims[0].usable,false);assert.equal((await assessKnowledge(dir,{react:'^19'})).claims[0].applicable,null);
 await assert.rejects(recordClaim(dir,{...claim,quote:'not in source'}),/quote/);
 await recordClaim(dir,{...claim,id:'conflicting-claim',statement:'A different reviewer assertion.'});const assessment=await assessKnowledge(dir,{react:'19.1.0'});assert.equal(assessment.possibleConflicts.length,1);assert(assessment.claims.every(c=>!c.usable));
 await fs.appendFile(path.join(dir,'snapshots','react.txt'),'tampered');assert((await assessKnowledge(dir,{react:'19.1.0'})).claims.every(c=>!c.current));assert.equal(versionMatches('19.0.0',['19.0.0']),true);
});
