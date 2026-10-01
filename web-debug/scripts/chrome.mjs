import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {createHash,createHmac,randomBytes} from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { args,options as parseOptions,required,number,readJSON,readText,writeJSON,writeFile,atomicOutput,exists,delay,assertNode,loopbackURL,pageURL,fetchJSON,CDP,assertDistinctPaths,containedPath,acquireLock,printResult } from './common.mjs';
import {safeURL,auditExpression,addAccessibilityAudit,countEvents,validateEventMatch,summarizeReport} from './diagnostics.mjs';
import {seoExpression,designExpression} from './quality.mjs';
import {validatePlan,planPath} from './plan.mjs';
import {prepareState,createProfile,purgeProfile,closeChild} from './browser-state.mjs';
import {pipeCDP} from './pipe.mjs';

const BACKGROUND_FLAGS=['--disable-background-networking','--disable-component-update','--disable-sync'];

const help = `Direct Chrome DevTools Protocol CLI (Node 22.4+, no npm dependencies)
  check --url URL [--plan FILE] [--out JSON] [--read-only] (private pipe; closes itself)
  launch --state-dir PATH --allow-tcp-debugging [--chrome EXE] [--headless]
  status|tabs --state-dir PATH     (or --endpoint http://127.0.0.1:PORT)
  new --state-dir PATH --url URL
  run --state-dir PATH --tab ID --plan FILE [--out JSON] [--overwrite]
  stop --state-dir PATH [--purge-profile] (only this helper's owned browser)
Plan file inputs belong under inputs/. Outputs are relative .png/.json paths.
Advanced: --allow-script, --allow-raw-cdp, --allow-external-browser, --allow-external-actions.
Raw CDP grants privileged browser/session access beyond the plan file-path guards; it is not a sandbox.
Raw mode is limited to selected diagnostic domains. File drag, Browser/Target/Extensions/PWA
and listed direct-file/protection-bypass operations remain blocked.
See references/chrome.md for plan actions and limitations.`;

async function chromePath(explicit) {
  if (explicit) { if (!await exists(explicit)) throw new Error('Chrome executable does not exist'); return path.resolve(explicit); }
  const candidates = process.platform === 'win32' ? [
    path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe')
  ] : process.platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'] : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  for (const candidate of candidates) if (await exists(candidate)) return candidate;
  throw new Error('Chrome not found. Supply --chrome with the installed executable path. Nothing is downloaded.');
}

async function launch(options) {
  if(!options['allow-tcp-debugging'])throw new Error('Persistent launch exposes a local CDP port. Use check (pipe) or explicitly pass --allow-tcp-debugging');
  const dir = path.resolve(required(options, 'state-dir'));
  await prepareState(dir);
  // Every launch owns a fresh directory; never point Chrome at a personal profile.
  const lock = await fs.open(path.join(dir, 'launch.lock'), 'wx',0o600).catch(() => { throw new Error('Launch lock exists; inspect the previous launch before removing this lock'); });
  let child;
  try {
    if (await exists(path.join(dir, 'session.json'))) {
      const old = await readJSON(path.join(dir, 'session.json'));
      if(old.owner!=='web-debug')throw new Error('Existing session metadata is not owned by this helper');
      let active=false;try{const endpoint=loopbackURL(old.endpoint).origin;const current=await fetchJSON(endpoint+'/json/version');active=new URL(current.webSocketDebuggerUrl).pathname===old.browserPath;}catch{}
      if(active)throw new Error('Recorded browser identity is still active; reuse it or stop it first');
      await writeJSON(path.join(dir,'session.previous.json'),old);
    }
    const executable = await chromePath(options.chrome);
    const profile = await createProfile(dir);
    const launchArgs = ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',...BACKGROUND_FLAGS];
    if (options.headless) launchArgs.push('--headless=new');
    launchArgs.push('about:blank');
    child = spawn(executable, launchArgs, { detached: true, stdio: 'ignore', windowsHide: true });
    let spawnError;
    child.on('error', error => { spawnError = error; });
    child.unref();
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (spawnError) throw spawnError;
      if (child.exitCode !== null) throw new Error(`Chrome exited with ${child.exitCode}`);
      try {
        const [port, wsPath] = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/);
        if (!/^\d+$/.test(port) || !wsPath.startsWith('/devtools/browser/')) throw new Error('Invalid DevToolsActivePort');
        const endpoint = `http://127.0.0.1:${port}`;
        const version = await fetchJSON(`${endpoint}/json/version`);
        if (new URL(version.webSocketDebuggerUrl).pathname !== wsPath) throw new Error('Browser endpoint identity mismatch');
        const state = { owner: 'web-debug', schema: 1, pid: child.pid, executable, profile, endpoint, browserPath: wsPath, startedAt: new Date().toISOString() };
        await writeJSON(path.join(dir, 'session.json'), state);
        return { ...state, browser: version.Browser, node: process.version };
      } catch (error) { if (Date.now() + 150 >= deadline) throw error; }
      await delay(150);
    }
    throw new Error('Chrome launch timed out');
  } catch (error) {
    // This is the child just created above, never a name-based process kill.
    if (child?.pid) { try { child.kill(); } catch {} }
    throw error;
  } finally { await lock.close(); await fs.unlink(path.join(dir, 'launch.lock')); }
}

async function connection(options) {
  if (options.endpoint && options['state-dir']) throw new Error('Use --endpoint or --state-dir, not both');
  const state = options.endpoint ? null : await readJSON(path.join(path.resolve(required(options, 'state-dir')), 'session.json'));
  const u = loopbackURL(options.endpoint || state.endpoint);
  if(options.endpoint&&!options['allow-external-browser'])throw new Error('External browser access requires --allow-external-browser and an authorized target');
  if (u.pathname !== '/' || u.search || u.hash) throw new Error('Endpoint must be an origin, without a path/query');
  const endpoint = u.origin;
  const version = await fetchJSON(`${endpoint}/json/version`);
  loopbackURL(version.webSocketDebuggerUrl, ['ws:']);
  if (new URL(version.webSocketDebuggerUrl).port !== u.port) throw new Error('Unexpected browser WebSocket port');
  if (state && (state.owner !== 'web-debug' || new URL(version.webSocketDebuggerUrl).pathname !== state.browserPath)) throw new Error('Stale session or wrong browser; run launch with a fresh state directory');
  return { endpoint, version, state };
}

async function evaluate(cdp, expression,timeout=10000) {
  const reply = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true,timeout },timeout+250);
  if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description || reply.exceptionDetails.text || 'Page evaluation failed');
  return reply.result.value ?? reply.result.unserializableValue ?? null;
}
async function observe(cdp,expression,timeout=10000) {
  const deadline=Date.now()+timeout,remaining=()=>Math.max(1,deadline-Date.now());
  const tree=await cdp.send('Page.getFrameTree',{},remaining());
  const world=await cdp.send('Page.createIsolatedWorld',{frameId:tree.frameTree.frame.id,worldName:'web-debug-observation'},remaining());
  const reply=await cdp.send('Runtime.evaluate',{expression,contextId:world.executionContextId,awaitPromise:true,returnByValue:true,timeout:remaining()},remaining()+50);
  if(reply.exceptionDetails)throw new Error(reply.exceptionDetails.exception?.description||reply.exceptionDetails.text);
  return reply.result.value??reply.result.unserializableValue??null;
}

const inspectExpression = `(() => {
 const nodes = [...document.querySelectorAll('body *')];
 const brief = e => ({tag:e.tagName.toLowerCase(),id:e.id,role:e.getAttribute('role'),name:e.getAttribute('aria-label'),text:(e.innerText||e.textContent||'').trim().slice(0,120)});
 return {url:location.href,title:document.title,readyState:document.readyState,
 viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,scrollWidth:document.documentElement.scrollWidth},
 headings:[...document.querySelectorAll('h1,h2,h3')].slice(0,50).map(brief),
 controls:[...document.querySelectorAll('button,a,input,select,textarea,[role="button"]')].slice(0,100).map(brief),
 overflow:nodes.filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1)}).slice(0,30).map(brief),
 navigation:performance.getEntriesByType('navigation').map(e=>e.toJSON()),
 resourceCount:performance.getEntriesByType('resource').length};
})()`;

const redactURL=safeURL;
function redactObservation(value) {
  if(!value||typeof value!=='object')return value;
  for(const [key,item] of Object.entries(value)){if(['url','href','src'].includes(key)&&typeof item==='string')value[key]=redactURL(item);else if(item&&typeof item==='object')redactObservation(item);}
  return value;
}
function recorder(cdp) {
  const events = []; const requests=new Map(); let dropped = 0;let step=-1;let bytes=0;
  const stack=frames=>(frames??[]).slice(0,6).map(f=>({functionName:f.functionName,url:redactURL(f.url),line:(f.lineNumber??0)+1,column:(f.columnNumber??0)+1}));
  const off = cdp.on(({ method, params: p }) => {
    let item;
    if (method === 'Runtime.consoleAPICalled') {if(!Array.isArray(p.args))throw new Error('Malformed console event');if(p.args.length>20)dropped++;const text=p.args.slice(0,20).map(x=>{const value=String(x.value??x.description??x.type);if(value.length>2000)dropped++;return value.slice(0,2000);}).join(' ');if(text.length>8000)dropped++;item = {kind:'console',level:p.type,text:text.slice(0,8000),stack:stack(p.stackTrace?.callFrames)};}
    if (method === 'Runtime.exceptionThrown') item = { kind: 'exception', text: (p.exceptionDetails.exception?.description || p.exceptionDetails.text).slice(0,6000),stack:stack(p.exceptionDetails.stackTrace?.callFrames) };
    if (method === 'Log.entryAdded') item = { kind: 'log', level: p.entry.level, text: p.entry.text.slice(0,4000), url: redactURL(p.entry.url || '') };
    if (method === 'Network.requestWillBeSent') {
      item = { kind: 'request', id: p.requestId, method: p.request.method, url: redactURL(p.request.url), resourceType: p.type };
      if(requests.size>=3000)requests.delete(requests.keys().next().value);
      requests.set(p.requestId,{url:item.url,started:p.timestamp});
    }
    if (method === 'Network.responseReceived') item = { kind: 'response', id: p.requestId, url: redactURL(p.response.url), status: p.response.status, mimeType: p.response.mimeType, fromDiskCache: p.response.fromDiskCache, fromServiceWorker: p.response.fromServiceWorker };
    if (method === 'Network.loadingFailed') {item = { kind: 'network-error', id: p.requestId, url:requests.get(p.requestId)?.url, error: p.errorText, canceled: p.canceled===true, blockedReason: p.blockedReason, corsErrorStatus: p.corsErrorStatus };requests.delete(p.requestId);}
    if (method === 'Network.loadingFinished') {
      const request=requests.get(p.requestId);requests.delete(p.requestId);
      item={kind:'request-finished',id:p.requestId,url:request?.url,encodedBytes:p.encodedDataLength,...(request?{durationMs:Number(((p.timestamp-request.started)*1000).toFixed(3))}:{})};
    }
    if (item) {const size=Buffer.byteLength(JSON.stringify(item));if(events.length<3000&&bytes+size<=4000000){bytes+=size;events.push({at:new Date().toISOString(),step,...item});}else dropped++;}
  });
  return { events, get dropped() { return dropped+cdp.protocolErrors; },setStep(value){step=value;},off };
}

async function elementPoint(cdp, selector, editable = false) {
  if (typeof selector !== 'string' || !selector) throw new Error('action.selector is required');
  return observe(cdp, `(() => {
    const matches=document.querySelectorAll(${JSON.stringify(selector)});
    if(matches.length!==1) throw Error('Selector must identify exactly one element; found '+matches.length);
    const e=matches[0]; if(e.matches(':disabled') || e.getAttribute('aria-disabled')==='true'||e.closest('[inert]')) throw Error('Element is disabled or inert');
    if(${editable} && !(e instanceof HTMLInputElement || e instanceof HTMLTextAreaElement || e.isContentEditable)) throw Error('Element is not text-editable');
    if(${editable} && (e.readOnly || e instanceof HTMLInputElement&&!['text','search','tel','url','email','password','number'].includes(e.type))) throw Error('Element is not a supported text input');
    for(let a=e;a;a=a.parentElement){const style=getComputedStyle(a);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)throw Error('Element is not visible');}
    e.scrollIntoView({block:'center',inline:'center',behavior:'instant'});
    const r=e.getBoundingClientRect(), s=getComputedStyle(e);
    const cx=(Math.max(0,r.left)+Math.min(r.right,innerWidth))/2, cy=(Math.max(0,r.top)+Math.min(r.bottom,innerHeight))/2;
    if(r.width<=0||r.height<=0||s.visibility==='hidden'||s.display==='none'||Number(s.opacity)===0||cx<0||cy<0||cx>=innerWidth||cy>=innerHeight) throw Error('Element is not visible');
    const hit=document.elementFromPoint(cx,cy); if(!hit || !(hit===e||e.contains(hit))) throw Error('Element is covered at its center');
    return {x:cx,y:cy};
  })()`);
}
async function click(cdp, selector, editable = false) {
  const point = await elementPoint(cdp, selector, editable);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
}
async function key(cdp, value) {
  const keys = { Enter: [13,'Enter'], Tab: [9,'Tab'], Escape: [27,'Escape'], Backspace: [8,'Backspace'], ArrowDown: [40,'ArrowDown'], ArrowUp: [38,'ArrowUp'], ArrowLeft: [37,'ArrowLeft'], ArrowRight: [39,'ArrowRight'], Space: [32,'Space'] };
  if (!keys[value]) throw new Error(`Unsupported key: ${value}`);
  const [code, physical] = keys[value];
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: value === 'Space' ? ' ' : value, code: physical, windowsVirtualKeyCode: code, ...(value === 'Enter' ? { text: '\r' } : value === 'Space' ? { text: ' ' } : {}) });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: value === 'Space' ? ' ' : value, code: physical, windowsVirtualKeyCode: code });
}
async function resolveArtifact(base, relative,kind='output') {
  const portable=planPath(relative,kind);
  if(kind==='input') {
    const inputs=await containedPath(base,'inputs');
    if((await fs.lstat(inputs)).isSymbolicLink())throw new Error('The inputs directory must not be a link');
    const file=await containedPath(inputs,portable.slice('inputs/'.length));
    const info=await fs.lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.nlink>1)throw new Error('Plan input must be a regular unlinked file');
    return file;
  }
  const output=await containedPath(base,portable);
  let component=path.resolve(base);
  for(const part of portable.split('/')) {
    component=path.join(component,part);
    try {if((await fs.lstat(component)).isSymbolicLink())throw new Error('Plan output components must not be links, including aliases into inputs/');}
    catch(error){if(error.code==='ENOENT')break;throw error;}
  }
  return output;
}
async function waitFor(cdp, expression, timeout = 10000,reader=evaluate) {
  const deadline = Date.now() + number(timeout,10000,1,30000);
  let lastError;
  do {
    try { if (await reader(cdp, expression,Math.max(1,deadline-Date.now()))) return { matched: true }; } catch(error) { lastError = error.message; }
    if(Date.now()<deadline)await delay(Math.min(100,deadline-Date.now()));
  } while (Date.now() < deadline);
  throw new Error(`waitFor timed out${lastError ? ': ' + lastError : ''}`);
}
async function saveTrace(cdp,output,policy={}) {
  let stream;const off=cdp.on(m=>{if(m.method==='Tracing.tracingComplete')stream=m.params.stream;});
  try {
    await cdp.send('Tracing.end');const deadline=Date.now()+15000;
    while(!stream&&Date.now()<deadline)await delay(50);
    if(!stream)throw new Error('Trace completion timeout');
    await atomicOutput(output,async temporary=>{
      const file=await fs.open(temporary,'wx',0o600);let total=0;
      try {for(;;){const chunk=await cdp.send('IO.read',{handle:stream,size:65536});const buffer=Buffer.from(chunk.data,chunk.base64Encoded?'base64':'utf8');total+=buffer.length;if(total>100000000)throw new Error('Trace exceeds 100 MB');await file.write(buffer);if(chunk.eof)break;}}
      finally{await file.close();}
    },{overwrite:policy.overwrite===true});
    return {path:output};
  }finally{off();if(stream)try{await cdp.send('IO.close',{handle:stream},2000);}catch{}}
}

export async function runPlan(cdp, plan, base,policy={}) {
  validatePlan(plan,policy);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Log.enable'); await cdp.send('Network.enable');
  // Begin after domain setup, excluding console backlog replayed by Runtime.enable.
  const rec = recorder(cdp); const steps = []; const marks=new Map();let trace = false;let tracePath=null;let context=null;let metricsChanged=false,touchChanged=false,mediaChanged=false;
  const eventStart=action=>{
    if(action.since===undefined)return 0;
    if(!marks.has(action.since))throw new Error(`Unknown event checkpoint: ${action.since}`);
    return marks.get(action.since);
  };
  try {
    let startupOK=true;
    if(policy.initialURL) {
      rec.setStep(0);
      try {const navigation=await cdp.send('Page.navigate',{url:pageURL(policy.initialURL)});if(navigation.errorText)throw new Error(navigation.errorText);const deadline=Date.now()+10000;let ready=false;while(Date.now()<deadline){try{const frame=(await cdp.send('Page.getFrameTree',{},1000)).frameTree.frame;if((!navigation.loaderId||frame.loaderId===navigation.loaderId)&&await observe(cdp,"document.readyState !== 'loading'",1000)){ready=true;break;}}catch{}await delay(50);}if(!ready)throw new Error('Initial document readiness timed out');steps.push({type:'navigate',source:'cli-url',ok:true,result:{url:redactURL(policy.initialURL)}});}
      catch(error){startupOK=false;steps.push({type:'navigate',source:'cli-url',ok:false,error:error.message});}
    }
    for (const [actionIndex,action] of plan.actions.entries()) {
      if(!startupOK)break;
      let result,resultTruncated=false;
      rec.setStep(steps.length);
      try {
        switch (action.type) {
          case 'navigate': {
            result = await cdp.send('Page.navigate', { url: pageURL(action.url) });
            if (result.errorText) throw new Error(result.errorText);
            break;
          }
          case 'reload': result = await cdp.send('Page.reload', { ignoreCache: action.ignoreCache === true }); break;
          case 'wait': await delay(number(action.ms,250,0,30000)); result = { waitedMs: action.ms ?? 250 }; break;
          case 'waitFor': result = await waitFor(cdp, action.expression, action.timeoutMs); break;
          case 'waitForSelector': result=await waitFor(cdp,`document.querySelector(${JSON.stringify(action.selector)}) !== null`,action.timeoutMs,observe);break;
          case 'inspect': result = await observe(cdp, inspectExpression);result.url=redactURL(result.url);for(const timing of result.navigation??[])if(timing.name)timing.name=redactURL(timing.name);break;
          case 'audit': {
            const audit=await observe(cdp,auditExpression);
            const ax=await cdp.send('Accessibility.getFullAXTree');
            result=addAccessibilityAudit(audit,ax.nodes);break;
          }
          case 'seoAudit': {
            result=await observe(cdp,seoExpression(action.indexing??'unknown'));
            result.url=redactURL(result.url);
            for(const item of [...result.canonicals,...result.alternateLanguages])item.url=redactURL(item.url);
            break;
          }
          case 'designAudit': result=await observe(cdp,designExpression);result.url=redactURL(result.url);break;
          case 'checkpoint': {
            if(typeof action.name!=='string'||!action.name||marks.has(action.name))throw new Error('Checkpoint needs a unique name');
            marks.set(action.name,rec.events.length);result={name:action.name,eventIndex:rec.events.length};break;
          }
          case 'waitEvent': {
            validateEventMatch(action.match);const start=eventStart(action);
            const deadline=Date.now()+number(action.timeoutMs,10000,1,30000);
            while(!countEvents(rec.events,action.match,start)&&Date.now()<deadline){if(rec.dropped)throw new Error('Event capture incomplete; narrow the scenario');await delay(50);}
            if(rec.dropped)throw new Error('Event capture incomplete; narrow the scenario');
            const count=countEvents(rec.events,action.match,start);if(!count)throw new Error('waitEvent timed out');
            result={matched:count};break;
          }
          case 'assertEvents': {
            if(rec.dropped)throw new Error('Event capture incomplete; counts/absence cannot be verified');
            const min=number(action.minCount,action.maxCount===undefined?1:0,0,3000);
            const max=number(action.maxCount,3000,0,3000);
            if(!Number.isInteger(min)||!Number.isInteger(max)||min>max)throw new Error('Invalid event count range');
            const count=countEvents(rec.events,action.match,eventStart(action));
            if(count<min||count>max)throw new Error(action.message||`Event count ${count} outside expected ${min}..${max}`);
            result={passed:true,count};break;
          }
          case 'eval': {
            const expression = action.file ? await readText(await resolveArtifact(base,action.file,'input')) : action.expression;
            if (typeof expression !== 'string') throw new Error('eval needs expression or file');
            result = await evaluate(cdp, expression); break;
          }
          case 'assert': {
            if (typeof action.expression !== 'string' || await evaluate(cdp, action.expression) !== true) throw new Error(action.message || 'Assertion did not return true');
            result = { passed: true }; break;
          }
          case 'click': await click(cdp,action.selector); result = { clicked: action.selector }; break;
          case 'fill': {
            const text = action.file ? await readText(await resolveArtifact(base,action.file,'input'),1000000) : action.text;
            if (typeof text !== 'string') throw new Error('fill needs text or file');
            await click(cdp,action.selector,true);
            const focusCheck=`(() => {const e=document.querySelector(${JSON.stringify(action.selector)});if(document.activeElement!==e&&!(e?.isContentEditable&&e.contains(document.activeElement)))throw Error('Focus moved away from the requested field');return true;})()`;
            await observe(cdp,focusCheck);
            const modifiers = process.platform === 'darwin' ? 4 : 2;
            await cdp.send('Input.dispatchKeyEvent', { type:'keyDown', key:'a', code:'KeyA', windowsVirtualKeyCode:65, modifiers });
            await cdp.send('Input.dispatchKeyEvent', { type:'keyUp', key:'a', code:'KeyA', windowsVirtualKeyCode:65, modifiers });
            await observe(cdp,focusCheck);
            await cdp.send('Input.insertText', { text });
            result = { filled: action.selector }; break;
          }
          case 'key': await key(cdp,action.key); result = { key: action.key }; break;
          case 'viewport': {
            await cdp.send('Emulation.setDeviceMetricsOverride', { width: Math.round(number(action.width,1280,100,8000)), height: Math.round(number(action.height,800,100,8000)), deviceScaleFactor: number(action.dpr,1,0.5,4), mobile: action.mobile === true });
            metricsChanged=true;
            await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: action.touch === true });
            touchChanged=true;
            result = { applied: true }; break;
          }
          case 'media': {
            const features = [];
            if (action.colorScheme) { if (!['light','dark'].includes(action.colorScheme)) throw new Error('Invalid colorScheme'); features.push({name:'prefers-color-scheme',value:action.colorScheme}); }
            if (action.reducedMotion !== undefined) features.push({name:'prefers-reduced-motion',value:action.reducedMotion ? 'reduce':'no-preference'});
            result = await cdp.send('Emulation.setEmulatedMedia', { features });mediaChanged=true;break;
          }
          case 'screenshot': {
            const output = await resolveArtifact(base,action.path,'screenshot');
            const params = { format:'png', captureBeyondViewport: action.fullPage === true };
            if (action.fullPage) {
              const { cssContentSize: size } = await cdp.send('Page.getLayoutMetrics');
              if (size.width * size.height > 40000000) throw new Error('Full page too large; capture viewport or smaller sections');
              params.clip = { x:0,y:0,width:size.width,height:size.height,scale:1 };
            }
            const shot = await cdp.send('Page.captureScreenshot',params);
            await writeFile(output,Buffer.from(shot.data,'base64'),{overwrite:policy.overwrite===true}); result = { path:output }; break;
          }
          case 'accessibility': result = await cdp.send('Accessibility.getFullAXTree'); break;
          case 'metrics': await cdp.send('Performance.enable'); result = await cdp.send('Performance.getMetrics'); break;
          case 'traceStart': {
            if (trace) throw new Error('Trace already started');
            await cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing,loading',transferMode:'ReturnAsStream'});trace=true;tracePath=plan.actions.slice(actionIndex+1).find(a=>a.type==='traceStop').path;result={started:true};break;
          }
          case 'traceStop': {
            if (!trace) throw new Error('No trace started');
            trace=false;result=await saveTrace(cdp,await resolveArtifact(base,action.path,'traceStop'),policy);
            break;
          }
          case 'cdp': {
            if (typeof action.method !== 'string' || action.method.startsWith('Browser.')) throw new Error('Use a page CDP method; Browser.* is managed by the CLI');
            result = await cdp.send(action.method,action.params || {}); break;
          }
          default: throw new Error(`Unknown action: ${action.type}`);
        }
        if(['inspect','audit','seoAudit','designAudit'].includes(action.type))redactObservation(result);
        if(action.type==='eval') {const bytes=Buffer.byteLength(JSON.stringify(result)??'');if(bytes>(policy.maxResultBytes??1000000)){result={omitted:true,bytes,reason:'Evaluation result exceeded the configured result budget; select smaller fields or explicitly raise the CLI budget'};resultTruncated=true;}}
        steps.push({type:action.type,ok:true,result,...(resultTruncated?{resultTruncated:true}:{})});
      } catch(error) { steps.push({type:action.type,ok:false,error:error.message}); break; }
    }
  } finally {
    try {context=await observe(cdp,'({url:location.href,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}})');const key=policy.contextKey??randomBytes(32).toString('hex');context.urlKey=createHmac('sha256',key).update(context.url).digest('hex');context.urlKeyScope=createHash('sha256').update(key).digest('hex').slice(0,16);context.url=redactURL(context.url);}catch{}
    if(trace) {try{steps.push({type:'traceStop',ok:true,recoveredAfterFailure:true,result:await saveTrace(cdp,await resolveArtifact(base,tracePath,'traceStop'),policy)});}catch(error){steps.push({type:'traceStop',ok:false,error:error.message});}}
    // Emulation belongs to this scenario, not a later caller's session.
    for(const [changed,method,params] of [[metricsChanged,'Emulation.clearDeviceMetricsOverride',{}],[touchChanged,'Emulation.setTouchEmulationEnabled',{enabled:false}],[mediaChanged,'Emulation.setEmulatedMedia',{features:[]}]])if(changed){try{await cdp.send(method,params,2000);}catch{}}
    rec.off();
  }
  const report={schema:2,scenario:typeof plan.name==='string'?plan.name:null,context,ok:steps.every(s=>s.ok),steps,events:rec.events,droppedEvents:rec.dropped,protocolErrors:cdp.protocolErrors,note:'Events cover the scenario after domain setup only. Step numbers indicate collection time, not causation. Network headers/bodies are not collected; console, DOM, screenshots and traces can still contain sensitive data.'};
  report.securityPolicy={readOnly:policy.readOnly===true,scriptEnabled:!policy.readOnly&&(policy.allowScript===true||policy.allowRawCdp===true),rawCdpEnabled:!policy.readOnly&&policy.allowRawCdp===true,planPathGuards:'helper file/path fields only; not a browser or OS sandbox',overwrite:policy.overwrite===true,cdpMethods:plan.actions.filter(a=>a.type==='cdp').map(a=>a.method)};
  report.summary=summarizeReport(report);report.summary.securityPolicy=report.securityPolicy;return report;
}

async function checkWithPipe(options,plan,base,policy) {
  const {root,contextKey}=await prepareState(options['state-dir']);
  const executable=await chromePath(options.chrome),profile=await createProfile(root);
  const flags=['--remote-debugging-pipe',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check',...BACKGROUND_FLAGS];
  if(!options.headed)flags.push('--headless=new');flags.push('about:blank');
  const child=spawn(executable,flags,{stdio:['ignore','ignore','ignore','pipe','pipe'],windowsHide:true});
  child.on('error',()=>{});
  let browser,output,failure;
  try {
    browser=pipeCDP(child,policy.maxMessageBytes);
    const version=await browser.send('Browser.getVersion');
    const {targetId}=await browser.send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await browser.send('Target.attachToTarget',{targetId,flatten:true});
    const page=browser.session(sessionId);
    output={browser:version.product,targetId,transport:'pipe',observedAt:new Date().toISOString(),...await runPlan(page,plan,base,{...policy,contextKey})};
  }catch(error){failure=error;}
  finally {
    await closeChild(child,browser);browser?.close();
    if(!options['keep-profile']){try{await purgeProfile(root,profile);if(output)output.profilePurged=true;}catch(error){if(output){output.profilePurged=false;output.cleanupError=error.message;output.ok=false;}else if(!failure)failure=error;}}
    else if(output)output.profileRetained=profile;
  }
  if(failure)throw failure;
  return output;
}

export async function main(argv) {
  assertNode();const command=args(argv)._[0];
  const runValues=['state-dir','plan','work-dir','out','max-message-mb','max-result-kb'];
  const runFlags=['overwrite','read-only','allow-raw-cdp','allow-script'];
  const routes={check:[[...runValues,'url','chrome'],[...runFlags,'headed','headless','keep-profile']],launch:[['state-dir','chrome','out'],['headless','allow-tcp-debugging']],status:[['state-dir','endpoint','out'],['allow-external-browser']],tabs:[['state-dir','endpoint','out'],['allow-external-browser']],new:[['state-dir','endpoint','url','out'],['allow-external-browser','allow-external-actions']],stop:[['state-dir','endpoint','out'],['allow-external-browser','purge-profile']],run:[[...runValues,'endpoint','tab'],[...runFlags,'allow-external-browser','allow-external-actions']],help:[[],[]]};
  if(command&&!Object.hasOwn(routes,command))throw new Error(`Unknown command: ${command}`);
  const [values,flags]=routes[command??'help'];const options=parseOptions(argv,values,flags,1);
  if (!command || command === 'help' || options.help) { console.log(help); return; }
  if(command==='check'&&!options['state-dir'])options['state-dir']='work/web-debug/chrome';
  if(options.headed&&options.headless)throw new Error('Choose headed or headless');
  if(options.endpoint){loopbackURL(options.endpoint);if(!options['allow-external-browser'])throw new Error('External browser access requires --allow-external-browser');if(command==='new'&&!options['allow-external-actions'])throw new Error('Creating an external tab requires --allow-external-actions');}
  const quick=command==='check'&&!options.plan;
  if(quick)required(options,'url');
  const policy={readOnly:options['read-only']===true||!!options.endpoint&&!options['allow-external-actions'],allowScript:options['allow-script']===true,allowRawCdp:options['allow-raw-cdp']===true,overwrite:options.overwrite===true,maxMessageBytes:Math.round(number(options['max-message-mb'],32,1,256)*1000000),maxResultBytes:Math.round(number(options['max-result-kb'],1000,1,256000)*1000)};
  if(quick)policy.readOnly=true;
  if(policy.readOnly&&(policy.allowScript||policy.allowRawCdp))throw new Error('read-only mode cannot enable custom script or raw CDP; external actions require their own explicit opt-in');
  if(command==='check'&&options.url)policy.initialURL=pageURL(options.url);
  let output,plan,planFile,base,release;
  const inputs=options['state-dir']?[path.resolve(options['state-dir'],'session.json'),path.resolve(options['state-dir'],'operation.lock')]:[];
  const outputs=[options.out];
  if(['run','check'].includes(command)) {
    if(command==='run')required(options,'tab');
    if(quick){plan={name:'quick-observation',actions:[{type:'inspect'},{type:'audit'}]};base=path.resolve(options['work-dir']??'work/web-debug');}
    else{planFile=path.resolve(required(options,'plan'));plan=validatePlan(await readJSON(planFile,1000000),policy);inputs.push(planFile);base=path.resolve(options['work-dir']??path.dirname(planFile));await fs.mkdir(base,{recursive:true,mode:0o700});}
    for(const action of plan.actions){if(action.file)inputs.push(await resolveArtifact(base,action.file,'input'));if(action.path)outputs.push(await resolveArtifact(base,action.path,action.type));}
    for(const file of outputs.filter(Boolean))if(await exists(file)&&!policy.overwrite)throw new Error('Output already exists; use --overwrite deliberately');
  }
  if(options['state-dir'])for(const file of outputs.filter(Boolean)){const rel=path.relative(path.resolve(options['state-dir']),path.resolve(file));if(rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel)))throw new Error('Evidence output must be outside the dedicated browser state directory');}
  await assertDistinctPaths(inputs,outputs);
  if(command==='run'&&options.endpoint){const context=await prepareState(path.join(base,'.web-debug-context'));policy.contextKey=context.contextKey;}
  if(options['state-dir']&&['launch','new','run','stop','check'].includes(command)){const stateInfo=await prepareState(options['state-dir']);policy.contextKey=stateInfo.contextKey;release=await acquireLock(await containedPath(options['state-dir'],'operation.lock'));}
  try {
  if(command==='check')output=await checkWithPipe(options,plan,base,policy);
  else if (command === 'launch') output = await launch(options);
  else {
    const {endpoint,version,state} = await connection(options);
    if(command === 'status') output = {endpoint,browser:version.Browser,protocol:version['Protocol-Version'],owned:!!state,node:process.version};
    else if(command === 'tabs') output = (await fetchJSON(`${endpoint}/json/list`)).filter(t=>t.type==='page').map(({id,title,url})=>({id,title,url:redactURL(url)}));
    else if(command === 'new') {
      const cdp = await CDP.connect(version.webSocketDebuggerUrl);
      try { output = await cdp.send('Target.createTarget',{url:pageURL(required(options,'url'))}); } finally { cdp.close(); }
    } else if(command === 'stop') {
      if(!state) throw new Error('stop requires an owned --state-dir; external browsers are never closed');
      const cdp = await CDP.connect(version.webSocketDebuggerUrl);
      try { await cdp.send('Browser.close'); } finally { cdp.close(); }
      await fs.unlink(path.join(path.resolve(options['state-dir']),'session.json'));
      output = {closed:true,profileRetained:state.profile};
      if(options['purge-profile']){try{await purgeProfile(path.resolve(options['state-dir']),state.profile);delete output.profileRetained;output.profilePurged=true;}catch(error){output.profilePurged=false;output.cleanupError=error.message;process.exitCode=1;}}
    } else if(command === 'run') {
      const tabID = required(options,'tab');
      const target = (await fetchJSON(`${endpoint}/json/list`)).find(t=>t.id===tabID && t.type==='page');
      if(!target) throw new Error('Page target not found; list tabs again');
      loopbackURL(target.webSocketDebuggerUrl,['ws:']);
      if(new URL(target.webSocketDebuggerUrl).port !== new URL(endpoint).port) throw new Error('Unexpected page WebSocket port');
      const cdp=await CDP.connect(target.webSocketDebuggerUrl,{maxMessageBytes:policy.maxMessageBytes});
      try { output={browser:version.Browser,targetId:tabID,transport:state?'tcp-owned':'tcp-external',observedAt:new Date().toISOString(),...await runPlan(cdp,plan,base,policy)}; }
      finally { cdp.close(); }
      if(!output.ok) process.exitCode=1;
    } else throw new Error(`Unknown command: ${command}`);
  }
  if(output?.ok===false)process.exitCode=1;
  if(options.out) await writeJSON(required(options,'out'),output,{overwrite:!['run','check'].includes(command)||policy.overwrite});
  printResult(output,options);
  }finally{if(release)await release();}
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error=>{console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;});
}
