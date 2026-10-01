import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {options as parseOptions,required,writeJSON,readText,assertDistinctPaths,printResult} from './common.mjs';

export function reviewText(text,language='th') {
  if(typeof text!=='string'||text.length>1000000)throw new Error('Copy review requires text under 1 million characters');
  const locale=Intl.getCanonicalLocales(language)[0];
  let words=0,sentences=0;
  for(const segment of new Intl.Segmenter(locale,{granularity:'word'}).segment(text))if(segment.isWordLike)words++;
  for(const segment of new Intl.Segmenter(locale,{granularity:'sentence'}).segment(text))if(segment.segment.trim())sentences++;
  const paragraphs=text.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean),seen=new Map(),findings=[];
  for(let index=0;index<paragraphs.length;index++) {
    const paragraph=paragraphs[index],normalized=paragraph.replace(/\s+/g,' ').toLocaleLowerCase(locale);
    if(normalized.length>=40&&seen.has(normalized))findings.push({code:'repeated-passage',paragraph:index+1,firstParagraph:seen.get(normalized)+1,review:'Confirm intentional repetition; remove only if it adds no value.'});
    else seen.set(normalized,index);
    if(/(?:100\s*%|guaranteed|best in the world|รับประกัน|ดีที่สุด|อันดับหนึ่ง)/iu.test(paragraph))findings.push({code:'claim-needs-evidence',paragraph:index+1,review:'Verify the claim and its conditions. Do not weaken a factual guarantee or invent support automatically.'});
    if(/^(?:click here|learn more|read more|คลิกที่นี่|อ่านเพิ่มเติม)[.!\s]*$/iu.test(paragraph))findings.push({code:'generic-link-or-cta',paragraph:index+1,review:'Check surrounding context; use a concrete action/destination when the label alone is unclear.'});
  }
  return {schema:1,language:locale,metrics:{characters:text.length,words,sentences,paragraphs:paragraphs.length},findings,
    reviewChecklist:['Preserve facts, numbers, names, conditions and user intent.','Match audience, locale and brand voice; read the copy aloud in context.','Prefer concrete subjects/actions, purposeful detail and clear next steps.','Check Thai word choice, politeness and natural phrasing without applying English word-count rules.'],
    note:'Editorial cues only. No naturalness, authorship, AI-detection, SEO or truthfulness score. No rewrite is performed; a fluent-looking claim can still be wrong.'};
}
export async function main(argv) {
  const options=parseOptions(argv,['file','language','out']);if(options.help){console.log('copy.mjs --file TEXT_OR_MARKDOWN --language th|en|BCP47 [--out JSON]\nLocal editorial cues; no rewriting, uploads or authorship scoring.');return;}
  const file=required(options,'file');if((await fs.stat(file)).size>4000000)throw new Error('Input file exceeds 4 MB');
  await assertDistinctPaths([file],[options.out]);
  const result=reviewText(await readText(file,4000000),options.language??'th');
  if(options.out)await writeJSON(required(options,'out'),result);printResult(result,options);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;});
