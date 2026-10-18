import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../worker/index.js';
import {handleVercel} from '../runtime/vercel-handler.js';
const origin='https://wardrobe.example';
const request=(path,opts={})=>new Request(origin+path,opts);
test('AI status reports missing credentials without claiming readiness',async()=>{
  assert.equal((await (await handle(request('/api/garments/status'),{},{})).json()).ready,false);
  assert.equal((await (await handle(request('/api/lucy/status'),{},{})).json()).ready,false);
});
test('Token minting requires identity, same origin, and a configured secret',async()=>{
  assert.equal((await handle(request('/api/lucy/token',{method:'POST'}),{},{})).status,401);
  assert.equal((await handle(request('/api/lucy/token',{method:'POST',headers:{'oai-authenticated-user-id':'owner',origin:'https://other.example'}}),{},{})).status,403);
  assert.equal((await handle(request('/api/lucy/token',{method:'POST',headers:{'oai-authenticated-user-id':'owner',origin}}),{},{})).status,503);
});
test('Garment processing has the same access boundary and no fake result',async()=>{
  assert.equal((await handle(request('/api/garments/render',{method:'POST'}),{},{})).status,401);
  assert.equal((await handle(request('/api/garments/render',{method:'POST',headers:{'oai-authenticated-user-id':'owner',origin}}),{},{})).status,503);
});
test('Private Vercel endpoints reject a forged platform identity',async()=>{
  assert.equal((await handleVercel(request('/api?route=lucy/token',{method:'POST',headers:{'oai-authenticated-user-id':'forged',origin}}),{WARDROBE_PASSWORD:'test-only-password'})).status,401);
});
test('Vercel password exchange creates a signed, HttpOnly session',async()=>{
  const env={WARDROBE_PASSWORD:'test-only-password'};
  const denied=await handleVercel(request('/api/session',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({password:'wrong'})}),env);assert.equal(denied.status,401);
  const ok=await handleVercel(request('/api/session',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({password:env.WARDROBE_PASSWORD})}),env);assert.equal(ok.status,200);
  const cookie=ok.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
  assert.equal((await (await handleVercel(request('/api?route=lucy/status',{headers:{cookie}}),env)).json()).locked,false);
  assert.equal((await (await handleVercel(request('/api?route=lucy/status',{headers:{cookie:cookie.replace('wardrobe_session=','wardrobe_session=x')}}),env)).json()).locked,true);
});
test('Static assets have the correct type and unknown paths return 404',async()=>{
  const assets={'/index.html':{base64:btoa('<h1>Wardrobe</h1>'),type:'text/html'}};
  const r=await handle(request('/'),{},assets);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/html/);assert.equal(await r.text(),'<h1>Wardrobe</h1>');assert.equal((await handle(request('/missing'),{},assets)).status,404);
});
