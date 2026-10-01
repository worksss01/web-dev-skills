import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { args, number, loopbackURL, pageURL, required } from '../web-debug/scripts/common.mjs';
import { hash, readableHTML, sourceURL, classify, fetchSource, portableSnapshotPath, resolveSnapshotPath } from '../web-debug/scripts/refresh.mjs';

test('CLI preserves literal input without shell evaluation',()=>{
  assert.equal(args(['run','--plan','C:/my work/$(literal).json']).plan,'C:/my work/$(literal).json');
  assert.throws(()=>args(['--tab','a','--tab','b']),/Duplicate/);
  assert.throws(()=>required(args(['--plan']),'plan'),/Missing/);
});
test('debug endpoint is loopback only and has no credentials',()=>{
  assert.equal(loopbackURL('http://127.0.0.1:9222').port,'9222');
  for(const value of ['http://example.com:9222','http://127.0.0.1.evil.test','http://user:pass@localhost:9222','https://127.0.0.1:9222']) assert.throws(()=>loopbackURL(value));
});
test('page navigation rejects executable/local-file URL schemes',()=>{
  assert.equal(pageURL('about:blank'),'about:blank');
  assert.equal(pageURL('http://localhost:3000'),'http://localhost:3000/');
  for(const value of ['javascript:alert(1)','file:///etc/passwd','data:text/html,test','https://user:pass@example.com']) assert.throws(()=>pageURL(value));
});
test('numeric limits reject invalid or unbounded waits',()=>{
  assert.equal(number(undefined,10,0,30),10);
  assert.throws(()=>number('NaN',0,0,30));assert.throws(()=>number(31,0,0,30));
});
test('documentation URL allowlist checks full host and TLS',()=>{
  assert.equal(sourceURL('https://react.dev/reference/react',['react.dev']).hostname,'react.dev');
  for(const value of ['http://react.dev','https://react.dev.evil.test','https://evil.test/react.dev','https://react.dev:8443','https://user@react.dev']) assert.throws(()=>sourceURL(value,['react.dev']));
});
test('document extraction excludes script/style instructions',()=>{
  assert.equal(readableHTML('<style>hide</style><script>bad()</script><h1>Hello</h1><p>A &amp; B</p>'),'Hello A & B');
});
test('first fetch always needs semantic review',()=>{
  const e=classify(undefined,{sha256:'a',text:'doc'},'2026-09-28T00:00:00Z');
  assert.equal(e.change,'first-fetch');assert.equal(e.reviewRequired,true);assert.equal(e.text,undefined);
});
test('changed content stays pending across repeated fetches',()=>{
  const changed=classify({sha256:'old',reviewedSha256:'old'},{sha256:'new'},'2026-09-28T01:00:00Z');
  const repeat=classify(changed,{sha256:'new'},'2026-09-28T02:00:00Z');
  assert.equal(changed.change,'changed');assert.equal(repeat.change,'unchanged');assert.equal(repeat.reviewRequired,true);
  assert.equal(repeat.reviewedSha256,'old');
});
test('unchanged reviewed content stays reviewed',()=>{
  assert.equal(classify({sha256:'a',reviewedSha256:'a'},{sha256:'a'},'now').reviewRequired,false);
  assert.equal(hash('same'),hash('same'));assert.notEqual(hash('same'),hash('different'));
});
test('documentation redirect is revalidated before the next network request',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(null,{status:302,headers:{location:'https://untrusted.example/document'}});};
  try {await assert.rejects(fetchSource({url:'https://react.dev/reference/react',allowedHosts:['react.dev']}),/Unapproved/);assert.equal(calls,1);}
  finally {globalThis.fetch=original;}
});
test('failed fetch and tiny challenge content are not accepted as knowledge',async()=>{
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async()=>new Response('Unavailable',{status:503});
    await assert.rejects(fetchSource({url:'https://react.dev/',allowedHosts:['react.dev']}),/503/);
    globalThis.fetch=async()=>new Response('<p>Checking browser</p>',{headers:{'content-type':'text/html'}});
    await assert.rejects(fetchSource({url:'https://react.dev/',allowedHosts:['react.dev']}),/too short/);
  } finally {globalThis.fetch=original;}
});
test('snapshot paths remain portable and resolve from the knowledge directory',()=>{
  const expected='snapshots/baseline-abc.txt';
  for(const stored of [expected,'snapshots\\baseline-abc.txt','D:\\old machine\\knowledge\\snapshots\\baseline-abc.txt','/old-machine/knowledge/snapshots/baseline-abc.txt','\\\\old-host\\share\\knowledge\\snapshots\\baseline-abc.txt']) {
    assert.equal(portableSnapshotPath(stored),expected);
    assert.equal(resolveSnapshotPath('moved knowledge',stored),path.resolve('moved knowledge','snapshots','baseline-abc.txt'));
  }
});
test('snapshot resolution refuses traversal and unrelated legacy locations',()=>{
  for(const stored of ['../secrets.txt','snapshots/../secrets.txt','snapshots/nested/document.txt','snapshots/../../secrets.txt','C:\\private\\secret.txt','C:snapshots/file.txt','snapshots/foo.txt:stream','']) {
    assert.throws(()=>portableSnapshotPath(stored));
  }
});
