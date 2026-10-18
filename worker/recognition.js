import {GARMENT_RULES,GARMENT_REQUEST,garmentSchema} from './garment-prompt.js';
import {validateMask} from '../public/garment-mask.js';
export class RecognitionError extends Error{constructor(message,status=502,code='PROCESSING_FAILED'){super(message);this.status=status;this.code=code}}
export async function recognize(image,env,{cutout=false}={}){
  let value;
  if(env.GARMENT_RECOGNITION_URL){
    const url=new URL(env.GARMENT_RECOGNITION_URL);if(url.protocol!=='https:')throw new RecognitionError('Recognition endpoint must use HTTPS.',503,'NOT_CONFIGURED');
    const form=new FormData();form.append('image',image,'garment.webp');if(cutout)form.append('task','cutout');
    const response=await fetch(url,{method:'POST',headers:env.GARMENT_RECOGNITION_KEY?{Authorization:`Bearer ${env.GARMENT_RECOGNITION_KEY}`}:{},body:form,signal:AbortSignal.timeout(60000)});
    if(!response.ok)throw new RecognitionError('Recognition is unavailable. Your original photo is saved.');value=await response.json();
  }else{
    if(!env.GEMINI_API_KEY)throw new RecognitionError('Connect Gemini to process this photo.',503,'NOT_CONFIGURED');
    const bytes=new Uint8Array(await image.arrayBuffer());let raw='';for(let n=0;n<bytes.length;n+=32768)raw+=String.fromCharCode(...bytes.subarray(n,n+32768));
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/interactions',{
      method:'POST',headers:{'x-goog-api-key':env.GEMINI_API_KEY,'Content-Type':'application/json'},signal:AbortSignal.timeout(60000),
      body:JSON.stringify({model:env.GEMINI_MODEL||'gemini-3.8-flash',store:false,system_instruction:GARMENT_RULES,
        input:[{type:'text',text:cutout?GARMENT_REQUEST:'Identify the main wearable item. Return its concise name, category, dominant color, visible pattern and confidence. Do not return segmentation.'},{type:'image',data:btoa(raw),mime_type:image.type}],
        generation_config:{thinking_level:'minimal'},response_format:{type:'text',mime_type:'application/json',schema:garmentSchema(cutout)}})
    });
    if(response.status===429)throw new RecognitionError('Gemini reached its usage limit. Try again later.',429,'RATE_LIMITED');
    if([401,403].includes(response.status))throw new RecognitionError('Gemini could not authenticate. Check its server key.',503,'PROVIDER_AUTH');
    if(!response.ok)throw new RecognitionError('Gemini could not process this photo. Your original is saved.');
    const output=await response.json(),text=output.output_text||[...(output.outputs||[]),...(output.output||[])].filter(x=>x.type==='text').map(x=>x.text).join('');
    try{value=JSON.parse(text)}catch{throw new RecognitionError('Gemini did not return a usable garment outline.',422,'INVALID_RESULT')}
  }
  return validateRecognition(value,cutout);
}
export function validateRecognition(value,cutout=false){
  if(!value||value.isGarment!==true)throw new RecognitionError('No clear garment was found. Try a closer photo.',422,'NO_GARMENT');
  if(cutout&&(typeof value.confidence!=='number'||!Number.isFinite(value.confidence)||value.confidence<.6||value.confidence>1))throw new RecognitionError('This garment is hard to separate. Try a clearer photo.',422,'LOW_CONFIDENCE');
  if(typeof value.name!=='string'||!value.name.trim())throw new RecognitionError('Recognition did not identify a garment.',422,'INVALID_RESULT');
  const metadata={name:value.name.trim().slice(0,70),category:['Tops','Bottoms','Outerwear','Dresses','Shoes','Accessories','Other'].includes(value.category)?value.category:'Other',color:typeof value.color==='string'?value.color.trim().slice(0,35):'',pattern:typeof value.pattern==='string'?value.pattern.trim().slice(0,60):''};
  if(!cutout)return metadata;
  try{const geometry=validateMask(value);return {metadata,segmentation:{polygons:geometry.polygons,holes:geometry.holes},confidence:value.confidence}}catch(err){throw new RecognitionError(err.message,422,'INVALID_MASK')}
}
