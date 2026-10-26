import fs from 'node:fs';
import {bridgeRequest} from '../runtime/bridge.mjs';
const dataDir=process.argv[2];
const result=await bridgeRequest('/api/mutsumi-capture',{method:'POST',dataDir});
if(result.ok && result.file && process.argv[3])fs.copyFileSync(result.file,process.argv[3]);
if(result.ok && result.customizer?.file && process.argv[3])fs.copyFileSync(result.customizer.file,process.argv[3].replace(/\.png$/i,'-customizer.png'));
process.stdout.write(JSON.stringify(result));
