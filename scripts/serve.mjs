import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {handle} from '../worker/index.js';
const port=48321,root=path.resolve('public');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.txt':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,`http://127.0.0.1:${port}`);
  if(url.pathname==='/__mobile'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><meta charset="utf-8"><title>Wardrobe mobile preview</title><style>body{margin:0;background:#e8edf5;display:grid;place-items:center;height:100vh}iframe{width:390px;height:810px;border:1px solid white;border-radius:28px;box-shadow:0 20px 80px #43597730;background:white}</style><iframe title="Mobile Wardrobe Preview" src="/#' + (['home','closet','profile','weather','outfits','collections','planner','packing','insights'].includes(url.searchParams.get('view')) ? url.searchParams.get('view') : 'closet') + '"></iframe>');return}
  const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','local-owner');
  let body;if(!['GET','HEAD'].includes(req.method)){const chunks=[];let total=0;for await(const chunk of req){total+=chunk.length;if(total>16*1024*1024){res.writeHead(413).end();return}chunks.push(chunk)}body=Buffer.concat(chunks)}
  const request=new Request(url,{method:req.method,headers,...body?{body}: {}});let response;
  if(url.pathname.startsWith('/api/'))response=await handle(request,{DECART_API_KEY:process.env.DECART_API_KEY,GEMINI_API_KEY:process.env.GEMINI_API_KEY,GEMINI_MODEL:process.env.GEMINI_MODEL,GARMENT_RECOGNITION_URL:process.env.GARMENT_RECOGNITION_URL,GARMENT_RECOGNITION_KEY:process.env.GARMENT_RECOGNITION_KEY},{});
  else{const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}const bytes=await fs.readFile(file);response=new Response(req.method==='HEAD'?null:bytes,{headers:{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}})}
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
}catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found')}}).listen(port,'127.0.0.1',()=>console.log(`Wardrobe: http://127.0.0.1:${port}`));
