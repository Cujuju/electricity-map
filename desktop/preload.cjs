const { contextBridge, ipcRenderer } = require('electron');

// Narrow bridge, following Spillway's wrapped subscriptions; no raw IPC is exposed.
contextBridge.exposeInMainWorld('electricityDesktop', {
  platform: process.platform,
  minimize: () => ipcRenderer.send('electricity:window:minimize'),
  toggleMaximize: () => ipcRenderer.send('electricity:window:toggle-maximize'),
  close: () => ipcRenderer.send('electricity:window:close'),
  showMenu: () => ipcRenderer.send('electricity:window:menu'),
  getWindowState: () => ipcRenderer.invoke('electricity:window:state'),
  onMaximized: (callback) => {
    const listener = (_event, maximized) => callback(maximized === true);
    ipcRenderer.on('electricity:window:maximized', listener);
    return () => ipcRenderer.removeListener('electricity:window:maximized', listener);
  },
});
