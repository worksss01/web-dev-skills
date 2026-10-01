// Passive metadata review only; missing headers are not exploit demonstrations.
export function reviewSecurityHeaders(headers,url) {
  const normalized=Object.fromEntries(Object.entries(headers).map(([key,value])=>[key.toLowerCase(),value]));
  const value=name=>String(normalized[name]??'');
  const target=new URL(url),html=/\btext\/html\b|application\/xhtml\+xml/i.test(value('content-type'));
  const findings=[];const add=(code,detail)=>findings.push({code,severity:'review',detail});
  const enforced=value('content-security-policy'),reportOnly=value('content-security-policy-report-only');
  if(html&&!enforced)add(reportOnly?'csp-report-only':'csp-header-not-observed',reportOnly?'CSP Report-Only does not enforce its policy. Review the enforced policy and browser behavior.':'No enforced CSP response header was observed. Check any meta policy and the application threat model before proposing a tested policy.');
  if(html&&value('x-content-type-options').trim().toLowerCase()!=='nosniff')add('nosniff-not-observed','Review MIME types and the X-Content-Type-Options policy for this response.');
  if(html&&!/\bframe-ancestors\b/i.test(enforced)&&!value('x-frame-options'))add('framing-policy-not-observed','No framing restriction was observed in these headers; check whether this document should be embeddable.');
  if(html&&value('referrer-policy').trim().toLowerCase()==='unsafe-url')add('referrer-policy-broad','This explicit referrer policy can expose path/query details to other origins. Review required behavior.');
  if(value('access-control-allow-origin').trim()==='*'&&value('access-control-allow-credentials').trim().toLowerCase()==='true')add('cors-wildcard-credentials','Browsers do not allow credentialed CORS with a wildcard origin. This is a configuration signal, not proof of data exposure.');
  if(target.protocol==='https:'&&!['localhost','127.0.0.1','[::1]'].includes(target.hostname)) {
    const hsts=value('strict-transport-security');
    const age=hsts.match(/(?:^|;)\s*max-age\s*=\s*(\d+)\s*(?:;|$)/i);
    if(!age||Number(age[1])<=0)add('hsts-not-active-in-response','No positive HSTS max-age was observed. Check site/subdomain HTTPS readiness before changing HSTS; preload is a separate decision.');
  }
  const raw=normalized['set-cookie'];const cookies=(Array.isArray(raw)?raw:raw?[raw]:[]).map((line,index)=>{
    const attributes=String(line).split(';').slice(1).map(p=>p.trim().toLowerCase()),sameSite=attributes.find(p=>p.startsWith('samesite='))?.slice(9)??null;
    const entry={index,secure:attributes.includes('secure'),httpOnly:attributes.includes('httponly'),sameSite};
    if(sameSite==='none'&&!entry.secure)add('cookie-none-without-secure',`Cookie attribute set ${index} declares SameSite=None without Secure; verify browser acceptance.`);
    return entry;
  });
  return {scope:'selected-response-metadata',htmlResponse:html,policyPresence:{cspEnforced:!!enforced,cspReportOnly:!!reportOnly},cookieAttributes:cookies,findings,
    note:'Cookie names/values are omitted. Non-HttpOnly cookies may be intentional; identify session cookies before recommending attributes. This review does not test XSS, authorization, CSRF, injection, dependencies, server configuration or exploitation and is not a security certification.'};
}
