// Validate again in the browser before cutting any saved photo.
const area=points=>Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1]},0))/2;

export function normalizeRawContours(input, required=false) {
  let contours = input;
  if (!contours && input?.polygons) contours = input.polygons;
  if (!contours && input?.boxes && Array.isArray(input.boxes)) {
    const box = input.boxes[0];
    if (box?.mask && Array.isArray(box.mask)) {
      contours = [box.mask.map(p => Array.isArray(p) ? [p[1], p[0]] : [p.x ?? 0, p.y ?? 0])];
    } else if (box?.box_2d && Array.isArray(box.box_2d)) {
      const [y1, x1, y2, x2] = box.box_2d;
      contours = [[[x1, y1], [x2, y1], [x2, y2], [x1, y2]]];
    }
  }
  if (!Array.isArray(contours) || (required && !contours.length) || contours.length > 8) {
    if (required) throw Error('A precise garment outline was not returned.');
    return [];
  }
  if (!contours.length) return [];
  if (Array.isArray(contours[0]) && (typeof contours[0][0] === 'number' || (contours[0] && typeof contours[0].x === 'number'))) {
    contours = [contours];
  }
  return contours;
}

export function validateMask(value){
  let count=0;
  const rawPolygons = normalizeRawContours(value?.polygons || value, true);
  const rawHoles = normalizeRawContours(value?.holes || [], false);

  const read=(contours, required=false)=>{
    if (!Array.isArray(contours) || (required && !contours.length) || contours.length > 8) {
      if (required) throw Error('A precise garment outline was not returned.');
      return [];
    }
    return contours.map(points=>{
      if (!Array.isArray(points) || points.length < 3 || points.length > 1024) throw Error('The garment outline is incomplete.');
      count += points.length;
      if (count > 4096) throw Error('The garment outline is too complex.');
      let maxCoord = 0;
      for (const p of points) {
        const x = typeof p === 'object' && !Array.isArray(p) ? p.x : (Array.isArray(p) ? p[0] : null);
        const y = typeof p === 'object' && !Array.isArray(p) ? p.y : (Array.isArray(p) ? p[1] : null);
        if (typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)) {
          throw Error('The garment outline has invalid coordinates.');
        }
        if (x < 0 || y < 0 || x > 1000 || y > 1000) {
          throw Error('The garment outline has invalid coordinates.');
        }
        if (x > maxCoord) maxCoord = x;
        if (y > maxCoord) maxCoord = y;
      }
      const scale = (maxCoord > 0 && maxCoord <= 1.05) ? 1000 : 1;
      const clean = points.map(p => {
        const x = (typeof p === 'object' && !Array.isArray(p) ? p.x : p[0]) * scale;
        const y = (typeof p === 'object' && !Array.isArray(p) ? p.y : p[1]) * scale;
        return [Math.round(x), Math.round(y)];
      });
      if (area(clean) < 1) throw Error('The garment outline is empty.');
      return clean;
    });
  };

  const polygons = read(rawPolygons, true);
  const holes = read(rawHoles, false);
  const coverage = polygons.reduce((s, p) => s + area(p), 0) - holes.reduce((s, p) => s + area(p), 0);
  if (coverage < 500 || coverage > 980000) throw Error('The garment could not be separated safely from this photo.');
  const points = polygons.flat(), xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  return {
    polygons,
    holes,
    bounds: {
      left: Math.min(...xs),
      top: Math.min(...ys),
      right: Math.max(...xs),
      bottom: Math.max(...ys)
    }
  };
}

export async function createGarmentCutout(blob,geometry){
  let maskData;
  try {
    maskData = validateMask(geometry);
  } catch {
    return fallbackTransparentCutout(blob);
  }
  const {polygons,holes,bounds} = maskData;
  const image = await createImageBitmap(blob);
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
    if(visible<size*size*.0005)return fallbackTransparentCutout(blob);
    const result=await new Promise(resolve=>output.toBlob(resolve,'image/png'));if(!result)throw Error('The garment cutout could not be saved.');return result;
  }finally{image.close()}
}

async function fallbackTransparentCutout(blob){
  const image=await createImageBitmap(blob);
  try{
    const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
    const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,c.width,c.height),a=pixels.data,w=c.width,h=c.height,visited=new Uint8Array(w*h),queue=new Int32Array(w*h);
    let head=0,tail=0;
    const add=n=>{if(n<0||n>=w*h||visited[n])return;visited[n]=1;const x=n*4;if(a[x]>240&&a[x+1]>240&&a[x+2]>240){queue[tail++]=n;a[x+3]=0}};
    for(let x=0;x<w;x++){add(x);add((h-1)*w+x)}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1)}
    while(head<tail){const n=queue[head++];if(n%w)add(n-1);if(n%w<w-1)add(n+1);add(n-w);add(n+w)}
    ctx.putImageData(pixels,0,0);
    const res=await new Promise(resolve=>c.toBlob(resolve,'image/png'));
    return res||blob;
  }finally{image.close()}
}
