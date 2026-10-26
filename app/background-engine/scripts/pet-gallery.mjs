import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {readImageMetadata} from './image-metadata.mjs';
export async function loadMutsumiGallery(installRoot){
 const images=[],names=[],ids=[];
 for(const [i,n] of [3575].entries()){
  const bytes=await fs.readFile(path.join(installRoot,'backgrounds',`IMG${n}.jpg`));if(!bytes.length||bytes.length>10*1024*1024)throw Error('Invalid preset image');
  images.push('data:image/jpeg;base64,'+bytes.toString('base64'));names.push(['蓝天草地'][i]);ids.push('preset-'+n);
 }
 let config=null;try{config=JSON.parse((await fs.readFile(path.join(installRoot,'data/mutsumi-customization.json'),'utf8')).replace(/^\uFEFF/,''));}catch(error){if(error.code!=='ENOENT')throw error;}
 const client=config?.version===1?config.client:null;
 if(client){
  if(!Array.isArray(client.images)||client.images.length>12)throw Error('Invalid custom gallery');
  for(const image of client.images){
   if(!/^[a-f0-9]{64}$/.test(image?.id)||!new RegExp('^'+image.id+'\\.(png|jpg|webp)$').test(image.file)||typeof image.name!=='string'||image.name.length>120)throw Error('Invalid custom gallery item');
   const file=path.join(installRoot,'data/custom-images',image.file),stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>10*1024*1024)throw Error('Invalid custom image file');
   const bytes=await fs.readFile(file),ext=path.extname(file),size=readImageMetadata(bytes,ext);if(createHash('sha256').update(bytes).digest('hex')!==image.id)throw Error('Custom image changed');if(!size?.width||!size.height||size.width>16384||size.height>16384||size.width*size.height>50000000)throw Error('Invalid custom image dimensions');
   images.push('data:image/'+({'.jpg':'jpeg','.png':'png','.webp':'webp'}[ext])+';base64,'+bytes.toString('base64'));names.push(image.name);ids.push(image.id);
  }
 }
 return {images,settings:{names,ids,selectedId:client?.selectedId,selectionRevision:client?.selectionRevision||'',resetVisuals:client?.resetVisuals===true}};
}
