import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {options as parseOptions,required,writeJSON,printResult,VERSION} from './common.mjs';
import {safeURL} from './diagnostics.mjs';
import {reviewSecurityHeaders} from './security.mjs';

export function targetURL(value) {
  const url=new URL(value);
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('Use an http(s) URL without embedded credentials');
  return url;
}
export function selectHeaders(headers,url) {
  const result={};
  for(const name of ['server','cf-ray','cf-cache-status','age','cache-control','content-type','content-length','etag','last-modified','vary','strict-transport-security','cf-mitigated','x-robots-tag']) {
    if(headers[name]!==undefined)result[name]=String(headers[name]).slice(0,2000);
  }
  if(headers.location){try {result.location=safeURL(new URL(headers.location,url).href);}catch {result.location='[invalid redirect]';}}
  return result;
}
async function resolveDNS(hostname) {
  const host=hostname.replace(/^\[|\]$/g,'');
  if(net.isIP(host))return {inputIsIP:true,addresses:[host]};
  const resolver=new dns.Resolver({timeout:2000,tries:1});
  const outcomes=await Promise.allSettled([resolver.resolve4(host,{ttl:true}),resolver.resolve6(host,{ttl:true}),resolver.resolveCname(host)]);
  const result={};for(const [i,name] of ['A','AAAA','CNAME'].entries())result[name]=outcomes[i].status==='fulfilled'?{records:outcomes[i].value}:{error:outcomes[i].reason.code??'DNS_LOOKUP_FAILED'};
  try {result.systemLookup={addresses:await dns.lookup(host,{all:true}),note:'OS resolver result, which may use hosts files or platform policy; not an authoritative DNS record/TTL query.'};}
  catch(error){result.systemLookup={error:error.code??'OS_LOOKUP_FAILED'};}
  return result;
}
export function probeOnce(value,method='HEAD',security=false) {
  const url=targetURL(value);
  if(!['HEAD','GET'].includes(method))throw new Error('Probe method must be HEAD or GET');
  return new Promise((resolve,reject)=>{
    const start=performance.now();const transport=url.protocol==='https:'?https:http;
    let settled=false;let timer;
    const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(result);};
    const request=transport.request(url,{method,headers:{'User-Agent':`web-debug-edge/${VERSION}`,'Accept':'*/*'},rejectUnauthorized:true},response=>{
      try {
      let tls=null;
      if(url.protocol==='https:') {
        const certificate=response.socket.getPeerCertificate();
        tls={authorized:response.socket.authorized,protocol:response.socket.getProtocol(),validFrom:certificate.valid_from??null,validTo:certificate.valid_to??null,issuer:certificate.issuer?.CN??null,
          daysUntilExpiry:certificate.valid_to?Math.floor((Date.parse(certificate.valid_to)-Date.now())/86400000):null,note:'Certificate observed at this HTTPS endpoint; it does not verify the Cloudflare-to-origin certificate.'};
      }
      const result={url:safeURL(url.href),method,status:response.statusCode,headers:selectHeaders(response.headers,url),elapsedToHeadersMs:Number((performance.now()-start).toFixed(2)),tls,redirect:response.headers.location?new URL(response.headers.location,url).href:null};
      if(security)result.security=reviewSecurityHeaders(response.headers,url.href);
      // Capture only status/allowlisted headers. No body, cookies or credentials.
      response.destroy();finish(null,result);
      } catch(error) {response.destroy();finish(error);}
    });
    timer=setTimeout(()=>request.destroy(new Error('HTTP probe exceeded 10 seconds')),10000);
    request.on('error',error=>finish(error));request.end();
  });
}
export function explainEdge(hops) {
  const findings=[];
  for(let index=0;index<hops.length;index++) {
    const h=hops[index],cloudflareSignal=!!h.headers?.['cf-ray']||/cloudflare/i.test(h.headers?.server??'');
    if(cloudflareSignal) findings.push({code:'cloudflare-response-signal',hop:index,detail:'Response headers suggest Cloudflare handled this request; headers are evidence, not identity proof.'});
    const meanings={520:'Unexpected origin response',521:'Origin web server refused or is unavailable',522:'Cloudflare connection to origin timed out',523:'Origin is unreachable',524:'Origin connection succeeded but response exceeded a timeout',525:'TLS handshake with origin failed',526:'Origin TLS certificate validation failed'};
    if(cloudflareSignal&&meanings[h.status])findings.push({code:`cloudflare-${h.status}`,hop:index,detail:meanings[h.status],nextCheck:'Correlate cf-ray and UTC time with Cloudflare/origin logs; the probe alone does not establish the exact cause.'});
    else if(h.status>=400)findings.push({code:'http-error',hop:index,status:h.status,detail:'Check the responding layer and route. A HEAD response may differ from a browser GET.'});
    if(h.headers?.['cf-cache-status'])findings.push({code:'cache-observation',hop:index,status:h.headers['cf-cache-status'],detail:'Interpret this response with Cache-Control, Age, request method and cache rules. MISS/BYPASS/DYNAMIC are not automatically bugs.'});
    if(h.headers?.['cf-mitigated']==='challenge')findings.push({code:'challenge-response',hop:index,detail:'A challenge response was observed. Reproduce in the authorized browser and review the relevant rule; do not disable protection to hide the symptom.'});
    if(h.tls?.daysUntilExpiry!==null&&h.tls?.daysUntilExpiry!==undefined&&h.tls.daysUntilExpiry<14)findings.push({code:'certificate-expiry-window',hop:index,days:h.tls.daysUntilExpiry,detail:'Check renewal and the endpoint certificate. This is not an origin-certificate measurement.'});
  }
  return findings;
}
export async function inspectEdge(value,{method='HEAD',follow=false,security=false,probe=probeOnce,lookup=resolveDNS}={}) {
  const initial=targetURL(value);if(!['HEAD','GET'].includes(method))throw new Error('Probe method must be HEAD or GET');
  const result={schema:1,observedAt:new Date().toISOString(),target:safeURL(initial.href),dns:await lookup(initial.hostname),hops:[],redirectStop:null,
    note:'Read-only diagnostic requests to the selected URL. No authenticated Cloudflare account access, origin discovery, response bodies or cookies. HEAD may behave differently from GET; timings are local observations.'};
  let next=initial;const visited=new Set();
  for(let index=0;index<6;index++) {
    if(visited.has(next.href)){result.redirectStop='loop';break;}visited.add(next.href);
    const hop=await probe(next.href,method,security);const redirect=hop.redirect;delete hop.redirect;result.hops.push(hop);
    if(!redirect||!([301,302,303,307,308].includes(hop.status)))break;
    if(!follow){result.redirectStop='not-requested';break;}
    const destination=targetURL(redirect);
    if(destination.origin!==initial.origin){result.redirectStop='origin-changed';break;}
    if(index===5){result.redirectStop='limit';break;}
    next=destination;
  }
  result.findings=explainEdge(result.hops);
  if(result.dns.A?.error&&result.dns.AAAA?.error)result.findings.push({code:'dns-record-query-incomplete',detail:'Direct A/AAAA queries failed. Compare the OS resolver result and HTTP outcome; this does not alone establish a DNS outage.'});
  return result;
}
export async function main(argv) {
  const options=parseOptions(argv,['url','method','out'],['follow','security']);
  if(options.help){console.log('edge.mjs --url URL [--method HEAD|GET] [--follow] [--security] [--out FILE]\nProbes DNS and HTTP/TLS metadata only. --security adds passive header/cookie-attribute review without cookie names/values. --follow stays on the initial origin, up to 6 requests.');return;}
  const result=await inspectEdge(required(options,'url'),{method:options.method??'HEAD',follow:options.follow===true,security:options.security===true});
  if(options.out)await writeJSON(required(options,'out'),result);printResult(result,options);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(JSON.stringify({ok:false,error:error.code??error.message}));process.exitCode=1;});
