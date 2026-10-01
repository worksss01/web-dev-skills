import path from 'node:path';
import {number,pageURL} from './common.mjs';
import {validateEventMatch} from './diagnostics.mjs';
const fields={navigate:['url'],reload:['ignoreCache'],wait:['ms'],waitFor:['expression','timeoutMs'],waitForSelector:['selector','timeoutMs'],inspect:[],audit:[],seoAudit:['indexing'],designAudit:[],eval:['expression','file'],assert:['expression','message'],click:['selector'],fill:['selector','text','file'],key:['key'],viewport:['width','height','dpr','mobile','touch'],media:['colorScheme','reducedMotion'],screenshot:['path','fullPage'],accessibility:[],metrics:[],traceStart:[],traceStop:['path'],cdp:['method','params'],checkpoint:['name'],waitEvent:['match','since','timeoutMs'],assertEvents:['match','since','minCount','maxCount','message']};
const text=(value,label,empty=false)=>{if(typeof value!=='string'||!empty&&!value.length)throw new Error(`${label} must be a string${empty?'':' with a value'}`);};
export const SAFE_CDP_METHODS=new Set(['DOMSnapshot.captureSnapshot','DOM.getDocument','DOM.describeNode','DOM.querySelector','DOM.querySelectorAll','DOM.getOuterHTML','DOM.getBoxModel','CSS.enable','CSS.getComputedStyleForNode','CSS.getMatchedStylesForNode','Debugger.disable','Page.getLayoutMetrics','Page.getFrameTree','Runtime.getHeapUsage','Network.setCacheDisabled']);
export const RAW_CDP_DOMAINS=new Set('Accessibility Animation Audits CSS DOM DOMDebugger DOMSnapshot Debugger Emulation Fetch IO Input Inspector LayerTree Log Media Memory Network Overlay Page Performance PerformanceTimeline Preload Profiler Runtime Schema Security ServiceWorker Storage Tracing WebAudio WebAuthn'.split(' '));
const READ_ONLY_ACTIONS=new Set(['wait','waitForSelector','inspect','audit','seoAudit','designAudit','screenshot','accessibility','metrics','checkpoint','waitEvent','assertEvents']);
export function planPath(value,kind) {
  text(value,kind);
  const normalized=value.replace(/\\/g,'/');
  if(path.posix.isAbsolute(normalized)||path.win32.isAbsolute(value)||/[\x00-\x1f<>:"|?*]/.test(normalized)||normalized.split('/').some(p=>p==='..'||p==='.')||!normalized.split('/').at(-1))throw new Error('Plan paths must be portable relative paths without traversal or absolute roots');
  if(normalized.split('/').some(p=>/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))throw new Error('Plan paths must not use Windows device names or trailing dots/spaces');
  if(kind==='input'&&!normalized.startsWith('inputs/'))throw new Error('Plan file inputs must be under inputs/ in the work directory');
  if(kind!=='input'&&normalized.toLowerCase().startsWith('inputs/'))throw new Error('Plan outputs must not write into inputs/ (case-insensitive)');
  if(kind==='screenshot'&&!normalized.toLowerCase().endsWith('.png'))throw new Error('Screenshot output must have a .png extension');
  if(kind==='traceStop'&&!normalized.toLowerCase().endsWith('.json'))throw new Error('Trace output must have a .json extension');
  return normalized;
}
export function validateCdpAction(action,{allowRawCdp=false}={}) {
  if(typeof action.method!=='string'||!/^[A-Za-z]+\.[A-Za-z0-9]+$/.test(action.method))throw new Error('Use a page CDP method');
  if(!RAW_CDP_DOMAINS.has(action.method.split('.')[0]))throw new Error('CDP domain is not supported in plans; only selected diagnostic domains are enabled');
  if(action.params!==undefined&&(!action.params||typeof action.params!=='object'||Array.isArray(action.params)))throw new Error('CDP params must be an object');
  if(['Security.setIgnoreCertificateErrors','Security.setOverrideCertificateErrors','Page.setBypassCSP'].includes(action.method))throw new Error('Disabling browser protections is not supported');
  if(['DOM.setFileInputFiles','DOM.getFileInfo','Page.setDownloadBehavior'].includes(action.method))throw new Error('Browser file access/download-path methods are not supported in plans, including raw CDP');
  if(action.method==='Input.dispatchDragEvent') {
    const files=action.params?.data?.files;
    if(files!==undefined&&(!Array.isArray(files)||files.length))throw new Error('Dragging local files is not supported in plans, including raw CDP; use data-only drag events');
  }
  if(!SAFE_CDP_METHODS.has(action.method)&&!allowRawCdp)throw new Error('CDP method requires the explicit CLI flag --allow-raw-cdp');
  if(action.method==='Page.navigate')pageURL(action.params?.url);
  if(action.method==='Network.setCacheDisabled'&&typeof action.params?.cacheDisabled!=='boolean')throw new Error('cacheDisabled must be boolean');
}
export function validatePlan(plan,policy={}) {
  if(!plan||typeof plan!=='object'||Array.isArray(plan)||!Array.isArray(plan.actions)||plan.actions.length<1||plan.actions.length>100)throw new Error('Plan needs 1..100 actions');
  for(const key of Object.keys(plan))if(!['name','actions'].includes(key))throw new Error(`Unknown plan field: ${key}`);
  if(plan.name!==undefined)text(plan.name,'Plan name');
  const checkpoints=new Set();let trace=false;
  for(let index=0;index<plan.actions.length;index++) {
    const a=plan.actions[index];if(!a||typeof a!=='object'||!Object.hasOwn(fields,a.type))throw new Error(`Unknown action at ${index}`);
    for(const key of Object.keys(a))if(key!=='type'&&!fields[a.type].includes(key))throw new Error(`Unknown ${a.type} field: ${key}`);
    if(policy.readOnly&&!READ_ONLY_ACTIONS.has(a.type))throw new Error(`${a.type} is disabled in read-only mode`);
    if(['eval','assert','waitFor'].includes(a.type)&&!(policy.allowScript||policy.allowRawCdp))throw new Error(`${a.type} requires the explicit CLI flag --allow-script`);
    for(const key of ['ignoreCache','mobile','touch','reducedMotion','fullPage'])if(a[key]!==undefined&&typeof a[key]!=='boolean')throw new Error(`${key} must be boolean`);
    for(const key of ['selector','path','file','expression','message','since'])if(a[key]!==undefined)text(a[key],key);
    if(a.file!==undefined)planPath(a.file,'input');
    if(a.path!==undefined)planPath(a.path,a.type);
    if(a.type==='navigate')pageURL(a.url);
    if(['click','fill','waitForSelector'].includes(a.type))text(a.selector,'selector');
    if(['assert','waitFor'].includes(a.type))text(a.expression,'expression');
    if(['eval','fill'].includes(a.type)) {
      const inline=a.type==='eval'?'expression':'text';
      if((a[inline]===undefined)===(a.file===undefined))throw new Error(`${a.type} needs exactly one of ${inline} or file`);
      if(a[inline]!==undefined)text(a[inline],inline,a.type==='fill');
    }
    if(a.type==='wait')number(a.ms,250,0,30000);
    if(a.timeoutMs!==undefined)number(a.timeoutMs,10000,1,30000);
    if(a.type==='viewport'){number(a.width,1280,100,8000);number(a.height,800,100,8000);number(a.dpr,1,0.5,4);}
    if(a.type==='media'&&a.colorScheme!==undefined&&!['light','dark'].includes(a.colorScheme))throw new Error('Invalid colorScheme');
    if(a.type==='seoAudit'&&a.indexing!==undefined&&!['public','private','unknown'].includes(a.indexing))throw new Error('Invalid indexing intent');
    if(a.type==='key'&&!['Enter','Tab','Escape','Backspace','ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Space'].includes(a.key))throw new Error('Unsupported key');
    if(['screenshot','traceStop'].includes(a.type))text(a.path,'path');
    if(a.type==='traceStart'){if(trace)throw new Error('Trace already active in plan');trace=true;}
    if(a.type==='traceStop'){if(!trace)throw new Error('traceStop needs an earlier traceStart');trace=false;}
    if(a.type==='checkpoint'){text(a.name,'checkpoint name');if(checkpoints.has(a.name))throw new Error('Checkpoint names must be unique');checkpoints.add(a.name);}
    if(['waitEvent','assertEvents'].includes(a.type)){validateEventMatch(a.match);if(a.since!==undefined&&!checkpoints.has(a.since))throw new Error('Unknown or future checkpoint');}
    if(a.type==='assertEvents'){const min=number(a.minCount,a.maxCount===undefined?1:0,0,3000),max=number(a.maxCount,3000,0,3000);if(!Number.isInteger(min)||!Number.isInteger(max)||min>max)throw new Error('Invalid event count range');}
    if(a.type==='cdp')validateCdpAction(a,policy);
  }
  if(trace)throw new Error('A traceStart requires a traceStop output path in the same plan');
  return plan;
}
