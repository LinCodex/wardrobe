import {handle} from '../worker/index.js';
const enc=new TextEncoder();
const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
async function sign(value,password){const key=await crypto.subtle.importKey('raw',enc.encode(password),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(value))))}
function equal(a,b){if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
async function validSession(request,password){if(!password)return false;const cookie=request.headers.get('cookie')||'',token=cookie.match(/(?:^|;\s*)wardrobe_session=([^;]+)/)?.[1];if(!token)return false;const [expiry,signature]=token.split('.');return Number(expiry)>Date.now()&&signature&&equal(signature,await sign(expiry,password))}
const attempts=new Map();
export async function handleVercel(request,env){
  const url=new URL(request.url),route=url.searchParams.get('route');if(route){url.pathname='/api/'+route;url.searchParams.delete('route')}
  if(url.pathname==='/api/session'){
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    if(request.headers.get('origin')!==url.origin)return json({error:'Origin not allowed'},403);
    if(!env.WARDROBE_PASSWORD)return json({error:'The wardrobe password has not been configured.'},503);
    const ip=request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown',now=Date.now(),limit=attempts.get(ip)||{count:0,until:now+900000};if(now>limit.until){limit.count=0;limit.until=now+900000}if(limit.count>=10)return json({error:'Please wait before trying again.'},429);
    let body;try{body=await request.json()}catch{return json({error:'Invalid request'},400)}
    const input=typeof body.password==='string'?body.password:'';if(!input||input.length>512)return json({error:'Incorrect password'},401);
    const [actual,expected]=await Promise.all([sign('wardrobe-password-check',input),sign('wardrobe-password-check',env.WARDROBE_PASSWORD)]);
    if(!equal(actual,expected)){limit.count++;attempts.set(ip,limit);return json({error:'Incorrect password'},401)}
    attempts.delete(ip);const expiry=String(now+86400000),signature=await sign(expiry,env.WARDROBE_PASSWORD);
    return json({ok:true},200,{'Set-Cookie':`wardrobe_session=${expiry}.${signature}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`});
  }
  const unlocked=await validSession(request,env.WARDROBE_PASSWORD);
  if(url.pathname.endsWith('/status')){
    const response=await handle(new Request(url,{method:'GET'}),env,{});const body=await response.json();return json({...body,ready:body.ready&&!!env.WARDROBE_PASSWORD,requiresPassword:body.ready&&!env.WARDROBE_PASSWORD,locked:!!env.WARDROBE_PASSWORD&&!unlocked});
  }
  if(!unlocked)return json({error:'Unlock your wardrobe to continue.',code:'LOCKED'},401);
  const headers=new Headers(request.headers);headers.delete('oai-authenticated-user-id');headers.delete('oai-authenticated-user-email');headers.set('oai-authenticated-user-id','wardrobe-owner');
  const forwarded=new Request(url,{method:request.method,headers,...['GET','HEAD'].includes(request.method)?{}:{body:request.body,duplex:'half'}});
  return handle(forwarded,env,{});
}
