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
test('Public Vercel endpoints still reject cross-origin requests',async()=>{
  assert.equal((await handleVercel(request('/api?route=lucy/token',{method:'POST',headers:{'oai-authenticated-user-id':'forged',origin:'https://other.example'}}),{DECART_API_KEY:'server-test-key'})).status,403);
});
test('Vercel mints a short-lived Lucy token without a password or cookie',async t=>{
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(url,'https://api.decart.ai/v1/client/tokens');
    assert.equal(options.headers['X-API-KEY'],'server-test-key');
    const body=JSON.parse(options.body);assert.equal(body.expiresIn,60);assert.deepEqual(body.allowedOrigins,[origin]);
    return Response.json({apiKey:'short-lived-test-token',expiresAt:12345});
  });
  const response=await handleVercel(request('/api?route=lucy/token',{method:'POST',headers:{origin}}),{DECART_API_KEY:'server-test-key'});
  assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null);
  const body=await response.json();assert.equal(body.apiKey,'short-lived-test-token');assert.equal(JSON.stringify(body).includes('server-test-key'),false);
});
test('The removed session route cannot create a login session',async()=>{
  const response=await handleVercel(request('/api?route=session',{method:'POST',headers:{origin},body:'{}'}),{});
  assert.equal(response.status,404);assert.equal(response.headers.get('set-cookie'),null);
});
test('Static assets have the correct type and unknown paths return 404',async()=>{
  const assets={'/index.html':{base64:btoa('<h1>Wardrobe</h1>'),type:'text/html'}};
  const r=await handle(request('/'),{},assets);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/html/);assert.equal(await r.text(),'<h1>Wardrobe</h1>');assert.equal((await handle(request('/missing'),{},assets)).status,404);
});
