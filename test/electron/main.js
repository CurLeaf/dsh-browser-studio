// Minimal Electron host for the webview spike: no DSH involved, just the same
// Electron major (44.7) and the same <webview> element.
const { app, BrowserWindow } = require('electron')
const path = require('node:path')

app.commandLine.appendSwitch('disable-gpu')
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    webPreferences: { webviewTag: true, contextIsolation: true, sandbox: false },
  })
  win.loadFile(path.join(__dirname, 'host.html'))
})

app.on('window-all-closed', () => app.quit())
