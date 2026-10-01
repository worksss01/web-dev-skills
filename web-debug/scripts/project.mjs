import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {options as parseOptions,required,readText,writeJSON,assertDistinctPaths,printResult} from './common.mjs';

const ignored=new Set(['.git','node_modules','.next','.nuxt','.output','.svelte-kit','dist','build','coverage','vendor','work','outputs','.agents','.claude','.codex']);
const packages=['react','react-dom','next','vite','tailwindcss','vue','nuxt','svelte','@sveltejs/kit','@angular/core','astro','typescript','@playwright/test','playwright','playwright-core','puppeteer','vitest','jest','@axe-core/playwright','wrangler','@cloudflare/vite-plugin','@opennextjs/cloudflare'];
const locks={'package-lock.json':'npm','npm-shrinkwrap.json':'npm','pnpm-lock.yaml':'pnpm','yarn.lock':'yarn','bun.lock':'bun','bun.lockb':'bun'};
const configs=/^(vite\.config\.|next\.config\.|nuxt\.config\.|astro\.config\.|svelte\.config\.|tailwind\.config\.|postcss\.config\.|playwright\.config\.|vitest\.config\.|eslint\.config\.|tsconfig.*\.json$|\.browserslistrc$|wrangler\.(jsonc?|toml)$|_headers$|_redirects$)/;
const portable=value=>value.split(path.sep).join('/');
const inside=(root,value)=>{const r=path.relative(root,value);return r!=='..'&&!r.startsWith(`..${path.sep}`)&&!path.isAbsolute(r);};
const spec=value=>typeof value==='string'&&/^[\d~^*<>=v]|^workspace:[\w*^~.<> =-]+$/.test(value)?value:'(non-version spec; inspect manifest locally)';
async function jsonFile(file) {
  const text=await readText(file,2000000,{noFollow:true});
  try {return JSON.parse(text.replace(/^\uFEFF/,''));}catch {throw new Error('Manifest is not valid JSON');}
}
async function installedVersion(root,directory,name) {
  for(let current=directory;inside(root,current);current=path.dirname(current)) {
    const candidate=path.join(current,'node_modules',...name.split('/'),'package.json');
    try {
      const real=await fs.realpath(candidate);
      if(inside(root,real)) {
        const data=await jsonFile(real);
        if(typeof data.version==='string')return {version:data.version,manifest:portable(path.relative(root,real))};
      }
    }catch{}
    if(current===root)break;
  }
  return null;
}
export async function inspectProject(project) {
  const root=await fs.realpath(path.resolve(project));
  if(!(await fs.stat(root)).isDirectory())throw new Error('Project must be a directory');
  const result={schema:1,observedAt:new Date().toISOString(),pathBase:'--project directory',runtime:{node:process.version,platform:process.platform},packages:[],configs:[],lockfiles:[],workflows:[],warnings:[],coverage:{directories:0,truncated:false,symlinkDirectoriesSkipped:0},
    note:'Read-only inventory. Script names are listed but no package scripts, installs, env files or config code are executed/read. Declared ranges are not installed versions. Lockfile presence is a hint; actual resolution may require the package manager.'};
  async function walk(directory,depth) {
    if(result.coverage.directories>=600||result.packages.length>=80){result.coverage.truncated=true;return;}
    result.coverage.directories++;
    let entries;
    try {entries=await fs.readdir(directory,{withFileTypes:true});}catch {result.warnings.push({code:'unreadable-directory',path:portable(path.relative(root,directory))});return;}
    const regular=entries.filter(e=>e.isFile()).map(e=>e.name);
    const localLocks=regular.filter(name=>Object.hasOwn(locks,name));
    for(const name of localLocks)result.lockfiles.push({path:portable(path.relative(root,path.join(directory,name))),manager:locks[name]});
    if(new Set(localLocks.map(name=>locks[name])).size>1)result.warnings.push({code:'multiple-package-managers',path:portable(path.relative(root,directory))||'.',detail:'Confirm which lockfile CI uses before installing dependencies.'});
    for(const name of regular.filter(name=>configs.test(name)))result.configs.push(portable(path.relative(root,path.join(directory,name))));
    // Inspect workflow filenames only; never execute or parse workflow expressions.
    const workflows=path.join(directory,'.github','workflows');
    try {
      const real=await fs.realpath(workflows);
      if(inside(root,real))for(const entry of await fs.readdir(real,{withFileTypes:true}))if(entry.isFile()&&/\.ya?ml$/i.test(entry.name))result.workflows.push(portable(path.relative(root,path.join(workflows,entry.name))));
    }catch{}
    if(regular.includes('package.json')) {
      const location=portable(path.relative(root,path.join(directory,'package.json')));
      try {
        const data=await jsonFile(path.join(directory,'package.json'));
        const deps={...data.devDependencies,...data.dependencies};
        const frameworks=[];
        for(const name of packages)if(Object.hasOwn(deps,name))frameworks.push({name,declared:spec(deps[name]),installed:await installedVersion(root,directory,name)});
        result.packages.push({manifest:location,name:data.name??null,packageManager:typeof data.packageManager==='string'?spec(data.packageManager.replace(/^(npm|yarn|pnpm|bun)@/,'')):null,
          packageManagerName:typeof data.packageManager==='string'?data.packageManager.split('@')[0]:null,
          nodeEngine:typeof data.engines?.node==='string'?spec(data.engines.node):null,scriptNames:Object.keys(data.scripts??{}).sort(),hasWorkspaces:!!data.workspaces,hasBrowserslist:Object.hasOwn(data,'browserslist'),frameworks});
      }catch(error){result.warnings.push({code:'unreadable-manifest',path:location,detail:error.message});}
    }
    for(const entry of entries) {
      if(ignored.has(entry.name)||entry.name.startsWith('.'))continue;
      if(entry.isSymbolicLink()){result.coverage.symlinkDirectoriesSkipped++;continue;}
      if(!entry.isDirectory())continue;
      if(depth>=5){result.coverage.truncated=true;continue;}
      await walk(path.join(directory,entry.name),depth+1);
    }
  }
  await walk(root,0);
  if(!result.packages.length)result.warnings.push({code:'no-package-json',detail:'This may be a static site, a non-Node stack, or a project outside the bounded scan; inspect its native tooling.'});
  return result;
}
export async function main(argv) {
  const options=parseOptions(argv,['project','out']);
  if(options.help){console.log('project.mjs --project PATH [--out FILE]\nRead-only bounded package/framework/config inventory. Does not execute project code.');return;}
  const result=await inspectProject(required(options,'project'));
  await assertDistinctPaths([...result.packages.map(p=>p.manifest),...result.configs,...result.lockfiles.map(l=>l.path),...result.workflows].map(file=>path.resolve(options.project,file)),[options.out]);
  if(options.out)await writeJSON(required(options,'out'),result);
  printResult(result,options);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main(process.argv.slice(2)).catch(error=>{console.error(JSON.stringify({ok:false,error:error.message}));process.exitCode=1;});
