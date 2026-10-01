"""Content-bound local publication gate. Not an OS sandbox or a secret-proof oracle."""
from pathlib import Path, PurePosixPath
import argparse, base64, hashlib, json, os, re, subprocess, sys, zipfile

ROOT=Path(__file__).resolve().parent.parent
ROOTS={'web-debug','tests','tools','evals','policy','adapters','docs','audit','validation','reports','examples','.github','.githooks'}
FILES={'.gitignore','.gitattributes','LICENSE','MANIFEST.sha256','install.mjs'}
DENIED={'work','outputs','.git','node_modules','__pycache__','AGENTS.md','session.json','.context-key','Cookies','Login Data'}
PATTERNS={
 'github-token':r'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})',
 'provider-key':r'\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{35,}',
 'private-key':r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
 'cloud-key':r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',
 'session-jwt':r'\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{20,}',
 'user-home':r'(?:[A-Za-z]:[/\\]+Users[/\\]+(?!private-person\b|fixture\b|example\b|runneradmin\b)[^/\\\s"\x27<>]+|/(?:home|Users)/(?!runner\b|runneradmin\b|private-person\b|fixture\b|example\b)[^/\s"\x27<>]+)',
}
def git(*args):return subprocess.check_output(['git','-C',str(ROOT),*args])
def digest(data):return hashlib.sha256(data).hexdigest()
def safe_name(name):
 p=PurePosixPath(name)
 return not (p.is_absolute() or any(x in DENIED or x in {'.','..'} or x.startswith('.env') or x.startswith('profile-') for x in p.parts) or '\\' in name or ':' in name or '\0' in name or (len(p.parts)==1 and name not in FILES and not name.endswith('.md')) or (len(p.parts)>1 and p.parts[0] not in ROOTS) or name.startswith('docs/migration-'))
def scan(name,data):
 result=[]
 if not safe_name(name):result.append({'file':name,'rule':'out-of-scope-path'})
 if len(data)>8_000_000:result.append({'file':name,'rule':'oversized-review-item'})
 if b'\0' in data:return result
 text=data.decode('utf-8',errors='replace')
 for rule,pattern in PATTERNS.items():
  for match in re.finditer(pattern,text):
   result.append({'file':name,'rule':rule,'line':text.count('\n',0,match.start())+1,'matchSha256':digest(match[0].encode())})
 home=str(Path.home()).replace('\\','/')
 if home not in ['/root','/home/runner','C:/Users/runneradmin'] and home.lower() in text.replace('\\','/').lower():result.append({'file':name,'rule':'actual-owner-home'})
 return result
def tree(commit):
 entries=[]
 for item in git('ls-tree','-rz','--full-tree',commit).split(b'\0'):
  if not item:continue
  meta,name=item.split(b'\t',1);mode,kind,sha=meta.decode().split();name=name.decode()
  if mode not in ['100644','100755'] or kind!='blob':raise ValueError('Links/submodules/non-files cannot be published: '+name)
  entries.append((name,sha))
 return entries
def inventory(commit):return [{'path':name,'sha256':digest(git('cat-file','blob',sha))} for name,sha in tree(commit)]
def assets(folder):
 result=[];findings=[]
 if not folder:return result,findings
 folder=Path(folder).resolve()
 if not folder.is_relative_to(ROOT/'outputs') and not folder.is_relative_to(ROOT/'work'):raise ValueError('Assets must be under project outputs/ or work/')
 for file in sorted(folder.iterdir()):
  if file.is_symlink() or not file.is_file():raise ValueError('Assets must be ordinary files')
  data=file.read_bytes();result.append({'name':file.name,'sha256':digest(data),'bytes':len(data)})
  if file.suffix=='.zip':
   with zipfile.ZipFile(file) as z:
    if sum(i.file_size for i in z.infolist())>64_000_000:raise ValueError('Expanded archive too large')
    names=set()
    for item in z.infolist():
     if item.is_dir():continue
     if item.filename.lower() in names or (item.external_attr>>16)&0o170000==0o120000:raise ValueError('Duplicate or linked archive entry')
     names.add(item.filename.lower())
     name=item.filename;parts=PurePosixPath(name).parts
     if len(parts)==1 and name=='PACKAGE-INFO.txt':continue
     if len(parts)<2 or parts[0] not in ['web-debug-kit','web-debug','web-debug-cowork']:raise ValueError('Unexpected archive layout')
     relative='/'.join(parts[1:])
     if parts[0]!='web-debug-kit':relative='web-debug/'+relative
     findings.extend(scan(relative,z.read(item)))
  elif file.suffix not in ['.json','.sha256']:raise ValueError('Unreviewed release asset type: '+file.name)
  else:
   findings.extend(scan('reports/'+file.name,data))
   if file.suffix=='.json':
    value=json.loads(data)
    if isinstance(value,dict) and 'payload' in value and 'signature' in value:
     payload=json.loads(base64.b64decode(value['payload'],validate=True))
     for name,content in payload['files'].items():findings.extend(scan('web-debug/'+name,base64.b64decode(content,validate=True)))
 return result,findings
def inspect(commit,asset_dir=None):
 inv=inventory(commit);findings=[];seen=set()
 # All reachable commits are examined, not only the latest checkout.
 for sha in git('rev-list',commit).decode().splitlines():
  for name,blob in tree(sha):
   if (name,blob) in seen:continue
   seen.add((name,blob));findings.extend(scan(name,git('cat-file','blob',blob)))
  meta=git('show','-s','--format=%an <%ae>%n%cn <%ce>',sha).decode()
  for email in re.findall(r'<([^>]+)>',meta):
   if not email.endswith('@users.noreply.github.com'):findings.append({'file':'commit:'+sha,'rule':'non-public-author-email'})
 asset_inv,extra=assets(asset_dir);findings.extend(extra)
 return {'schema':1,'commit':commit,'tree':git('rev-parse',commit+'^{tree}').decode().strip(),'inventory':inv,'assets':asset_inv,'findings':findings}
def receipt_path(commit):return ROOT/'work/pre-publication'/('gate-'+commit+'.json')
def check(commit,note,asset_dir=None,quality=True):
 report=inspect(commit,asset_dir)
 if report['findings']:raise ValueError('Publication blocked: '+json.dumps(report['findings']))
 note=Path(note).resolve()
 if not note.is_relative_to(ROOT/'work') or note.is_symlink():raise ValueError('Keep review notes in ignored project work/')
 review=json.loads(note.read_text(encoding='utf-8'))
 if review.get('commit')!=commit or any(review.get(k) is not True for k in ['pcAccessReviewed','privacyReviewed','scopeReviewed']):raise ValueError('Review note must approve the exact commit and all three boundaries')
 if len(review.get('rationale','').strip())<80:raise ValueError('Record a substantive security/privacy/scope rationale')
 if git('rev-parse','HEAD').decode().strip()!=commit or git('status','--porcelain','--untracked-files=normal').strip():raise ValueError('Quality checks require the exact clean committed checkout')
 if not quality:raise ValueError('Quality verification cannot be skipped when issuing a receipt')
 checks=[['node','tools/check.mjs'],['node','tests/package-smoke.mjs','--work','work/gate-package']]
 outputs=[]
 for command in checks:
  r=subprocess.run(command,cwd=ROOT,capture_output=True,timeout=180)
  outputs.append({'command':command,'exitCode':r.returncode,'outputSha256':digest(r.stdout+r.stderr)})
  if r.returncode:raise ValueError('Required quality check failed: '+command[1])
 # Reject changes during review/testing.
 if inventory(commit)!=report['inventory'] or git('status','--porcelain','--untracked-files=normal').strip():raise ValueError('Content changed during verification')
 if assets(asset_dir)[0]!=report['assets']:raise ValueError('Release assets changed during verification')
 report.update({'passed':True,'reviewSha256':digest(note.read_bytes()),'checks':outputs,'limitations':'Review attestation and patterns are not a sandbox or proof of absence of all vulnerabilities.'})
 p=receipt_path(commit);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
 return report
def verify(commit,asset_dir=None):
 report=json.loads(receipt_path(commit).read_text(encoding='utf-8'))
 current=inspect(commit,asset_dir)
 if not report.get('passed') or report['commit']!=commit or report['tree']!=current['tree'] or report['inventory']!=current['inventory'] or current['findings']:raise ValueError('Missing, changed or failed publication review')
 if asset_dir and report['assets']!=current['assets']:raise ValueError('Assets differ from reviewed release')
 return {'passed':True,'commit':commit,'files':len(current['inventory'])}
def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('command',choices=['inspect','check','verify','pre-push','install-hook']);parser.add_argument('--commit',default='HEAD');parser.add_argument('--note');parser.add_argument('--assets');o=parser.parse_args()
 if o.command=='install-hook':
  configured=subprocess.run(['git','-C',str(ROOT),'config','--local','--get','core.hooksPath'],capture_output=True,text=True).stdout.strip()
  if configured and configured!='.githooks':raise ValueError('Existing hooks preserved; integrate deliberately')
  (ROOT/'.githooks/pre-push').chmod(0o755)
  subprocess.run(['git','-C',str(ROOT),'config','--local','core.hooksPath','.githooks'],check=True);print('Project pre-push gate enabled');return
 if o.command=='pre-push':
  for line in sys.stdin:
   parts=line.split()
   if len(parts)!=4:raise ValueError('Malformed pre-push input')
   if set(parts[1])=={'0'}:raise ValueError('Remote deletion needs a separate reviewed operation')
   verify(git('rev-parse',parts[1]+'^{commit}').decode().strip())
  return
 commit=git('rev-parse',o.commit+'^{commit}').decode().strip()
 r=inspect(commit,o.assets) if o.command=='inspect' else check(commit,o.note,o.assets) if o.command=='check' else verify(commit,o.assets)
 print(json.dumps(r if o.command=='inspect' else {'passed':r.get('passed'),'commit':commit,'files':len(r.get('inventory',[]))}))
 if r.get('findings'):sys.exit(1)
if __name__=='__main__':
 try:main()
 except Exception as e:print(str(e),file=sys.stderr);sys.exit(1)
