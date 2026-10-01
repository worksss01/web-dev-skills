import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {contrastRatio,seoExpression} from '../web-debug/scripts/quality.mjs';
import {reviewText} from '../web-debug/scripts/copy.mjs';
import {reviewSecurityHeaders} from '../web-debug/scripts/security.mjs';
import {inspectEdge} from '../web-debug/scripts/edge.mjs';
import {compareReports} from '../web-debug/scripts/diagnostics.mjs';

test('opaque RGB contrast uses the luminance ratio without rounding the decision',()=>{
  assert.equal(contrastRatio([0,0,0],[255,255,255]),21);
  assert.equal(contrastRatio([128,128,128],[128,128,128]),1);
  assert(contrastRatio([119,119,119],[255,255,255])<4.5);
  assert.throws(()=>contrastRatio([300,0,0],[0,0,0]));
});
test('SEO indexing intent is explicit and cannot inject browser expressions',()=>{
  assert(seoExpression('public').endsWith('("public")'));
  assert.throws(()=>seoExpression('public);alert(1)'));
});
test('before/after comparison refuses different indexing intent',()=>{
  const make=indexing=>({ok:true,context:{url:'https://example.com/',viewport:{width:390,height:844}},steps:[{type:'seoAudit',ok:true,result:{url:'https://example.com/',viewport:{width:390,height:844},indexingIntent:indexing,checks:[]}}],events:[]});
  assert.equal(compareReports(make('public'),make('private')).comparable,false);
});
test('Thai copy analysis uses word segmentation and preserves the original text',()=>{
  const text='เลือกวันที่คุณสะดวก แล้วกดยืนยันการจอง เราจะส่งรายละเอียดให้ทางอีเมล';
  const result=reviewText(text,'th');assert(result.metrics.words>5);assert.equal(text,'เลือกวันที่คุณสะดวก แล้วกดยืนยันการจอง เราจะส่งรายละเอียดให้ทางอีเมล');
  assert.equal(result.language,'th');assert(!Object.hasOwn(result,'humanScore'));assert(!Object.hasOwn(result,'rewrittenText'));
});
test('copy cues identify repetition and claims without judging truth or authorship',()=>{
  const paragraph='Our service guarantees nothing beyond the terms stated here. Please review the delivery dates before ordering.';
  const result=reviewText(`${paragraph}\n\n${paragraph}\n\nGuaranteed results 100%\n\nClick here`,'en');
  assert(result.findings.some(f=>f.code==='repeated-passage'));assert(result.findings.some(f=>f.code==='claim-needs-evidence'));assert(result.findings.some(f=>f.code==='generic-link-or-cta'));
  assert.match(result.note,/No naturalness/);
});
test('copy CLI reads a local file without overwriting it',async()=>{
  const base=path.resolve('work/quality-unit');await fs.mkdir(base,{recursive:true});const root=await fs.mkdtemp(path.join(base,'copy-'));
  const input=path.join(root,'copy.txt'),output=path.join(root,'review.json'),text='ยืนยันรายการก่อนชำระเงิน';await fs.writeFile(input,text);
  await promisify(execFile)(process.execPath,[fileURLToPath(new URL('../web-debug/scripts/copy.mjs',import.meta.url)),'--file',input,'--language','th','--out',output],{windowsHide:true});
  assert.equal(await fs.readFile(input,'utf8'),text);assert.equal(JSON.parse(await fs.readFile(output,'utf8')).language,'th');
});
test('report-only CSP is distinguished from an enforced policy',()=>{
  const result=reviewSecurityHeaders({'Content-Type':'text/html','Content-Security-Policy-Report-Only':"default-src 'self'"},'https://example.com/');
  assert(result.findings.some(f=>f.code==='csp-report-only'));assert.equal(result.policyPresence.cspEnforced,false);
  assert(result.findings.every(f=>f.severity==='review'));
});
test('API responses are not flagged for missing HTML framing policy',()=>{
  const result=reviewSecurityHeaders({'content-type':'application/json','strict-transport-security':'max-age=31536000'},'https://example.com/api');
  assert(!result.findings.some(f=>f.code==='framing-policy-not-observed'));assert(!result.findings.some(f=>f.code==='csp-header-not-observed'));
});
test('public wildcard CORS is distinct from invalid credentialed wildcard configuration',()=>{
  const publicResponse=reviewSecurityHeaders({'access-control-allow-origin':'*'},'http://localhost/');assert(!publicResponse.findings.some(f=>f.code==='cors-wildcard-credentials'));
  const credentialed=reviewSecurityHeaders({'access-control-allow-origin':'*','access-control-allow-credentials':'true'},'http://localhost/');assert(credentialed.findings.some(f=>f.code==='cors-wildcard-credentials'));
});
test('cookie metadata excludes values and does not assume every cookie is a session',()=>{
  const result=reviewSecurityHeaders({'set-cookie':['session_secret=secret-value; HttpOnly; SameSite=None','preferences=value; Secure; SameSite=Lax']},'https://example.com/');
  assert(result.findings.some(f=>f.code==='cookie-none-without-secure'));
  assert.equal(result.cookieAttributes[1].httpOnly,false);assert(!JSON.stringify(result).includes('secret-value'));assert(!JSON.stringify(result).includes('session_secret'));assert(!JSON.stringify(result).includes('preferences'));
});
test('HSTS disabled and malformed max-age values remain review signals',()=>{
  for(const value of ['max-age=0','max-age=100junk','includeSubDomains'])assert(reviewSecurityHeaders({'strict-transport-security':value},'https://example.com/').findings.some(f=>f.code==='hsts-not-active-in-response'));
  assert(!reviewSecurityHeaders({},'http://localhost/').findings.some(f=>f.code==='hsts-not-active-in-response'));
});
test('live HTTP header review is opt-in and does not retain cookie secrets',async()=>{
  const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html','content-security-policy-report-only':"default-src 'self'",'set-cookie':'private-name=private-value; SameSite=None','x-robots-tag':'noindex'});res.end('private response');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try {
    const url=`http://127.0.0.1:${server.address().port}/`;
    assert.equal((await inspectEdge(url)).hops[0].security,undefined);
    const result=await inspectEdge(url,{security:true});assert(result.hops[0].security.findings.some(f=>f.code==='csp-report-only'));
    assert.equal(result.hops[0].headers['x-robots-tag'],'noindex');assert(!JSON.stringify(result).includes('private-value'));assert(!JSON.stringify(result).includes('private-name'));
  }finally{await new Promise(r=>server.close(r));}
});
