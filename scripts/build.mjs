import fs from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
const root=process.cwd();
await build({entryPoints:['node_modules/@decartai/sdk/dist/index.js'],outfile:'public/vendor/lucy.js',bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',legalComments:'linked'});
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.txt':'text/plain; charset=utf-8'};
const assets={};
async function walk(dir){for(const d of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,d.name);if(d.isDirectory())await walk(p);else{const key='/'+path.relative(path.join(root,'public'),p).replaceAll('\\','/');assets[key]={base64:(await fs.readFile(p)).toString('base64'),type:types[path.extname(p)]||'application/octet-stream'}}}}
await walk(path.join(root,'public'));
try{await fs.access('.openai/hosting.json')}catch{console.log(`Built Vercel app with ${Object.keys(assets).length} local assets.`);process.exit(0)}
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});
await build({stdin:{contents:`import {handle} from './worker/index.js'; const assets=${JSON.stringify(assets)}; export default {fetch(request,env){return handle(request,env,assets)}};`,resolveDir:root,sourcefile:'wardrobe-worker.js'},outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'neutral',target:'es2022',minify:true});
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log(`Built Worker with ${Object.keys(assets).length} local assets.`);
