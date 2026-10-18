// Validate again in the browser before cutting any saved photo.
const area=points=>Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1]},0))/2;
export function validateMask(value){
  let count=0;
  const read=(contours,required=false)=>{
    if(!Array.isArray(contours)||contours.length>8||(required&&!contours.length))throw Error('A precise garment outline was not returned.');
    return contours.map(points=>{
      if(!Array.isArray(points)||points.length<3||points.length>1024)throw Error('The garment outline is incomplete.');
      count+=points.length;if(count>4096)throw Error('The garment outline is too complex.');
      const clean=points.map(p=>{if(!Array.isArray(p)||p.length!==2||p.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>1000))throw Error('The garment outline has invalid coordinates.');return [p[0],p[1]]});
      if(area(clean)<1)throw Error('The garment outline is empty.');return clean;
    });
  };
  const polygons=read(value?.polygons,true),holes=read(value?.holes??[]),coverage=polygons.reduce((s,p)=>s+area(p),0)-holes.reduce((s,p)=>s+area(p),0);
  if(coverage<500||coverage>980000)throw Error('The garment could not be separated safely from this photo.');
  const points=polygons.flat(),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  return {polygons,holes,bounds:{left:Math.min(...xs),top:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)}};
}
export async function createGarmentCutout(blob,geometry){
  const {polygons,holes,bounds}=validateMask(geometry),image=await createImageBitmap(blob);
  try{
    const width=image.width,height=image.height;if(!width||!height||width*height>20000000)throw Error('This photo is too large to process.');
    const mask=document.createElement('canvas');mask.width=width;mask.height=height;const context=mask.getContext('2d');
    const draw=points=>{context.beginPath();points.forEach(([x,y],i)=>context[i?'lineTo':'moveTo'](x*width/1000,y*height/1000));context.closePath();context.fill()};
    context.fillStyle='#fff';polygons.forEach(draw);context.globalCompositeOperation='destination-out';holes.forEach(draw);
    const crop={x:Math.floor(bounds.left*width/1000),y:Math.floor(bounds.top*height/1000),width:Math.ceil((bounds.right-bounds.left)*width/1000),height:Math.ceil((bounds.bottom-bounds.top)*height/1000)};
    const size=Math.min(1200,Math.max(512,Math.ceil(Math.max(crop.width,crop.height)*1.12))),output=document.createElement('canvas');output.width=size;output.height=size;
    const ctx=output.getContext('2d',{willReadFrequently:true}),scale=size*.88/Math.max(crop.width,crop.height),w=crop.width*scale,h=crop.height*scale,x=(size-w)/2,y=(size-h)/2;
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,crop.x,crop.y,crop.width,crop.height,x,y,w,h);
    ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,crop.x,crop.y,crop.width,crop.height,x,y,w,h);
    const pixels=ctx.getImageData(0,0,size,size).data;let visible=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>127)visible++;
    if(visible<size*size*.0005)throw Error('The cutout was empty. Your original photo is safe.');
    const result=await new Promise(resolve=>output.toBlob(resolve,'image/png'));if(!result)throw Error('The garment cutout could not be saved.');return result;
  }finally{image.close()}
}
