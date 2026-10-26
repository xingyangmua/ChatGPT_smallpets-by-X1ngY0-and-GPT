const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('mutsumiCustomizer',{
 request:command=>ipcRenderer.invoke('mutsumi-customizer',command),
 onState:callback=>ipcRenderer.on('mutsumi-customizer-state',(_event,value)=>callback(value)),
});
