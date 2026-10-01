"""Build Web Debug release archives from this checkout using only Python stdlib."""
from pathlib import Path
from io import BytesIO
import argparse
import hashlib
import json
import posixpath
import re
import zipfile

ROOT=Path(__file__).resolve().parent.parent
PAYLOAD_DIRS=('web-debug','tests','audit','examples','reports','validation','tools','adapters')
def digest(data):return hashlib.sha256(data).hexdigest()

def read_tree(folder):
    result={}
    for file in folder.rglob('*'):
        if file.is_symlink() or getattr(file,'is_junction',lambda:False)():raise ValueError(f'Linked source refused: {file}')
        if not file.resolve().is_relative_to(ROOT):raise ValueError(f'Source leaves repository: {file}')
        if file.is_file():
            relative=file.relative_to(folder).as_posix()
            if any(p in {'work','outputs','.git','node_modules','__pycache__'} or p.startswith('profile-') for p in file.relative_to(folder).parts):raise ValueError(f'Runtime content in release source: {file}')
            if file.name in {'.context-key','session.json','operation.lock'} or file.name.startswith('.env'):raise ValueError(f'Private state in release source: {file}')
            result[relative]=file.read_bytes()
    return result

def collect_payload():
    result={}
    for directory in PAYLOAD_DIRS:
        for relative,data in read_tree(ROOT/directory).items():result[directory+'/'+relative]=data
    for file in [ROOT/'install.mjs',ROOT/'LICENSE',*(p for p in ROOT.glob('*.md') if p.name!='AGENTS.md')]:result[file.name]=file.read_bytes()
    for relative in ('docs/UPDATES.md','docs/cowork/UPLOAD.md','docs/cowork/package-validation.json','docs/cowork/local-smoke-validation.json'):
        result[relative]=(ROOT/relative).read_bytes()
    return result

def manifest(files):return ''.join(f'{digest(data)}  {name}\n' for name,data in sorted(files.items())).encode()

def check_links(files):
    count=0
    for name,data in files.items():
        if not name.endswith('.md'):continue
        for link in re.findall(r'\]\(([^)]+)\)',data.decode('utf-8')):
            if '://' in link or link.startswith('#'):continue
            target=posixpath.normpath(posixpath.join(posixpath.dirname(name),link.split('#',1)[0]))
            # The source overlay inherits base references at build time. The
            # rendered Cowork payload is validated independently below.
            if target not in files and name.startswith('adapters/cowork/') and target.startswith('adapters/cowork/'):
                target='web-debug/'+target.removeprefix('adapters/cowork/')
            if target not in files:raise ValueError(f'Missing packaged link: {name}: {link}')
            count+=1
    return count

def archive_bytes(prefix,files,notice=None):
    buffer=BytesIO()
    with zipfile.ZipFile(buffer,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        entries={prefix+'/'+name:data for name,data in files.items()}
        if notice is not None:entries['PACKAGE-INFO.txt']=notice.encode()
        for name,data in sorted(entries.items()):
            info=zipfile.ZipInfo(name,date_time=(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.create_system=3;info.external_attr=0o100644<<16
            archive.writestr(info,data,compresslevel=9)
    with zipfile.ZipFile(BytesIO(buffer.getvalue())) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist())==set(entries)
        for name,data in entries.items():assert archive.read(name)==data
    return buffer.getvalue()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',default='outputs/builds',help='Output directory inside this repository')
    parser.add_argument('--manifest-only',action='store_true',help='Refresh the development checkout manifest after reviewed source edits')
    options=parser.parse_args()
    full=collect_payload();version=re.search(rb"export const VERSION='(\d+\.\d+\.\d+)'",full['web-debug/scripts/common.mjs']).group(1).decode()
    manifest_data=manifest(full)
    if options.manifest_only:
        (ROOT/'MANIFEST.sha256').write_bytes(manifest_data)
        print(json.dumps({'version':version,'manifestEntries':len(full),'mode':'manifest-only'}));return
    release=f'RELEASE-{version}.md' if f'RELEASE-{version}.md' in full else f'RE-AUDIT-{version}.md'
    for required in [release,f'VALIDATION-{version}.md','REVIEW-INDEX.md']:
        if required not in full:raise ValueError(f'Release document missing: {required}')
    full['MANIFEST.sha256']=manifest_data
    core={name.removeprefix('web-debug/'):data for name,data in full.items() if name.startswith('web-debug/')}
    cowork={name:data for name,data in core.items() if name!='SKILL.md' and not name.startswith('agents/')}
    template=(ROOT/'adapters/cowork/SKILL.template.md').read_bytes().decode('utf-8')
    if template.count('{{VERSION}}')!=1:raise ValueError('Cowork template needs one version marker')
    entry=template.replace('{{VERSION}}',version)
    fields=entry.split('---',2)[1].strip().splitlines()
    if fields[0]!='name: web-debug-cowork' or len(fields)!=2:raise ValueError('Unexpected Cowork metadata')
    description=json.loads(fields[1].split(': ',1)[1])
    if len(description)>200:raise ValueError('Cowork description exceeds 200 characters')
    cowork['SKILL.md']=entry.encode()
    cowork['references/cowork-runtime.md']=(ROOT/'adapters/cowork/references/cowork-runtime.md').read_bytes()
    links={'full':check_links(full),'core':check_links(core),'cowork':check_links(cowork)}
    for name,data in core.items():
        if name.startswith('scripts/'):assert cowork[name]==data
    notice=f'Web Debug {version} - INSTALLABLE SKILL ONLY\nFor reports, tests and evidence use web-debug-kit-{version}.zip.\n'
    artifacts={f'web-debug-kit-{version}.zip':archive_bytes('web-debug-kit',full),f'web-debug-{version}.zip':archive_bytes('web-debug',core,notice),f'web-debug-cowork-{version}.zip':archive_bytes('web-debug-cowork',cowork)}
    checks={'version':version,'linksChecked':links,'coreFiles':len(core),'coworkFiles':len(cowork),'coworkScriptsIdentical':True,'coworkExecutionTested':False,'archives':{name:{'sha256':digest(data),'bytes':len(data)} for name,data in artifacts.items()},'note':'Build verification only. Previously published archives are preserved separately; changed release content requires a versioned release decision.'}
    for name,data in list(artifacts.items()):artifacts[name+'.sha256']=f'{digest(data)}  {name}\n'.encode()
    artifacts[f'build-{version}.json']=(json.dumps(checks,indent=2)+'\n').encode()
    output=(ROOT/options.out).resolve()
    if not output.is_relative_to(ROOT) or output==ROOT:raise ValueError('Choose an output subdirectory inside this repository')
    for name,data in artifacts.items():
        file=output/name
        if file.exists() and (file.is_symlink() or file.read_bytes()!=data):raise ValueError(f'Existing artifact preserved: {file}. Use a fresh output directory or a new release version.')
    output.mkdir(parents=True,exist_ok=True)
    for name,data in artifacts.items():
        file=output/name
        if not file.exists():
            with file.open('xb') as stream:stream.write(data)
    print(json.dumps(checks,indent=2))

if __name__=='__main__':main()
