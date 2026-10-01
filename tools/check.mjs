import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {verifyPackage} from '../install.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const files=fs.readdirSync(path.join(root,'tests')).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>path.join(root,'tests',name));
const result=spawnSync(process.execPath,['--test',...files],{cwd:root,stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status??1);
const python=spawnSync('python',['-m','unittest','discover','-s','tests','-p','test_*.py'],{cwd:root,stdio:'inherit',windowsHide:true});
if(python.error)throw python.error;
if(python.status!==0)process.exit(python.status??1);
const verified=await verifyPackage(root);
console.log(JSON.stringify({manifestVerified:true,files:verified.filesVerified,publisherAuthenticated:verified.publisherAuthenticated}));
