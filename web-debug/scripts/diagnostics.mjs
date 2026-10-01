// Local, dependency-free evidence analysis. Rules identify signals, not proven causes.
export function safeURL(value) {
  try {const u=new URL(value);if(['data:','javascript:'].includes(u.protocol))return u.protocol+'[payload omitted]';u.username='';u.password='';if(u.search)u.search='?[redacted]';u.hash='';return u.href.slice(0,2048);}
  catch {return '[unparseable URL]';}
}

export function validateEventMatch(match) {
  if(!match || typeof match!=='object' || Array.isArray(match) || !Object.keys(match).length) throw new Error('Event match needs at least one explicit filter');
  const allowed=['kind','level','urlIncludes','textIncludes','method','status','statusMin','statusMax','canceled'];
  for(const [key,value] of Object.entries(match)) {
    if(!allowed.includes(key)) throw new Error(`Unknown event filter: ${key}`);
    if(['status','statusMin','statusMax'].includes(key)) {if(!Number.isInteger(value)||value<100||value>599)throw new Error(`Invalid ${key}`);}
    else if(key==='canceled') {if(typeof value!=='boolean')throw new Error('canceled must be boolean');}
    else if(typeof value!=='string'||!value.length) throw new Error(`Invalid ${key}`);
  }
  if(match.statusMin!==undefined&&match.statusMax!==undefined&&match.statusMin>match.statusMax) throw new Error('statusMin exceeds statusMax');
  if(match.kind!==undefined&&!['console','exception','log','request','response','network-error','request-finished'].includes(match.kind))throw new Error('Unknown event kind');
}
export function eventMatches(event,match) {
  return Object.entries(match).every(([key,value])=>{
    if(key==='urlIncludes')return typeof event.url==='string'&&event.url.includes(value);
    if(key==='textIncludes')return String(event.text??event.error??'').includes(value);
    if(key==='statusMin')return typeof event.status==='number'&&event.status>=value;
    if(key==='statusMax')return typeof event.status==='number'&&event.status<=value;
    return event[key]===value;
  });
}
export function countEvents(events,match,start=0) {validateEventMatch(match);return events.slice(start).filter(e=>eventMatches(e,match)).length;}

// Serialized and executed in the page. Avoid reading field values or page text.
function pageAudit() {
  const all=document.querySelectorAll('*'),elements=Array.prototype.slice.call(all,0,12000);
  const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
  const identity=e=>e.id?'#'+CSS.escape(e.id):e.tagName.toLowerCase()+(e.getAttribute('data-testid')?'[data-testid='+JSON.stringify(e.getAttribute('data-testid'))+']':'');
  const checks=[];
  const add=(rule,severity,count,evidence)=>checks.push({rule,severity,count,evidence:evidence.slice(0,20),status:count?'finding':'no-finding'});
  add('document-title','warning',document.title.trim()?0:1,['Document has no nonempty title']);
  add('document-language','warning',document.documentElement.lang.trim()?0:1,['Root HTML element has no language declaration']);
  const overflow=Math.max(0,document.documentElement.scrollWidth-innerWidth);
  add('horizontal-overflow','warning',overflow>1?1:0,[{overflowPx:overflow,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}]);
  const overflowCandidates=elements.filter(e=>{if(!visible(e))return false;const r=e.getBoundingClientRect();return r.right>innerWidth+1||r.left< -1;}).slice(0,20).map(identity);
  const images=elements.filter(e=>e instanceof HTMLImageElement&&visible(e));
  const missingAlt=images.filter(e=>!e.hasAttribute('alt')&&e.getAttribute('role')!=='presentation'&&e.getAttribute('role')!=='none'&&e.getAttribute('aria-hidden')!=='true');
  add('image-alt-candidate','review',missingAlt.length,missingAlt.map(identity));
  const broken=images.filter(e=>e.complete&&e.naturalWidth===0&&!!(e.currentSrc||e.getAttribute('src')));
  add('broken-image','warning',broken.length,broken.map(identity));
  const ids=new Map();for(const e of elements)if(e.id)ids.set(e.id,(ids.get(e.id)||0)+1);
  const duplicates=[...ids].filter(([,count])=>count>1).map(([id,count])=>({id,count}));
  add('duplicate-id','warning',duplicates.length,duplicates);
  const positive=elements.filter(e=>visible(e)&&Number(e.getAttribute('tabindex'))>0);
  add('positive-tabindex','review',positive.length,positive.map(identity));
  return {url:location.href,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},checks,overflowCandidates,
    coverage:{scannedElements:elements.length,totalElements:all.length,truncated:all.length>elements.length,mainFrameOnly:true},
    note:'DOM heuristics identify review candidates. No contrast measurement, full accessible-name computation or compliance claim is made.'};
}
export const auditExpression=`(${pageAudit.toString()})()`;
export function addAccessibilityAudit(audit,nodes) {
  const roles=new Set(['button','link','textbox','combobox','checkbox','radio','slider','spinbutton','switch']);
  const unnamed=nodes.filter(n=>!n.ignored&&roles.has(n.role?.value)&&!String(n.name?.value??'').trim());
  audit.checks.push({rule:'unnamed-control','severity':'warning',count:unnamed.length,status:unnamed.length?'finding':'no-finding',evidence:unnamed.slice(0,20).map(n=>({role:n.role.value,backendDOMNodeId:n.backendDOMNodeId}))});
  audit.coverage.accessibilityNodes=nodes.length;
  audit.note='DOM and Chrome accessibility-tree signals require contextual review. They are not a complete accessibility audit or a WCAG compliance result.';
  audit.url=safeURL(audit.url);
  return audit;
}

export function summarizeReport(report) {
  if(!report||typeof report.ok!=='boolean'||!Array.isArray(report.events)||!Array.isArray(report.steps)||!report.steps.length||report.steps.some(s=>!s||typeof s!=='object'||typeof s.ok!=='boolean')||report.events.some(e=>!e||typeof e!=='object'))throw new Error('Malformed browser report: expected a nonempty scenario and event/step objects');
  const events=report.events??[],steps=report.steps??[];
  const counts={exceptions:0,consoleErrors:0,httpErrors:0,networkFailures:0,canceledRequests:0,auditSignals:0,failedSteps:steps.filter(s=>!s.ok).length};
  const groups=new Map();
  function add(code,priority,target,evidence,nextCheck) {
    const key=JSON.stringify([code,target]);
    if(!groups.has(key))groups.set(key,{key,code,priority,target,count:0,evidence:[],nextCheck,conclusion:'signal-needs-investigation'});
    const g=groups.get(key);g.count++;if(g.evidence.length<8)g.evidence.push(evidence);
  }
  for(let index=0;index<events.length;index++) {
    const e=events[index];
    if(e.kind==='exception') {counts.exceptions++;add('runtime-exception',1,String(e.text).split('\n')[0],{event:index,step:e.step,stack:e.stack},'Reproduce at the first application stack frame; verify source maps and inspect the value/state causing the exception.');}
    if(e.kind==='console'&&e.level==='error') {counts.consoleErrors++;add('console-error',2,String(e.text).slice(0,160),{event:index,step:e.step},'Check the emitting source and earlier network/runtime evidence; an error log is not necessarily the root cause.');}
    if(e.kind==='response'&&e.status>=400) {counts.httpErrors++;add(e.status>=500?'http-server-error':'http-client-error',e.status>=500?1:2,safeURL(e.url),{event:index,status:e.status,id:e.id,step:e.step},'Inspect the matching request and server logs; verify route, method, auth and response contract before changing the client.');}
    if(e.kind==='network-error') {
      if(e.canceled) {counts.canceledRequests++;continue;}
      counts.networkFailures++;
      add(e.corsErrorStatus?'cors-failure':'network-failure',1,e.url?safeURL(e.url):e.id,{event:index,error:e.error,blockedReason:e.blockedReason,corsErrorStatus:e.corsErrorStatus,step:e.step},'Check browser blocking details and the responding server/proxy. Keep TLS, CORS and browser security enabled.');
    }
  }
  for(let index=0;index<steps.length;index++) {
    const step=steps[index];
    if(!step.ok)add('scenario-failed',1,step.type,{step:index,error:step.error},'Inspect this failed condition and the evidence immediately before it; distinguish an application defect from a stale selector or incomplete environment.');
    if(['audit','seoAudit','designAudit'].includes(step.type)&&step.ok) for(const check of step.result.checks??[]) if(check.count>0) {
      counts.auditSignals+=check.count;
      const prefix=step.type==='seoAudit'?'seo-':step.type==='designAudit'?'design-':'ui-';
      add(prefix+check.rule,check.severity==='review'?3:2,`${safeURL(step.result.url)} @ ${step.result.viewport.width}x${step.result.viewport.height}`,{step:index,count:check.count,samples:check.evidence},step.type==='seoAudit'?'Verify indexing intent, original response/headers and the relevant search-engine documentation. Metadata observations do not establish ranking or indexing.':'Inspect the screenshot and affected element in its layout/interaction context; confirm this signal is a user-visible or semantic problem before editing.');
    }
  }
  const inconsistent=report.ok===true&&steps.some(s=>!s.ok);
  const incomplete=!!report.droppedEvents||!!report.protocolErrors||inconsistent||steps.some(s=>s.resultTruncated);
  if(steps.some(s=>s.resultTruncated))add('truncated-evaluation-result',2,'evaluation-output',{},'The evaluation ran but its output exceeded the result budget. Select smaller fields or explicitly adjust the budget before claiming complete evidence.');
  if(inconsistent)add('inconsistent-report',1,'scenario-result',{},'The report claims success while a step failed. Reproduce and regenerate trustworthy evidence.');
  const incompleteAudit=steps.some(s=>['audit','seoAudit','designAudit'].includes(s.type)&&s.result?.coverage?.truncated);
  if(incomplete)add('incomplete-capture',1,'event-buffer',{dropped:report.droppedEvents},'Narrow the scenario and capture again. Missing events prevent reliable absence/count assertions.');
  if(incompleteAudit)add('incomplete-ui-audit',2,'audit-sample',{steps:steps.map((s,i)=>s.result?.coverage?.truncated?i:null).filter(i=>i!==null)},'A page audit exceeded its sampling limit. Inspect the affected area directly; do not infer absence of other defects.');
  return {scenarioPassed:report.ok===true&&!inconsistent,captureComplete:!incomplete,auditCoverageComplete:!incompleteAudit,counts,findings:[...groups.values()].sort((a,b)=>a.priority-b.priority||a.key.localeCompare(b.key)),note:'Priorities order investigation. Findings do not prove a root cause, and zero findings do not prove correctness.'};
}

export function summarizeTrace(trace) {
  if(!Array.isArray(trace.traceEvents))throw new Error('Expected Chrome trace JSON with traceEvents');
  const names=new Set(['RunTask','ThreadControllerImpl::RunTask','FunctionCall','EvaluateScript','EventDispatch','Layout','UpdateLayoutTree','Paint','ParseHTML','TimerFire','FireAnimationFrame']);
  const relevant=trace.traceEvents.filter(e=>e.ph==='X'&&names.has(e.name)&&Number.isFinite(e.dur)&&e.dur>=0);
  const mainThreads=new Set(trace.traceEvents.filter(e=>e.ph==='M'&&e.name==='thread_name'&&e.args?.name==='CrRendererMain').map(e=>`${e.pid}:${e.tid}`));
  return {sampleCount:relevant.length,rendererMainThreads:[...mainThreads],topEvents:relevant.sort((a,b)=>b.dur-a.dur).slice(0,20).map(e=>({name:e.name,durationMs:Number((e.dur/1000).toFixed(3)),pid:e.pid,tid:e.tid,rendererMainThread:mainThreads.has(`${e.pid}:${e.tid}`)})),
    note:'Durations are microseconds converted to ms. Nested events overlap; do not sum them as total page time. This is a trace triage aid, not an INP/LCP/CLS score or proof of causation.'};
}

export function compareReports(before,after) {
  const context=r=>r.context?JSON.stringify({url:r.context.url,urlKey:r.context.urlKey??null,viewport:r.context.viewport,scenario:r.scenario??null,auditViewports:(r.steps??[]).filter(s=>['audit','seoAudit','designAudit'].includes(s.type)&&s.ok).map(s=>({type:s.type,viewport:s.result.viewport,indexing:s.result.indexingIntent??null}))}):null;
  const a=summarizeReport(before),b=summarizeReport(after);
  if(before.context?.urlKeyScope!==after.context?.urlKeyScope)return {comparable:false,reason:'URL identity key scopes differ. Reuse the same private state/work context; do not publish its key.'};
  if(!a.captureComplete||!b.captureComplete||!a.auditCoverageComplete||!b.auditCoverageComplete||!context(before)||context(before)!==context(after)) return {comparable:false,reason:'Compare the same named scenario, final URL, viewport and audit coverage with complete event captures. Data/cache/device conditions also need manual verification.'};
  const left=new Map(a.findings.map(f=>[f.key,f])),right=new Map(b.findings.map(f=>[f.key,f]));
  return {comparable:true,absentAfter:[...left].filter(([key])=>!right.has(key)).map(([,f])=>f),newAfter:[...right].filter(([key])=>!left.has(key)).map(([,f])=>f),remaining:[...right].filter(([key])=>left.has(key)).map(([,f])=>f),
    note:'Absent-after means the signal was not observed in this comparable capture, not that the root cause or all regressions are proven fixed. Verify the original user-visible result.'};
}
