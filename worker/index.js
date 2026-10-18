import { recognize } from './recognition.js';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function handle(request,env,assets){
  const url=new URL(request.url);
  if(url.pathname==='/api/garments/status')return json({ready:!!env.DECART_API_KEY && !!(env.GEMINI_API_KEY || env.GARMENT_RECOGNITION_URL),recognitionReady:!!(env.GEMINI_API_KEY || env.GARMENT_RECOGNITION_URL)});
  if(url.pathname==='/api/garments/render'){
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    if(!request.headers.get('oai-authenticated-user-id'))return json({error:'Sign in to process garments.'},401);
    if(request.headers.get('origin')!==url.origin)return json({error:'Origin not allowed'},403);
    if(!env.DECART_API_KEY || !(env.GEMINI_API_KEY || env.GARMENT_RECOGNITION_URL))return json({error:'Garment processing is not connected.',code:'NOT_CONFIGURED'},503);
    if(Number(request.headers.get('content-length')||0)>16*1024*1024)return json({error:'Photo is too large.'},413);
    try{
      const input=await request.formData(),image=input.get('image');
      if(!(image instanceof Blob)||!/^image\/(jpeg|png|webp)$/.test(image.type)||image.size>15*1024*1024)return json({error:'Choose a garment photo under 15 MB.'},400);
      const metadata=await recognize(image,env);
      const form=new FormData();form.append('data',image,'garment.webp');form.append('resolution','720p');form.append('enhance_prompt','false');
      form.append('prompt','Identify and extract only the single main clothing garment in this image. Remove the person, body, hanger, background, screenshot borders, buttons, labels and all interface elements. Recreate this exact garment as a premium photorealistic 3D apparel product render, front view, with natural fabric volume, realistic folds and fine texture. Preserve its exact cut, colors, print, logos and details. Center the complete garment with generous empty margins against a uniform pure white background. No human, no mannequin, no text, no frame, no collage. Do not invent a different garment.');
      const upstream=await fetch('https://api.decart.ai/v1/generate/lucy-image-latest',{method:'POST',headers:{'X-API-KEY':env.DECART_API_KEY},body:form,signal:AbortSignal.timeout(120000)});
      if(!upstream.ok||!upstream.headers.get('content-type')?.startsWith('image/'))return json({error:'The garment render could not complete. Your original photo is saved.'},502);
      return new Response(upstream.body,{headers:{'Content-Type':upstream.headers.get('content-type'),'Cache-Control':'no-store','X-Garment-Metadata':encodeURIComponent(JSON.stringify(metadata)),'X-Content-Type-Options':'nosniff'}});
    }catch{return json({error:'Garment processing was interrupted. Your original photo is saved.'},502)}
  }
  if(url.pathname==='/api/lucy/status')return json({ready:!!env.DECART_API_KEY});
  if(url.pathname==='/api/lucy/token'){
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    if(!request.headers.get('oai-authenticated-user-id'))return json({error:'Sign in to use Try-On.'},401);
    if(request.headers.get('origin')!==url.origin)return json({error:'Origin not allowed'},403);
    if(!env.DECART_API_KEY)return json({error:'Lucy is not configured.'},503);
    try{
      const upstream=await fetch('https://api.decart.ai/v1/client/tokens',{
        method:'POST',headers:{'X-API-KEY':env.DECART_API_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({expiresIn:60,allowedModels:['lucy-vton-latest','lucy-vton-3.6'],allowedOrigins:[url.origin]}),
        signal:AbortSignal.timeout(15000)
      });
      if(!upstream.ok)return json({error:'Lucy could not create a session.'},502);
      const token=await upstream.json();
      if(typeof token.apiKey!=='string'||token.apiKey===env.DECART_API_KEY)return json({error:'Invalid session credential.'},502);
      return json({apiKey:token.apiKey,expiresAt:token.expiresAt});
    }catch{return json({error:'Lucy is unavailable. Please try again.'},502)}
  }
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
  let path;try{path=decodeURIComponent(url.pathname)}catch{return new Response('Bad request',{status:400})}
  const key=path==='/'?'/index.html':path;
  const file=assets[key];if(!file)return new Response('Not found',{status:404});
  const bytes=Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0));
  return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':file.type,'Cache-Control':key==='/index.html'?'no-cache':'public, max-age=3600','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(self), microphone=()'}});
}
