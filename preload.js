const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('malang', {
  load: () => ipcRenderer.sendSync('load-sync'),
  save: (data) => ipcRenderer.sendSync('save-sync', data),
  setIgnore: (ignore) => ipcRenderer.send('set-ignore', ignore),
  setTrayIcon: (dataUrl) => ipcRenderer.send('tray-icon', dataUrl),
  themeChanged: (theme) => ipcRenderer.send('theme-changed', theme),
  prefsChanged: (prefs) => ipcRenderer.send('prefs-changed', prefs),
  onCommand: (cb) => ipcRenderer.on('command', (_e, command) => cb(command)),
});
