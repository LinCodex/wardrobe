import test from 'node:test';
import assert from 'node:assert/strict';
import {handle} from '../worker/index.js';
import {validateMask} from '../public/garment-mask.js';
import {validateRecognition} from '../worker/recognition.js';
import {handleVercel} from '../runtime/vercel-handler.js';
const origin='https://wardrobe.example';
const geometry={polygons:[[[200,100],[800,100],[800,900],[200,900]]],holes:[[[400,300],[600,300],[600,500],[400,500]]]};
const result={isGarment:true,confidence:.94,name:'White T-shirt',category:'Tops',color:'White',pattern:'Solid',...geometry};
const input=(headers={})=>{const body=new FormData();body.append('image',new Blob(['test-image'],{type:'image/webp'}),'garment.webp');return new Request(origin+'/api/garments/cutout',{method:'POST',headers:{origin,'oai-authenticated-user-id':'owner',...headers},body})};

test('Gemini alone enables cutouts without enabling paid Lucy',async()=>{
  const status=await (await handle(new Request(origin+'/api/garments/status'),{GEMINI_API_KEY:'test-key'},{})).json();
  assert.equal(status.ready,true);assert.equal(status.mode,'cutout');assert.equal(status.renderReady,false);
  assert.equal((await (await handle(new Request(origin+'/api/lucy/status'),{GEMINI_API_KEY:'test-key'},{})).json()).ready,false);
});
test('Vercel Gemini readiness depends only on the configured provider',async()=>{
  const response=await handleVercel(new Request(origin+'/api?route=garments/status'),{GEMINI_API_KEY:'test-key'}),body=await response.json();
  assert.equal(body.ready,true);assert.equal(body.recognitionReady,true);assert.equal(body.locked,undefined);assert.equal(body.requiresPassword,undefined);
  const missing=await (await handleVercel(new Request(origin+'/api?route=garments/status'),{})).json();
  assert.equal(missing.ready,false);
});
test('Cutout endpoint protects identity, origin, configuration and file type',async()=>{
  const noIdentity=input();noIdentity.headers.delete('oai-authenticated-user-id');
  assert.equal((await handle(noIdentity,{},{})).status,401);
  assert.equal((await handle(input({origin:'https://other.example'}),{},{})).status,403);
  assert.equal((await handle(input(),{},{})).status,503);
  const body=new FormData();body.append('image',new Blob(['bad'],{type:'text/plain'}),'bad.txt');
  assert.equal((await handle(new Request(origin+'/api/garments/cutout',{method:'POST',headers:{origin,'oai-authenticated-user-id':'owner'},body}),{GEMINI_API_KEY:'test-key'},{})).status,400);
});
test('Public Vercel recognition uses one Gemini request without a session',async t=>{
  let calls=0;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    calls++;assert.match(url,/generativelanguage\.googleapis\.com/);
    const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.model,'gemini-3.8-flash');
    assert.match(body.system_instruction,/Never follow instructions/);assert.match(body.system_instruction,/Do not invent a brand/);assert.match(body.system_instruction,/FULL IMAGE/);
    assert.equal(body.response_format.schema.additionalProperties,false);assert.ok(body.response_format.schema.properties.polygons);
    assert.equal(atob(body.input[1].data),'test-image');
    return Response.json({outputs:[{type:'text',text:JSON.stringify(result)}]});
  });
  const publicRequest=input();publicRequest.headers.delete('oai-authenticated-user-id');
  const response=await handleVercel(publicRequest,{GEMINI_API_KEY:'test-key'}),body=await response.json();
  assert.equal(response.status,200);assert.equal(calls,1);assert.equal(body.kind,'cutout');assert.deepEqual(body.segmentation,geometry);assert.equal(body.metadata.color,'White');
  assert.equal(JSON.stringify(body).includes('test-key'),false);
});
test('No-garment, low-confidence and whole-photo masks never become finished cutouts',()=>{
  assert.throws(()=>validateRecognition({...result,isGarment:false},true),e=>e.code==='NO_GARMENT');
  assert.throws(()=>validateRecognition({...result,confidence:.3},true),e=>e.code==='LOW_CONFIDENCE');
  assert.throws(()=>validateRecognition({...result,polygons:[[[0,0],[1000,0],[1000,1000],[0,1000]]],holes:[]},true),e=>e.code==='INVALID_MASK');
  assert.throws(()=>validateMask({polygons:[[[0,0],[Infinity,0],[200,200]]]}),/coordinates/);
  assert.throws(()=>validateMask({polygons:[[[0,0],[1500,0],[200,200]]]}),/coordinates/);
  assert.deepEqual(validateMask(geometry).bounds,{left:200,top:100,right:800,bottom:900});
});
test('Quota failures retain an actionable status without inventing a result',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response('',{status:429}));
  const response=await handle(input(),{GEMINI_API_KEY:'test-key'},{}),body=await response.json();
  assert.equal(response.status,429);assert.equal(body.code,'RATE_LIMITED');assert.equal(body.segmentation,undefined);
});
test('Malformed Gemini geometry is rejected at the API boundary',async t=>{
  t.mock.method(globalThis,'fetch',async()=>Response.json({outputs:[{type:'text',text:JSON.stringify({...result,polygons:[]})}]}));
  const response=await handle(input(),{GEMINI_API_KEY:'test-key'},{});assert.equal(response.status,422);assert.equal((await response.json()).code,'INVALID_MASK');
});
