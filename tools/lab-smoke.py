"""Verify the lab with synthetic canaries, not owner credentials."""
from pathlib import Path
import argparse,json,os,uuid
from lab import execute,ROOT
p=argparse.ArgumentParser();p.add_argument('--out',required=True);o=p.parse_args()
out=Path(o.out).resolve()
if not out.is_relative_to(ROOT/'work') or out.exists():raise ValueError('Use a fresh output under project work/')
case=ROOT/'work/lab-smoke'/uuid.uuid4().hex;case.mkdir(parents=True)
(case/'case.json').write_text(json.dumps({'schema':1,'entry':'check.mjs','files':['check.mjs']}),encoding='utf-8')
(case/'check.mjs').write_text("""import fs from 'node:fs';import net from 'node:net';import assert from 'node:assert/strict';
assert.equal(process.getuid(),65534);
assert.equal(process.env.WEB_DEBUG_LAB_SECRET,undefined);
assert(!fs.existsSync('/var/run/docker.sock'));
assert(!fs.existsSync('/host'));
assert.throws(()=>fs.writeFileSync('/case/modified','x'),/EROFS|EACCES/);
const status=fs.readFileSync('/proc/self/status','utf8');assert.match(status,/NoNewPrivs:\\s+1/);assert.match(status,/CapEff:\\s+0+\\n/);
await new Promise((resolve,reject)=>{const s=net.connect({host:'198.51.100.1',port:443});s.on('connect',()=>{s.destroy();reject(new Error('Unexpected external network access'));});s.on('error',()=>resolve());s.setTimeout(500,()=>{s.destroy();resolve();});});
console.log(JSON.stringify({nonRoot:true,noInheritedSecret:true,noHostMount:true,readOnly:true,noPrivileges:true,externalNetworkUnavailable:true}));
""",encoding='utf-8')
image=json.loads((ROOT/'policy/lab-runtime.json').read_text(encoding='utf-8'))['image']
previous=os.environ.get('WEB_DEBUG_LAB_SECRET');os.environ['WEB_DEBUG_LAB_SECRET']='SYNTHETIC_CANARY_ONLY'
try:result=execute(case,image)
finally:
 if previous is None:os.environ.pop('WEB_DEBUG_LAB_SECRET',None)
 else:os.environ['WEB_DEBUG_LAB_SECRET']=previous
if result['exitCode'] or result['timedOut'] or result['outputLimitExceeded']:raise RuntimeError('Lab canary failed: '+result['output'])
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({'isolationCanaryPassed':True,'image':image,'output':str(out)}))
