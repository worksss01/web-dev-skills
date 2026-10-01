import fs from 'node:fs/promises';
import path from 'node:path';
import {generateKeyPairSync,createPublicKey,sign,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {options,required,readJSON,writeJSON,readText} from '../web-debug/scripts/common.mjs';
import {safeFile,verifyEnvelope} from '../web-debug/scripts/update.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),o=options(process.argv.slice(2),['key','out'],['generate']);
const keyPath=path.resolve(required(o,'key'));
if(!keyPath.startsWith(path.join(root,'work')+path.sep))throw new Error('Keep the private signing key under ignored project work/');
if(o.generate){
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');await fs.mkdir(path.dirname(keyPath),{recursive:true,mode:0o700});
 await fs.writeFile(keyPath,privateKey.export({format:'pem',type:'pkcs8'}),{flag:'wx',mode:0o600});
 const pem=publicKey.export({format:'pem',type:'spki'}).toString(),id=createHash('sha256').update(pem).digest('hex').slice(0,16);
 await writeJSON(path.join(root,'web-debug/references/release-keys.json'),{schema:1,keys:[{id,pem}],note:'Initial trust is established when the user installs this package from the publisher. Signatures authenticate bytes, not their safety.'},{overwrite:false});
 console.log(JSON.stringify({publicKeyId:id,privateKeyPrinted:false}));
}else{
 const privateKey=await readText(keyPath,16000,{noFollow:true}),pem=createPublicKey(privateKey).export({format:'pem',type:'spki'}).toString();
 const trust=await readJSON(path.join(root,'web-debug/references/release-keys.json')),key=trust.keys.find(k=>k.pem===pem&&!k.revoked);if(!key)throw new Error('Signing key is not an active published trust anchor');
 const files={};async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isSymbolicLink())throw new Error('Linked source refused');if(e.isDirectory())await walk(p);else{const name=path.relative(path.join(root,'web-debug'),p).split(path.sep).join('/');safeFile(name);files[name]=(await fs.readFile(p)).toString('base64');}}}
 await walk(path.join(root,'web-debug'));const source=Buffer.from(files['scripts/common.mjs'],'base64').toString(),version=/export const VERSION='([^']+)'/.exec(source)[1];
 const bytes=Buffer.from(JSON.stringify({schema:1,version,compatibilityEpoch:1,channel:'stable',files}));const envelope={schema:1,keyId:key.id,payload:bytes.toString('base64'),signature:sign(null,bytes,privateKey).toString('base64')};verifyEnvelope(envelope,trust);
 const out=path.resolve(required(o,'out'));if(!out.startsWith(path.join(root,'outputs')+path.sep)&&!out.startsWith(path.join(root,'work')+path.sep))throw new Error('Output must stay under work/ or outputs/');
 await writeJSON(out,envelope,{overwrite:false});console.log(JSON.stringify({version,keyId:key.id,signed:true,sha256:createHash('sha256').update(await fs.readFile(out)).digest('hex')}));
}
