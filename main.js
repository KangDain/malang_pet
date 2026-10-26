const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let win = null;
let tray = null;

const savePath = () => path.join(app.getPath('userData'), 'malang-save.json');

ipcMain.on('load-sync', (e) => {
  try {
    e.returnValue = JSON.parse(fs.readFileSync(savePath(), 'utf8'));
  } catch {
    e.returnValue = null;
  }
});

ipcMain.on('save-sync', (e, data) => {
  try {
    // 임시 파일에 쓰고 교체해서 저장 도중 꺼져도 세이브가 깨지지 않게 한다
    const tmp = savePath() + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, savePath());
    e.returnValue = true;
  } catch (err) {
    console.error('save failed', err);
    e.returnValue = false;
  }
});

// 말랑이 위에 마우스가 있을 때만 클릭을 받고, 나머지는 바탕화면으로 통과시킨다
ipcMain.on('set-ignore', (_e, ignore) => {
  if (win) win.setIgnoreMouseEvents(ignore, { forward: true });
});

ipcMain.on('tray-icon', (_e, dataUrl) => {
  if (tray) tray.setImage(nativeImage.createFromDataURL(dataUrl));
});

let theme = 'system';
ipcMain.on('theme-changed', (_e, value) => {
  theme = value;
  if (tray) tray.setContextMenu(buildMenu());
});

// 렌더러가 가진 설정 (표지 숨김/고정, 방해 금지) — 트레이 메뉴 체크 표시용
let prefs = { hidden: false, locked: false, dnd: true };
ipcMain.on('prefs-changed', (_e, value) => {
  prefs = value;
  if (prefs.dnd) startFullscreenWatch();
  else stopFullscreenWatch();
  if (tray) tray.setContextMenu(buildMenu());
});

// ===================== 방해 금지 모드 =====================
// 게임·영상 같은 전체화면 창이 앞에 있으면 말랑이를 잠깐 숨긴다.
// 네이티브 모듈 없이 PowerShell로 맨 앞 창 크기를 1.5초마다 확인한다.
const FULLSCREEN_SCRIPT = `
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class FG {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr h, uint f);
  [DllImport("user32.dll")] public static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO mi);
  public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
}
"@
while ($true) {
  $full = 0
  $h = [FG]::GetForegroundWindow()
  if ($h -ne [IntPtr]::Zero) {
    $owner = 0; [void][FG]::GetWindowThreadProcessId($h, [ref]$owner)
    $sb = New-Object Text.StringBuilder 256; [void][FG]::GetClassName($h, $sb, 256); $cls = $sb.ToString()
    if ($owner -ne SELF_PID -and $cls -ne 'Progman' -and $cls -ne 'WorkerW' -and $cls -ne 'Shell_TrayWnd') {
      $r = New-Object FG+RECT; [void][FG]::GetWindowRect($h, [ref]$r)
      $mi = New-Object FG+MONITORINFO; $mi.cbSize = 40
      [void][FG]::GetMonitorInfo([FG]::MonitorFromWindow($h, 2), [ref]$mi)
      $m = $mi.rcMonitor
      # 말랑이가 사는 주 모니터를 꽉 채운 창만 전체화면으로 본다
      if (($mi.dwFlags -band 1) -and $r.L -le $m.L -and $r.T -le $m.T -and $r.R -ge $m.R -and $r.B -ge $m.B) { $full = 1 }
    }
  }
  [Console]::Out.WriteLine($full); [Console]::Out.Flush()
  Start-Sleep -Milliseconds 1500
}
`;

let watcher = null;
let hiddenByDnd = false;

function startFullscreenWatch() {
  if (watcher || process.platform !== 'win32') return;
  const script = FULLSCREEN_SCRIPT.replace('SELF_PID', String(process.pid));
  watcher = spawn('powershell.exe', [
    '-NoProfile', '-NonInteractive',
    '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64'),
  ], { windowsHide: true });
  watcher.stdout.on('data', (chunk) => {
    const lines = chunk.toString().trim().split(/\s+/);
    setFullscreen(lines[lines.length - 1] === '1');
  });
  watcher.on('exit', () => { watcher = null; });
}

function stopFullscreenWatch() {
  if (watcher) { watcher.kill(); watcher = null; }
  setFullscreen(false);
}

function setFullscreen(full) {
  if (!win) return;
  if (full && !hiddenByDnd && win.isVisible()) {
    hiddenByDnd = true;
    win.hide();
    win.webContents.send('command', 'dnd:quiet');
  } else if (!full && hiddenByDnd) {
    hiddenByDnd = false;
    win.showInactive();   // 하던 일의 포커스를 뺏지 않는다
    win.webContents.send('command', 'dnd:loud');
  }
}

function fitToWorkArea() {
  if (win) win.setBounds(screen.getPrimaryDisplay().workArea);
}

function send(command) {
  if (!win) return;
  win.show();
  win.focus();
  win.webContents.send('command', command);
}

// 렌더러가 진짜 도트 아이콘을 그려 보내기 전까지 쓸 초록 네모 (#6FA36A)
function placeholderIcon() {
  const size = 16, buf = Buffer.alloc(size * size * 4);
  for (let y = 4; y < 14; y++) {
    for (let x = 3; x < 13; x++) buf.set([0x6a, 0xa3, 0x6f, 255], (y * size + x) * 4); // BGRA
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

let alwaysOnTop = true;
function buildMenu() {
  const themeItem = (value, label) => ({
    label, type: 'radio', checked: theme === value,
    click: () => send('theme:' + value),
  });
  return Menu.buildFromTemplate([
    { label: '새 말랑이 입양하기', click: () => send('adopt') },
    { label: '말랑이 모두 부르기', click: () => send('gather') },
    { label: '말랑이네 열기', click: () => send('home') },
    { label: '친구 · 쪽지', click: () => send('friends') },
    {
      label: '말랑이네 표지', submenu: [
        { label: '표지 보이기', type: 'checkbox', checked: !prefs.hidden, click: () => send('mark:hidden') },
        { label: '위치 고정', type: 'checkbox', checked: prefs.locked, click: () => send('mark:lock') },
        { label: '처음 위치로', click: () => send('mark:reset') },
      ],
    },
    { type: 'separator' },
    {
      label: '테마', submenu: [
        themeItem('system', '시스템 설정 따르기'),
        themeItem('light', '라이트'),
        themeItem('dark', '다크'),
      ],
    },
    {
      label: '항상 위에 표시', type: 'checkbox', checked: alwaysOnTop,
      click: (item) => { alwaysOnTop = item.checked; win.setAlwaysOnTop(alwaysOnTop); },
    },
    {
      label: '방해 금지 모드 (전체화면일 때 숨기기)', type: 'checkbox', checked: prefs.dnd,
      click: () => win && win.webContents.send('command', 'dnd'),
    },
    { label: '숨기기 / 보이기', click: toggleVisible },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ]);
}

function createTray() {
  tray = new Tray(placeholderIcon());
  tray.setToolTip('말랑이 키우기');
  tray.setContextMenu(buildMenu());
  tray.on('click', toggleVisible);
}

function toggleVisible() {
  hiddenByDnd = false;
  if (win.isVisible()) win.hide();
  else win.show();
}

function createWindow() {
  win = new BrowserWindow({
    ...screen.getPrimaryDisplay().workArea,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: '말랑이 키우기',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // 창이 숨겨져 있어도 말랑이 시간은 흐르고 알림이 와야 한다
      backgroundThrottling: false,
    },
  });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile('index.html');
  win.on('closed', () => { win = null; });

  screen.on('display-metrics-changed', fitToWorkArea);
  screen.on('display-added', fitToWorkArea);
  screen.on('display-removed', fitToWorkArea);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // 윈도우 알림이 표시되려면 앱 ID가 필요하다
  if (process.platform === 'win32') app.setAppUserModelId(process.execPath);
  app.on('second-instance', () => win && win.show());
  app.whenReady().then(() => {
    createWindow();
    createTray();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { if (watcher) watcher.kill(); });
}
