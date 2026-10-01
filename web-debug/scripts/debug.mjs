import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {VERSION,options,required,findExecutable,printResult,assertNode} from './common.mjs';
const routes={chrome:'chrome.mjs',project:'project.mjs',analyze:'analyze.mjs',copy:'copy.mjs',edge:'edge.mjs',github:'github.mjs',knowledge:'refresh.mjs',report:'report.mjs'};
export async function main(argv) {
  assertNode();const [command,...rest]=argv;
  if(!command||['help','--help'].includes(command)){console.log(`Web Debug ${VERSION} — one entry point, no npm dependencies\n  debug.mjs chrome check --url URL [--out JSON]\n  debug.mjs chrome launch|status|tabs|new|run|stop [options]\n  debug.mjs project|analyze|copy|edge|github|knowledge [options]\n  debug.mjs report create|template|list|show|amend|triage|export [options]\n  debug.mjs windows --project PATH [--ports 3000,5173] [--out FILE]\nUse COMMAND --help for its options. With --out, stdout is compact; --full retains the complete stdout response. Quick check uses a private pipe and closes Chrome automatically. Chrome state defaults to work/web-debug/chrome under the current project. Reports are local files; nothing is submitted automatically.`);return;}
  if(!rest.length)rest.push('--help');
  const forwarded=rest.includes('--full')||rest.includes('--compact')?rest:[...rest,'--compact'];
  if(command==='windows') {
    const o=options(forwarded,['project','ports','out']);
    if(o.help){console.log('debug.mjs windows --project PATH [--ports 3000,5173] [--out FILE] [--full]');return;}
    if(process.platform!=='win32')throw new Error('Native Windows diagnostics require Windows; use the WSL reference for Linux tooling');
    if(o.ports&&!/^\d+(,\d+)*$/.test(o.ports))throw new Error('ports must be comma-separated integers');
    let shell;try{shell=await findExecutable('pwsh');}catch{shell=await findExecutable('powershell');}
    const childArgs=['-NoProfile','-File',fileURLToPath(new URL('windows.ps1',import.meta.url)),'-ProjectRoot',path.resolve(required(o,'project'))];
    if(o.ports)childArgs.push('-PortList',o.ports);if(o.out)childArgs.push('-OutFile',path.resolve(o.out));
    const {stdout}=await promisify(execFile)(shell,childArgs,{windowsHide:true,timeout:20000,maxBuffer:2000000});
    printResult(JSON.parse(stdout.replace(/^\uFEFF/,'')),o);return;
  }
  if(!Object.hasOwn(routes,command))throw new Error(`Unknown command ${command}`);
  if(command==='chrome'&&!forwarded.includes('--state-dir')&&!forwarded.includes('--endpoint')&&!rest.includes('--help')&&rest[0]!=='help')forwarded.push('--state-dir','work/web-debug/chrome');
  await (await import(new URL(routes[command],import.meta.url))).main(forwarded);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;});
