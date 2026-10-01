"""Run a curated reproduction in a constrained, offline Linux container."""
from pathlib import Path, PurePosixPath
import argparse,hashlib,io,json,os,re,subprocess,tarfile,threading,uuid
ROOT=Path(__file__).resolve().parent.parent
def run(command,timeout=30):return subprocess.run(command,capture_output=True,text=True,timeout=timeout,check=True).stdout.strip()
def context(folder):
 folder=Path(folder).resolve();spec=json.loads((folder/'case.json').read_text(encoding='utf-8'))
 if set(spec)!={'schema','entry','files'} or spec['schema']!=1 or not isinstance(spec['files'],list) or not 1<=len(spec['files'])<=50:raise ValueError('Invalid case manifest')
 if spec['entry'] not in spec['files'] or not spec['entry'].endswith('.mjs'):raise ValueError('Entry must be a listed Node .mjs file')
 result={};size=0
 for name in spec['files']:
  if not isinstance(name,str) or not re.fullmatch(r'[A-Za-z0-9_/-]+\.(?:mjs|js|json|html|css|txt)',name) or '..' in PurePosixPath(name).parts or name.startswith('/') or name in result:raise ValueError('Invalid/duplicate case file')
  p=folder
  for part in PurePosixPath(name).parts:
   p=p/part
   if p.is_symlink() or getattr(p,'is_junction',lambda:False)():raise ValueError('Linked case content refused')
  if not p.resolve().is_relative_to(folder) or not p.is_file():raise ValueError('Case escapes its directory')
  data=p.read_bytes();size+=len(data)
  if size>1_000_000:raise ValueError('Case exceeds 1 MB')
  result[name]=data
 return spec,result
def arguments(image,name,entry):
 proxies=[item for key in ['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy'] for item in ['--env',key+'=']]
 return ['docker','run','--name',name,'--label','web-debug.lab=true','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=64','--memory=256m','--cpus=1','--user=65534:65534','--tmpfs','/tmp:rw,nosuid,nodev,noexec,size=32m','--workdir=/case','--env','HOME=/tmp',*proxies,'--entrypoint=node',image,'/case/'+entry]
def execute(folder,image,timeout=15):
 if not re.fullmatch(r'node@sha256:[a-f0-9]{64}',image):raise ValueError('Use an explicitly trusted digest-pinned official Node image')
 endpoint=os.environ.get('DOCKER_HOST') or run(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}'])
 if not (endpoint.startswith('unix:///') or endpoint.startswith('npipe:////./pipe/')):raise ValueError('Only a local Docker engine is supported; remote contexts are refused')
 if run(['docker','info','--format','{{.OSType}}'])!='linux':raise ValueError('A running Linux Docker engine is required; no host fallback')
 run(['docker','image','inspect',image]) # Never silently pull a different runtime.
 spec,files=context(folder);name='web-debug-lab-'+uuid.uuid4().hex;tag=name+':test'
 buf=io.BytesIO()
 with tarfile.open(fileobj=buf,mode='w') as tar:
  data=f'FROM {image}\nCOPY --chown=65534:65534 case/ /case/\nUSER 65534:65534\n'.encode()
  for path,body in [('Dockerfile',data),*[('case/'+k,v) for k,v in files.items()]]:
   info=tarfile.TarInfo(path);info.size=len(body);info.mode=0o444;tar.addfile(info,io.BytesIO(body))
 subprocess.run(['docker','build','--network=none','--pull=false','-t',tag,'-'],input=buf.getvalue(),capture_output=True,timeout=120,check=True)
 output=bytearray();exceeded=False;timed_out=False
 try:
  proc=subprocess.Popen(arguments(tag,name,spec['entry']),stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
  def collect():
   nonlocal exceeded
   while chunk:=proc.stdout.read(4096):
    if len(output)+len(chunk)>1_000_000:exceeded=True;proc.kill();break
    output.extend(chunk)
  reader=threading.Thread(target=collect,daemon=True);reader.start()
  try:proc.wait(timeout=timeout)
  except subprocess.TimeoutExpired:timed_out=True;proc.kill();proc.wait(timeout=10)
  reader.join(timeout=5)
  text=output.decode('utf-8',errors='replace');text=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',text)
  text=''.join(c for c in text if c in '\n\t' or ord(c)>=32)
  return {'schema':1,'caseSha256':hashlib.sha256(buf.getvalue()).hexdigest(),'image':image,'exitCode':proc.returncode,'timedOut':timed_out,'outputLimitExceeded':exceeded,'output':text,'untrustedOutput':True,'isolation':{'network':'none','hostMounts':False,'privileged':False,'user':'65534','readOnlyRoot':True},'note':'Container isolation is defense in depth, not a guarantee against kernel/runtime vulnerabilities.'}
 finally:
  subprocess.run(['docker','rm','-f',name],capture_output=True,timeout=20)
  subprocess.run(['docker','image','rm',tag],capture_output=True,timeout=20)
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--case',required=True);p.add_argument('--image',required=True);p.add_argument('--out',required=True);p.add_argument('--timeout',type=int,default=15);o=p.parse_args()
 if not 1<=o.timeout<=60:raise ValueError('Timeout must be 1..60 seconds')
 out=Path(o.out).resolve()
 if not out.is_relative_to(ROOT/'work') or out.exists():raise ValueError('Choose a new result file under project work/')
 result=execute(o.case,o.image,o.timeout);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k!='output'}))
 if result['exitCode'] or result['timedOut'] or result['outputLimitExceeded']:raise SystemExit(1)
if __name__=='__main__':main()
