import importlib.util,io,json,os,shutil,subprocess,tempfile,unittest,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
def module(name):
 spec=importlib.util.spec_from_file_location(name,ROOT/'tools'/(name+'.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
gate=module('gate');lab=module('lab')
class MaintenanceTools(unittest.TestCase):
 def setUp(self):
  base=ROOT/'work/python-maintenance-tests';base.mkdir(parents=True,exist_ok=True);self.dir=Path(tempfile.mkdtemp(dir=base))
 def test_publication_inventory_and_secret_detection(self):
  for name in ['work/report.json','AGENTS.md','.env','web-debug/.web-debug-update.json','docs/migration-local.json','other-project/code.js','../escape']:
   self.assertFalse(gate.safe_name(name),name)
  secret=('gh'+'p_'+'A'*36).encode();self.assertTrue(gate.scan('tools/example.mjs',secret))
  self.assertNotIn(secret.decode(),json.dumps(gate.scan('tools/example.mjs',secret)))
 def test_archive_traversal_is_not_approved(self):
  archive=self.dir/'bad.zip'
  with zipfile.ZipFile(archive,'w') as z:z.writestr('web-debug-kit/../outside.txt','fixture')
  _,findings=gate.assets(self.dir);self.assertTrue(findings)
 def test_missing_receipt_blocks_push(self):
  prior=gate.ROOT;gate.ROOT=self.dir
  try:
   with self.assertRaises(FileNotFoundError):gate.verify('0'*40)
  finally:gate.ROOT=prior
 def test_lab_rejects_unlisted_escape_and_links_before_packaging(self):
  (self.dir/'case.json').write_text(json.dumps({'schema':1,'entry':'../repro.mjs','files':['../repro.mjs']}))
  with self.assertRaises(ValueError):lab.context(self.dir)
  (self.dir/'case.json').write_text(json.dumps({'schema':1,'entry':'repro.mjs','files':['repro.mjs']}));(self.dir/'repro.mjs').write_text('console.log(1)')
  spec,files=lab.context(self.dir);self.assertEqual(list(files),['repro.mjs'])
 def test_lab_command_has_no_mount_network_or_privileged_escape(self):
  args=lab.arguments('fixture-image','fixture-name','repro.mjs')
  self.assertIn('--network=none',args);self.assertIn('--read-only',args);self.assertIn('--cap-drop=ALL',args);self.assertIn('--user=65534:65534',args)
  self.assertFalse(any(x in args for x in ['--privileged','--volume','-v','--mount','--env-file','-p','--publish']))
  self.assertIn('HTTP_PROXY=',args)
 def test_unpinned_lab_runtime_is_rejected(self):
  with self.assertRaisesRegex(ValueError,'digest-pinned'):lab.execute(self.dir,'node:latest')
 def test_real_pre_push_hook_blocks_missing_and_stale_receipts(self):
  repo=self.dir/'repo';repo.mkdir();remote=self.dir/'remote.git'
  def git(*args,ok=True):
   r=subprocess.run(['git','-C',str(repo),*args],capture_output=True,text=True)
   if ok:self.assertEqual(r.returncode,0,r.stderr)
   return r
  git('init','-b','main');git('config','user.name','Synthetic fixture');git('config','user.email','fixture@users.noreply.github.com')
  (repo/'tools').mkdir();(repo/'tests').mkdir();(repo/'.githooks').mkdir()
  shutil.copyfile(ROOT/'tools/gate.py',repo/'tools/gate.py');shutil.copyfile(ROOT/'.githooks/pre-push',repo/'.githooks/pre-push')
  (repo/'.githooks/pre-push').chmod(0o755)
  # These trivial scripts are test doubles for the gate process protocol only.
  (repo/'tools/check.mjs').write_text('console.log("fixture quality protocol")')
  (repo/'tests/package-smoke.mjs').write_text('console.log("fixture package protocol")')
  (repo/'README.md').write_text('Synthetic hook test repository')
  (repo/'.gitignore').write_text('/work/\n/outputs/\n')
  git('add','.');git('commit','-m','Synthetic initial fixture')
  subprocess.run(['git','init','--bare',str(remote)],check=True,capture_output=True);git('remote','add','origin',str(remote))
  script=repo/'tools/gate.py'
  subprocess.run([os.sys.executable,str(script),'install-hook'],cwd=repo,check=True,capture_output=True)
  self.assertNotEqual(git('push','origin','main',ok=False).returncode,0)
  sha=git('rev-parse','HEAD').stdout.strip();(repo/'work').mkdir();note=repo/'work/review.json'
  note.write_text(json.dumps({'commit':sha,'pcAccessReviewed':True,'privacyReviewed':True,'scopeReviewed':True,'rationale':'Controlled synthetic fixture with no network services, credentials, personal information or unrelated content. This attests only the hook protocol test.'}))
  checked=subprocess.run([os.sys.executable,str(script),'check','--note',str(note)],cwd=repo,capture_output=True,text=True);self.assertEqual(checked.returncode,0,checked.stderr)
  git('push','origin','main')
  (repo/'README.md').write_text('Changed after the previous reviewed receipt');git('add','README.md');git('commit','-m','Synthetic change')
  self.assertNotEqual(git('push','origin','main',ok=False).returncode,0)
if __name__=='__main__':unittest.main()
