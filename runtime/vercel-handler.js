import {handle} from '../worker/index.js';
const routes=new Set(['/api/garments/status','/api/garments/cutout','/api/garments/render','/api/lucy/status','/api/lucy/token']);
export async function handleVercel(request,env){
  const url=new URL(request.url),route=url.searchParams.get('route');
  if(route){url.pathname='/api/'+route;url.searchParams.delete('route')}
  if(!routes.has(url.pathname))return Response.json({error:'Not found'},{status:404,headers:{'Cache-Control':'no-store'}});
  // The public app has no password or session gate. Provider secrets remain server-side.
  // This internal marker supplies the shared handler's adapter context, not user identity.
  const headers=new Headers(request.headers);
  headers.delete('oai-authenticated-user-id');headers.delete('oai-authenticated-user-email');
  headers.set('oai-authenticated-user-id','wardrobe-web');
  const forwarded=new Request(url,{method:request.method,headers,...['GET','HEAD'].includes(request.method)?{}:{body:request.body,duplex:'half'}});
  return handle(forwarded,env,{});
}
