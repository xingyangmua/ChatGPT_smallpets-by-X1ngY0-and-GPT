import fs from 'node:fs';
import {mountWorkPet} from './runtime.mjs';

export const name='work-pet';
export const inject=[];

export function buildInjectionRows(config={}) {
  if(config.enabled===false)return [];
  // Package-owned files only: no DSH home, provider, token, account or chat reads.
  const image=(file,mime)=>`data:${mime};base64,${fs.readFileSync(new URL(file,import.meta.url)).toString('base64')}`;
  const options={
    petEnabled:config.petEnabled!==false,
    backgroundEnabled:config.backgroundEnabled!==false,
    opacity:Number.isFinite(config.opacity)?Math.max(0,Math.min(.8,config.opacity)):.28,
    pet:image('./assets/IMG3576.png','image/png'),
    background:image('./assets/IMG3575.jpg','image/jpeg'),
  };
  const payload=JSON.stringify(options).replaceAll('<','\\u003c');
  return [
    {kind:'style',text:fs.readFileSync(new URL('./style.css',import.meta.url),'utf8')},
    {kind:'script',placement:'body',text:`(${mountWorkPet.toString()})(${payload},globalThis);`},
  ];
}

export function apply(ctx,config={}) {
  // Register synchronously: desktop boot collects the table before optional
  // services arrive. Inline rows work in both browser and desktop interpreters.
  let rows;
  ctx.on('webserver/index-inject',table=>{
    if(!Array.isArray(table))return;
    try {rows??=buildInjectionRows(config);table.push(...rows);}
    catch {ctx.logger?.warn?.('Work Pet assets unavailable; decoration skipped.');}
  });
}
