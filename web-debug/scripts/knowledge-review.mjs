import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {options,required,readJSON,readText,writeJSON,containedPath,acquireLock} from './common.mjs';
import {portableSnapshotPath} from './refresh.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const ID=/^[a-z0-9][a-z0-9-]{0,79}$/;
function text(value,label,max=4000){if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error('Invalid '+label);return value.trim();}
export function normalizeClaim(input){
  const allowed=['id','topic','sourceId','sha256','package','versions','statement','quote','decision','reason','replacement'];
  if(!input||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k)))throw new Error('Unknown claim fields');
  if(!ID.test(input.id)||!ID.test(input.sourceId)||!/^[a-f0-9]{64}$/.test(input.sha256??''))throw new Error('Invalid claim/source identity');
  if(!Array.isArray(input.versions)||!input.versions.length||input.versions.length>30||input.versions.some(v=>!/^(?:\d+\.x|\d+(?:\.\d+){1,3})$/.test(v)))throw new Error('Versions must be explicit major.x or exact numeric versions');
  if(!['verified','deprecated','conflict','needs-review'].includes(input.decision))throw new Error('Invalid review decision');
  return {...input,topic:text(input.topic,'topic',160),package:text(input.package,'package',100),statement:text(input.statement,'statement'),quote:text(input.quote,'source quote',2000),reason:text(input.reason,'reason'),replacement:input.replacement?text(input.replacement,'replacement'):null};
}
async function load(root){
  root=await fs.realpath(root);
  const ledger=await readJSON(await containedPath(root,'ledger.json'),4_000_000);
  if(!ledger?.sources||Array.isArray(ledger.sources))throw new Error('Invalid knowledge ledger');
  let records={schema:1,claims:[]};
  try{records=await readJSON(await containedPath(root,'claims.json'),4_000_000);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(records.schema!==1||!Array.isArray(records.claims)||records.claims.length>500)throw new Error('Invalid claim store');
  for(const record of records.claims){normalizeClaim(record.claim);if(!Number.isFinite(Date.parse(record.reviewedAt))||!Array.isArray(record.history))throw new Error('Invalid claim history');}
  return {root,ledger,records};
}
export async function recordClaim(root,input){
  const claim=normalizeClaim(input),loaded=await load(root);
  const release=await acquireLock(await containedPath(loaded.root,'claims.lock'));
  try{
    const {ledger,records}=await load(loaded.root);
    const sources=await readJSON(new URL('../references/sources.json',import.meta.url));
    if(!sources.sources.some(s=>s.id===claim.sourceId))throw new Error('Source is not in the maintained official registry');
    const entry=ledger.sources[claim.sourceId];
    if(entry?.lastError||entry?.sha256!==claim.sha256)throw new Error('Claim must bind to the latest successful fetched hash');
    const snapshot=await readText(await containedPath(loaded.root,portableSnapshotPath(entry.snapshot)),8_000_000,{noFollow:true});
    if(hash(snapshot)!==entry.sha256||!snapshot.includes(claim.quote))throw new Error('Snapshot hash or supporting quote does not match');
    const index=records.claims.findIndex(r=>r.claim.id===claim.id),previous=records.claims[index];
    if(index<0&&records.claims.length>=500)throw new Error('Claim store limit reached');
    const history=previous?[...previous.history,{claim:previous.claim,reviewedAt:previous.reviewedAt}]:[];
    if(history.length>20)throw new Error('Preserve and archive long claim histories before continuing');
    const record={claim,reviewedAt:new Date().toISOString(),history};
    if(index<0)records.claims.push(record);else records.claims[index]=record;
    await writeJSON(await containedPath(loaded.root,'claims.json'),records);
    return {id:claim.id,decision:claim.decision,sha256:claim.sha256,note:'Recorded reviewer judgment. A matching quote does not independently prove semantic correctness.'};
  }finally{await release();}
}
export function versionMatches(version,patterns){
  if(!/^\d+(?:\.\d+){1,3}$/.test(version??''))return null;
  return patterns.some(v=>v.endsWith('.x')?version.split('.')[0]===v.split('.')[0]:version===v);
}
export async function assessKnowledge(root,versions={}){
  if(!versions||Array.isArray(versions)||Object.entries(versions).some(([k,v])=>typeof v!=='string'||v.length>100||k.length>100))throw new Error('Use a package-to-observed-version JSON object');
  const {root:dir,ledger,records}=await load(root),registry=await readJSON(new URL('../references/sources.json',import.meta.url));
  const claims=[];
  for(const record of records.claims){
    const c=record.claim,entry=ledger.sources[c.sourceId],source=registry.sources.find(s=>s.id===c.sourceId),age=(Date.now()-Date.parse(record.reviewedAt))/86400000;
    let snapshotVerified=false;
    if(entry?.snapshot){try{snapshotVerified=hash(await readText(await containedPath(dir,portableSnapshotPath(entry.snapshot)),8_000_000,{noFollow:true}))===entry.sha256;}catch{}}
    const current=!!source&&snapshotVerified&&!entry.lastError&&entry.sha256===c.sha256&&age>=0&&age<=source.reviewIntervalDays;
    const applicable=versionMatches(versions[c.package],c.versions);
    claims.push({id:c.id,topic:c.topic,package:c.package,versions:c.versions,statement:c.statement,decision:c.decision,sourceId:c.sourceId,current,applicable,usable:current&&applicable===true&&c.decision==='verified',replacement:c.replacement});
  }
  const possibleConflicts=[];
  for(let i=0;i<claims.length;i++)for(let j=i+1;j<claims.length;j++){
    const a=claims[i],b=claims[j];if(a.current&&b.current&&a.applicable===true&&b.applicable===true&&a.topic===b.topic&&a.package===b.package&&a.statement!==b.statement){possibleConflicts.push([a.id,b.id]);a.usable=b.usable=false;}
  }
  return {schema:1,claims,possibleConflicts,unreviewedSources:registry.sources.filter(s=>!records.claims.some(r=>r.claim.sourceId===s.id)).map(s=>s.id),note:'Differing applicable claims are review candidates, not automatically proven contradictions. Unknown/range versions are never silently treated as exact installed versions.'};
}
export async function main(argv){
 const command=argv[0],o=options(argv,['out','input','versions'],[],1);
 if(o.help){console.log('knowledge record --out CACHE --input REVIEW.json\nknowledge assess --out CACHE [--versions OBSERVED_VERSIONS.json]\nReview fields: id, topic, sourceId, sha256, package, versions, statement, quote, decision, reason, optional replacement.');return;}
 const result=command==='record'?await recordClaim(required(o,'out'),await readJSON(required(o,'input'),128000)):await assessKnowledge(required(o,'out'),o.versions?await readJSON(o.versions,64000):{});
 console.log(JSON.stringify(result,null,2));
}
