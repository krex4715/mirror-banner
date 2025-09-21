const { app, BrowserWindow, screen, globalShortcut, powerSaveBlocker, session } = require('electron')
const path = require('node:path')

// dev 판별: electron-is-dev는 ESM도 CJS도 동작
const isDev = !app.isPackaged

// AMD/Mesa 경고 회피 & 안정성
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('use-gl', 'swiftshader')
app.commandLine.appendSwitch('disable-gpu')
// (선택) 배경 비디오 자동재생 100% 보장
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

let win
let psbId

const wantKiosk = !isDev || process.env.MIRROR_KIOSK === '1' || app.commandLine.hasSwitch('kiosk')

async function createWindow () {
  const { bounds } = screen.getPrimaryDisplay()

  win = new BrowserWindow({
    x: 0, y: 0,
    width: bounds.width,
    height: bounds.height,
    backgroundColor: '#000000',
    show: false,
    frame: false,
    fullscreenable: true,
    autoHideMenuBar: true,
    skipTaskbar: true,
    kiosk: wantKiosk,
    webPreferences: {
      contextIsolation: true,
    }
  })

  const prodIndex = path.join(__dirname, '..', 'dist', 'index.html')

   try {
     if (isDev) {
       const devURL = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
       await win.loadURL(devURL)
     } else {
       await win.loadFile(prodIndex)
     }
   } catch (e) {
     console.error('Failed to load UI:', e)
     // 배포 환경에서 혹시라도 dev 분기로 들어갔을 때를 대비해 강제로 파일 로드 재시도
     try { await win.loadFile(prodIndex) } catch {}
   }

  win.once('ready-to-show', () => {
    win.show()
    if (!wantKiosk && !win.isFullScreen()) win.setFullScreen(true)
    setTimeout(() => {
      if (!wantKiosk && !win.isFullScreen()) win.setFullScreen(true)
    }, 100)
  })

  psbId = powerSaveBlocker.start('prevent-display-sleep')

  if (isDev) {
    globalShortcut.register('CommandOrControl+Shift+F', () => {
      if (win.isKiosk()) win.setKiosk(false)
      win.setFullScreen(!win.isFullScreen())
    })
    globalShortcut.register('CommandOrControl+Shift+K', () => {
      win.setKiosk(!win.isKiosk())
    })
  }
}

app.whenReady().then(async () => {
  // 카메라 권한 허용
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    if (permission === 'media') return true
    return true
  })
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media') { callback(true); return }
    callback(true)
  })

  await createWindow()
  if (isDev && win) win.webContents.openDevTools({ mode: 'detach' })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
app.on('will-quit', () => {
  if (psbId && powerSaveBlocker.isStarted(psbId)) powerSaveBlocker.stop(psbId)
  globalShortcut.unregisterAll()
})
