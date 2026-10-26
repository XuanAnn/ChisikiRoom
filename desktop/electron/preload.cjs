const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('chisiki', {
  request: (action, body) => ipcRenderer.invoke('api', action, body),
  openWindow: (kind, id) => ipcRenderer.invoke('open-window', kind, id),
  connection: () => ipcRenderer.invoke('connection'),
  notifyIncoming: (callId) => ipcRenderer.invoke('incoming-notify', callId),
  respondIncoming: (callId, decision) => ipcRenderer.invoke('incoming-response', callId, decision),
  avatar: (userId) => ipcRenderer.invoke('avatar', userId),
  uploadAvatar: () => ipcRenderer.invoke('upload-avatar'),
  serverSettings: (value) => ipcRenderer.invoke('server-settings', value),
  uploadDocument: (roomId) => ipcRenderer.invoke('upload-document', roomId),
  downloadDocument: (id, filename) => ipcRenderer.invoke('download-document', id, filename),
  setDirty: (dirty) => ipcRenderer.send('dirty', Boolean(dirty)),
  onEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('event', listener);
    return () => ipcRenderer.removeListener('event', listener);
  },
});
