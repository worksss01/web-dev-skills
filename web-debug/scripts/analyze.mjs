import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {options as parseOptions,required,readJSON,writeJSON,writeFile,assertDistinctPaths,printResult} from './common.mjs';
import {summarizeReport,summarizeTrace,compareReports} from './diagnostics.mjs';
export async function main(argv) {
  const options=parseOptions(argv,['report','before','trace','out','markdown']);
  if(options.help){console.log('analyze.mjs --report FILE [--before FILE] [--trace FILE] [--out JSON] [--markdown FILE]\nOffline evidence triage. All paths are explicit inputs; generated reports store portable labels.');return;}
  await assertDistinctPaths([required(options,'report'),options.before,options.trace],[options.out,options.markdown]);
  const report=await readJSON(options.report,32000000);
  if(!Array.isArray(report.steps)||!Array.isArray(report.events))throw new Error('Expected a chrome.mjs run report');
  const result={schema:1,source:path.basename(options.report),analyzedAt:new Date().toISOString(),...summarizeReport(report)};
  if(options.before)result.comparison=compareReports(await readJSON(required(options,'before'),32000000),report);
  if(options.trace){result.trace=summarizeTrace(await readJSON(required(options,'trace'),100000000));}
  if(options.out)await writeJSON(required(options,'out'),result);
  if(options.markdown) {
    const literal=value=>'`'+String(value).replace(/[\r\n`]/g,' ').slice(0,220)+'`';
    const lines=['# Browser evidence review','',`Scenario passed: ${result.scenarioPassed}. Capture complete: ${result.captureComplete}.`,'',result.note,''];
    for(const f of result.findings)lines.push(`- P${f.priority} ${literal(f.code)} — ${literal(f.target)} (${f.count} occurrence groups). ${f.nextCheck}`);
    if(!result.findings.length)lines.push('No signals matched these rules. Verify the user-visible behavior and screenshot separately.');
    if(result.comparison)lines.push('',`Comparison: ${result.comparison.comparable?'comparable capture':'inconclusive'}.`,result.comparison.note||result.comparison.reason);
    if(result.trace) {lines.push('','## Trace samples','',result.trace.note,'');for(const e of result.trace.topEvents)lines.push(`- ${literal(e.name)}: ${e.durationMs} ms; process ${e.pid}, thread ${e.tid}.`);}
    await writeFile(required(options,'markdown'),lines.join('\n')+'\n');
  }
  printResult(result,options);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;});
