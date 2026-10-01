import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { args, required, writeJSON, readJSON } from '../web-debug/scripts/common.mjs';
import { hash } from '../web-debug/scripts/refresh.mjs';
const exec=promisify(execFile);
const options=args(process.argv.slice(2));
const base=path.resolve(required(options,'work'));await fs.mkdir(base,{recursive:true});
const work=await fs.mkdtemp(path.join(base,'package-'));
const kit=fileURLToPath(new URL('..',import.meta.url));
const checks=[];
function passed(name){checks.push(name);console.log(`PASS ${name}`);}
async function node(script,argv,exit=0,cwd=kit){
  try {const r=await exec(process.execPath,[path.join(kit,script),...argv],{windowsHide:true,cwd});assert.equal(exit,0);return r.stdout;}
  catch(e){if(exit!==0&&e.code===exit)return e.stderr;throw e;}
}
const project=path.join(work,'project');await fs.mkdir(project);
await exec('git',['init',project],{windowsHide:true});
await node('install.mjs',['--project',project]);
const left=path.join(project,'.agents/skills/web-debug/SKILL.md');
const right=path.join(project,'.claude/skills/web-debug/SKILL.md');
assert.equal(await fs.readFile(left,'utf8'),await fs.readFile(right,'utf8'));passed('Install identical skill files for Codex and Claude inside the repository');
const repeated=JSON.parse(await node('install.mjs',['--project',project]));assert.equal(repeated.alreadyCurrent.length,2);passed('Repeat an identical installation without overwriting files');
await fs.appendFile(left,'\nLOCAL USER NOTE\n');
const conflict=await node('install.mjs',['--project',project],1);assert.match(conflict,/Existing skill preserved/);
assert((await fs.readFile(left,'utf8')).includes('LOCAL USER NOTE'));passed('Preserve existing installations and user edits');
const nonRepo=path.join(work,'not-a-project');await fs.mkdir(nonRepo);
// This workspace may itself be nested in a parent repository; test an invalid path instead of assuming nonRepo is outside Git.
const invalid=await node('install.mjs',['--project',path.join(work,'missing')],1);assert.match(invalid,/ENOENT/);passed('Reject missing installation target');
const ledgerDir=path.join(work,'knowledge');const snapshot=path.join(ledgerDir,'snapshots','baseline.txt');
const content='Local fixture representing a reviewed official reference. This is a test of hash-bound review bookkeeping.';
await fs.mkdir(path.dirname(snapshot),{recursive:true});await fs.writeFile(snapshot,content);
await writeJSON(path.join(ledgerDir,'ledger.json'),{schema:2,snapshotBase:'ledger-directory',sources:{baseline:{sha256:hash(content),snapshot:'snapshots/baseline.txt',fetchedAt:new Date().toISOString(),reviewRequired:true}}});
const note=path.join(work,'review.md');await fs.writeFile(note,'Reviewed the local test snapshot. No API migration is implied. This note validates hash-bound review bookkeeping only.');
const mismatch=await node('web-debug/scripts/refresh.mjs',['review','--out',ledgerDir,'--id','baseline','--sha256','wrong','--note-file',note],1);
assert.match(mismatch,/Hash differs/);passed('Refuse review of an outdated or wrong document hash');
await node('web-debug/scripts/refresh.mjs',['review','--out',ledgerDir,'--id','baseline','--sha256',hash(content),'--note-file',note]);
assert.equal((await readJSON(path.join(ledgerDir,'ledger.json'))).sources.baseline.reviewedSha256,hash(content));passed('Record reviewed hash and review history');
let status=JSON.parse(await node('web-debug/scripts/refresh.mjs',['status','--out',ledgerDir]));
assert.equal(status.find(s=>s.id==='baseline').reviewRequired,false);assert.equal(status.find(s=>s.id==='baseline').reviewOverdue,false);
assert.equal(status.find(s=>s.id==='cdp').reviewRequired,true);passed('Separate reviewed sources from never-fetched sources');
const ledger=await readJSON(path.join(ledgerDir,'ledger.json'));
ledger.sources.baseline.lastError='Simulated offline fetch';ledger.sources.baseline.reviewedAt='2020-01-01T00:00:00Z';
await writeJSON(path.join(ledgerDir,'ledger.json'),ledger);
status=JSON.parse(await node('web-debug/scripts/refresh.mjs',['status','--out',ledgerDir]));
assert.equal(status.find(s=>s.id==='baseline').reviewRequired,true);assert.equal(status.find(s=>s.id==='baseline').reviewOverdue,true);passed('Report failed refresh and overdue review without erasing prior evidence');
await fs.writeFile(snapshot,content+'tampered');
ledger.sources.baseline.lastError=null;await writeJSON(path.join(ledgerDir,'ledger.json'),ledger);
const tamper=await node('web-debug/scripts/refresh.mjs',['review','--out',ledgerDir,'--id','baseline','--sha256',hash(content),'--note-file',note],1);
assert.match(tamper,/Snapshot hash mismatch/);passed('Refuse acknowledgment of a modified snapshot');

// Move the complete knowledge bundle logically: copy it, then invalidate the old
// snapshot so any accidental dependency on the original directory would fail.
await fs.writeFile(snapshot,content);
const relocated=path.join(work,'moved knowledge');await fs.cp(ledgerDir,relocated,{recursive:true});
await fs.writeFile(snapshot,'The old machine location must not be used.');
await node('web-debug/scripts/refresh.mjs',['review','--out',relocated,'--id','baseline','--sha256',hash(content),'--note-file',note],0,project);
assert.equal((await readJSON(path.join(relocated,'ledger.json'))).sources.baseline.snapshot,'snapshots/baseline.txt');
passed('Review relocated knowledge from another working directory without the original snapshot');

const legacyDir=path.join(work,'copied legacy knowledge');await fs.mkdir(path.join(legacyDir,'snapshots'),{recursive:true});
const oldDate='2026-09-01T00:00:00Z';
const legacy={schema:1,sources:{
  baseline:{sha256:hash(content),snapshot:'Z:\\old-machine\\knowledge\\snapshots\\baseline.txt',fetchedAt:oldDate,reviewedAt:oldDate,reviewedSha256:hash(content),reviewRequired:false},
  cdp:{sha256:hash(content),snapshot:'/old-machine/knowledge/snapshots/cdp.txt',fetchedAt:oldDate,reviewRequired:true}
}};
for(const id of ['baseline','cdp']) await fs.writeFile(path.join(legacyDir,'snapshots',`${id}.txt`),content);
await writeJSON(path.join(legacyDir,'ledger.json'),legacy);
await node('web-debug/scripts/refresh.mjs',['review','--out',legacyDir,'--id','cdp','--sha256',hash(content),'--note-file',note],0,project);
assert.equal((await readJSON(path.join(legacyDir,'ledger.json'))).sources.cdp.snapshot,'snapshots/cdp.txt');
passed('Read a copied legacy absolute path and normalize it on review');
// Restore the original fixture to test both path syntaxes in one migration.
await writeJSON(path.join(legacyDir,'ledger.json'),legacy);
const migrated=JSON.parse(await node('web-debug/scripts/refresh.mjs',['migrate','--out',legacyDir],0,project));
assert.equal(migrated.migrated,2);assert.equal(migrated.verified,2);
const migratedLedger=await readJSON(path.join(legacyDir,'ledger.json'));
assert.equal(migratedLedger.schema,2);
assert.equal(migratedLedger.sources.baseline.snapshot,'snapshots/baseline.txt');
assert.equal(migratedLedger.sources.cdp.snapshot,'snapshots/cdp.txt');
assert.equal(migratedLedger.sources.baseline.fetchedAt,oldDate);
assert.equal(migratedLedger.sources.baseline.reviewedAt,oldDate);
assert.equal(migratedLedger.sources.baseline.reviewedSha256,hash(content));
passed('Migrate Windows and POSIX legacy paths without resetting evidence or review dates');
assert.equal(JSON.parse(await node('web-debug/scripts/refresh.mjs',['migrate','--out',legacyDir])).migrated,0);
passed('Migration is repeatable without modifying already portable paths');

await writeJSON(path.join(legacyDir,'ledger.json'),{...legacy,sources:{...legacy.sources,missing:{sha256:hash(content),snapshot:'/old-machine/snapshots/missing.txt'}}});
const beforeFailure=await fs.readFile(path.join(legacyDir,'ledger.json'),'utf8');
const missingSnapshot=await node('web-debug/scripts/refresh.mjs',['migrate','--out',legacyDir],1);
assert.match(missingSnapshot,/Local snapshot missing/);
assert.equal(await fs.readFile(path.join(legacyDir,'ledger.json'),'utf8'),beforeFailure);
passed('A missing copied snapshot prevents partial ledger migration');
await writeJSON(path.join(base,'package-validation.json'),{testedAt:new Date().toISOString(),checks,allPassed:true});
