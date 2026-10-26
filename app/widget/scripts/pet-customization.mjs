import {bridgeRequest} from '../runtime/bridge.mjs';
const [dataDir,action='state']=process.argv.slice(2);
if(!['state','reload','client','widget','close','widget-on','widget-off','health'].includes(action))throw Error('Unsupported local picture operation');
const result=await bridgeRequest('/api/mutsumi-customization',{method:'POST',body:{action},dataDir});
process.stdout.write(JSON.stringify(result));if(!result.ok)process.exitCode=1;
