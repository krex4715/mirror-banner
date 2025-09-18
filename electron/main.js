import { app, BrowserWindow, screen, globalShortcut, powerSaveBlocker, session } from 'electron'

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import isDev from 'electron-is-dev'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let win
let psbId

// GPU 초기화 이슈 회피(AMD/Mesa 경고 방지)
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('use-gl', 'swiftshader')
app.commandLine.appendSwitch('disable-gpu')

// prod 기본은 kiosk/전체화면, dev에서는 토글 가능하게
const wantKiosk =
  !isDev || process.env.MIRROR_KIOSK === '1' || app.commandLine.hasSwitch('kiosk')

async function createWindow() {
  const { bounds } = screen.getPrimaryDisplay()

  win = new BrowserWindow({
    x: 0, y: 0,
    width: bounds.width,
    height: bounds.height,
    backgroundColor: '#000000',
    show: false,                 // ready-to-show에서 보여주기
    frame: false,                // 테두리/제목줄 제거 (진짜 배너 느낌)
    fullscreenable: true,
    autoHideMenuBar: true,
    skipTaskbar: true,
    kiosk: wantKiosk,            // ← 키오스크 모드(ESC/Alt+F4로 안 나감)
    webPreferences: {
      contextIsolation: true,
    }
  })

  // 개발/프로덕션 로드
  const prodIndex = path.join(__dirname, '..', 'dist', 'index.html')
  if (isDev) {
    await win.loadURL('http://localhost:5173')
  } else {
    await win.loadFile(prodIndex)
  }

  // 창 보여주면서 확실히 전체화면 진입 (일부 WM에서 필요)
  win.once('ready-to-show', () => {
    win.show()
    if (!wantKiosk && !win.isFullScreen()) {
      win.setFullScreen(true)    // kiosk가 아닐 때 강제 전체화면
    }
    // 혹시 한 번 더 보정(특정 WM용)
    setTimeout(() => {
      if (!wantKiosk && !win.isFullScreen()) win.setFullScreen(true)
    }, 100)
  })

  // 화면 꺼짐 방지
  psbId = powerSaveBlocker.start('prevent-display-sleep')

  // 🔧 개발 편의: 전체화면/키오스크 토글 단축키
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
  // 권한 체크/요청시 media는 허용
  session.defaultSession.setPermissionCheckHandler((_wc, permission, _origin, details) => {
    if (permission === 'media') return true
    return true
  })
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'media') { callback(true); return }
    callback(true)
  })

  await createWindow()
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
app.on('will-quit', () => {
  if (psbId && powerSaveBlocker.isStarted(psbId)) powerSaveBlocker.stop(psbId)
  globalShortcut.unregisterAll()
})
