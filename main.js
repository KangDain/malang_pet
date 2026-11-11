const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, crashReporter, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let win = null;
let tray = null;

const savePath = () => path.join(app.getPath('userData'), 'malang-save.json');

// ===================== 실행 기록 =====================
// 어떤 PC에서 말랑이가 안 켜질 때 원인을 찾으려고 %APPDATA%\malang-pet\malang-log.txt에 남긴다.
// 'start'만 있고 그 뒤가 없으면 창을 띄우기 전에 죽은 것, 아예 없으면 실행 자체가 막힌 것
const logPath = () => path.join(app.getPath('userData'), 'malang-log.txt');
function log(...args) {
  try {
    const line = `[${new Date().toISOString()}] ${args.join(' ')}
`;
    // 너무 커지면 새로 시작한다
    if (fs.existsSync(logPath()) && fs.statSync(logPath()).size > 200 * 1024) fs.writeFileSync(logPath(), '');
    fs.appendFileSync(logPath(), line);
  } catch {}
}
log('start', app.getVersion(), process.platform, require('os').release(), process.execPath);
process.on('uncaughtException', (err) => log('main error', (err && err.stack) || err));
app.on('child-process-gone', (_e, d) => log('child gone', d.type, d.reason, d.exitCode, d.name || ''));
app.on('render-process-gone', (_e, _wc, d) => log('renderer gone', d.reason, d.exitCode));
// 네이티브로 죽어도 덤프가 %APPDATA%\malang-pet\Crashpad에 남는다 (어디로도 보내지 않는다)
try { crashReporter.start({ uploadToServer: false }); } catch {}

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

ipcMain.on('quit-app', () => app.quit());

// 윈도우를 켤 때 같이 켜기 (설치한 exe로 실행했을 때만)
const exePath = () => process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
const autoStart = () => app.getLoginItemSettings({ path: exePath() }).openAtLogin;

// 렌더러가 가진 설정 (표지 숨김/고정, 방해 금지) — 트레이 메뉴 체크 표시용
let prefs = { hidden: false, locked: false, dnd: true, focus: false, onTop: false };
ipcMain.on('prefs-changed', (_e, value) => {
  prefs = value;
  if (win && win.isAlwaysOnTop() !== !!prefs.onTop) win.setAlwaysOnTop(!!prefs.onTop);
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
$capture = @('ScreenClippingHost', 'SnippingTool', 'ScreenSketch', 'ShellExperienceHost', 'ShareX', 'Lightshot', 'Greenshot', 'PicPick', 'Snipaste', 'ALCapture', 'KakaoTalk', 'Gyazo', 'FSCapture', 'flameshot')
$skip = @{}
while ($true) {
  $full = 0
  $h = [FG]::GetForegroundWindow()
  if ($h -ne [IntPtr]::Zero) {
    $owner = 0; [void][FG]::GetWindowThreadProcessId($h, [ref]$owner)
    $sb = New-Object Text.StringBuilder 256; [void][FG]::GetClassName($h, $sb, 256); $cls = $sb.ToString()
    if ($owner -ne SELF_PID -and $cls -ne 'Progman' -and $cls -ne 'WorkerW' -and $cls -ne 'Shell_TrayWnd' -and -not $skip.ContainsKey([string]$owner)) {
      $r = New-Object FG+RECT; [void][FG]::GetWindowRect($h, [ref]$r)
      $mi = New-Object FG+MONITORINFO; $mi.cbSize = 40
      [void][FG]::GetMonitorInfo([FG]::MonitorFromWindow($h, 2), [ref]$mi)
      $m = $mi.rcMonitor
      # 말랑이가 사는 주 모니터를 꽉 채운 창만 전체화면으로 본다
      if (($mi.dwFlags -band 1) -and $r.L -le $m.L -and $r.T -le $m.T -and $r.R -ge $m.R -and $r.B -ge $m.B) {
        # 캡처 도구는 화면 전체를 덮는 창을 잠깐 띄운다. 전체화면으로 치지 않고, 그 프로세스는 다음부터 바로 건너뛴다
        $name = (Get-Process -Id $owner -ErrorAction SilentlyContinue).ProcessName
        if ($name -and $capture -contains $name) { $skip[[string]$owner] = 1 } else { $full = 1 }
      }
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
  // 전체화면이 두 번 연달아(약 3초) 보여야 숨긴다. 목록에 없는 캡처 도구나 잠깐 뜨는 창에 깜빡이지 않게
  let streak = 0;
  watcher.stdout.on('data', (chunk) => {
    for (const v of chunk.toString().trim().split(/\s+/)) streak = v === '1' ? streak + 1 : 0;
    setFullscreen(streak >= 2);
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
    log('dnd: hidden by a fullscreen window');
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
    { label: '집중 모드', type: 'checkbox', checked: !!prefs.focus, click: () => send('focus') },
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
      // 기본은 꺼짐: 다른 프로그램 창이 말랑이를 덮는다 (켜면 언제나 맨 위)
      label: '항상 위에 표시', type: 'checkbox', checked: !!prefs.onTop,
      click: () => win && win.webContents.send('command', 'ontop'),
    },
    {
      label: '방해 금지 모드 (전체화면일 때 숨기기)', type: 'checkbox', checked: prefs.dnd,
      click: () => win && win.webContents.send('command', 'dnd'),
    },
    { label: '숨기기 / 보이기', click: toggleVisible },
    ...(app.isPackaged ? [{
      label: '윈도우 시작할 때 같이 켜기', type: 'checkbox', checked: autoStart(),
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, path: exePath() }),
    }] : []),
    ...(updateReady ? [{ label: `새 버전 ${updateReady} 설치하고 다시 켜기`, click: () => win && win.webContents.send('command', 'update:install') }] : []),
    ...(newRelease ? [{ label: `새 버전 ${newRelease} 받으러 가기`, click: openRelease }] : []),
    { type: 'separator' },
    // 렌더러가 친구들에게 작별 인사를 보내고 끈다 (응답이 없으면 1초 뒤 그냥 끈다)
    { label: '종료', click: () => { if (win) { win.webContents.send('command', 'quit'); setTimeout(() => app.quit(), 1000); } else app.quit(); } },
  ]);
}

// ===================== 자동 업데이트 =====================
// GitHub Releases에 새 버전이 올라오면 몰래 받아 두고, 다 받으면 말랑이가 알림 창을 띄운다.
// '지금 다시 켜기'를 누르면 바로 설치하고 다시 켜지고, '나중에'를 누르면 다음에 끌 때 설치된다.
// 설치판은 electron-updater가, 포터블은 아래 setupReleaseCheck가 맡는다 (개발 중 실행은 건너뛴다)
let updateReady = null;   // 다 받아 둔 새 버전
let autoUpdater = null;
function setupUpdater() {
  if (!app.isPackaged) return;
  if (process.env.PORTABLE_EXECUTABLE_FILE) return setupReleaseCheck();
  try { ({ autoUpdater } = require('electron-updater')); } catch { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', (info) => {
    updateReady = info.version;
    if (tray) tray.setContextMenu(buildMenu());
    if (win) win.webContents.send('command', 'update:' + info.version);
  });
  autoUpdater.on('error', () => {});   // 인터넷이 없거나 릴리스가 없어도 조용히 넘어간다
  const check = () => { if (!updateReady) autoUpdater.checkForUpdates().catch(() => {}); };
  setTimeout(check, 15000);
  setInterval(check, 3 * 60 * 60 * 1000);
}
// 포터블 exe는 자기 파일을 바꿔 끼울 수 없어서, 새 설치판(Setup)을 몰래 받아 두었다가 조용히 설치한다.
// 설치판으로 바뀌면 그다음부터는 electron-updater가 맡는다. 세이브는 %APPDATA%에 있어서 그대로 이어진다.
// 받기나 확인이 실패하면 릴리스 페이지 링크만 띄운다
const RELEASE_PAGE = 'https://github.com/KangDain/malang_pet/releases/latest';
const RELEASE_DL = 'https://github.com/KangDain/malang_pet/releases';
let newRelease = null;    // 받지 못해서 링크로만 알린 새 버전
let setupFile = null;     // 다 받고 확인까지 마친 설치판 경로
let setupLaunched = false;
const newer = (a, b) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};
async function downloadSetup() {
  // latest.yml에 버전 · 파일 이름 · sha512가 있다 (electron-builder가 릴리스에 같이 올린다)
  const res = await net.fetch(RELEASE_DL + '/latest/download/latest.yml');
  if (!res.ok) return null;
  const yml = await res.text();
  const ver = (yml.match(/^version:\s*(\S+)/m) || [])[1];
  const file = (yml.match(/^path:\s*(\S+)/m) || [])[1];
  const sha = (yml.match(/^sha512:\s*(\S+)/m) || [])[1];
  if (!ver || !/^\d+\.\d+\.\d+$/.test(ver) || !newer(ver, app.getVersion())) return null;
  if (!file || !sha || !/^[\w.-]+\.exe$/.test(file)) return { ver };
  const bin = await net.fetch(`${RELEASE_DL}/download/v${ver}/${file}`);
  if (!bin.ok) return { ver };
  const buf = Buffer.from(await bin.arrayBuffer());
  // 받은 파일이 릴리스에 올린 것과 똑같은지 확인한다
  if (require('crypto').createHash('sha512').update(buf).digest('base64') !== sha) { log('update: sha512 mismatch'); return { ver }; }
  const dir = path.join(app.getPath('temp'), 'malang-update');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, file);
  fs.writeFileSync(out, buf);
  return { ver, out };
}
function setupReleaseCheck() {
  const check = async () => {
    if (setupFile || newRelease) return;
    try {
      const got = await downloadSetup();
      if (!got) return;
      if (got.out) {
        setupFile = got.out;
        updateReady = got.ver;
        log('update: downloaded', got.ver);
        if (win) win.webContents.send('command', 'update:' + got.ver);
      } else {
        newRelease = got.ver;
        log('update: link only', got.ver);
        if (win) win.webContents.send('command', 'release:' + got.ver);
      }
      if (tray) tray.setContextMenu(buildMenu());
    } catch (err) { log('update: check failed', err && err.message); }   // 인터넷이 없으면 다음에 다시
  };
  setTimeout(check, 15000);
  setInterval(check, 3 * 60 * 60 * 1000);
}
// 설치판을 조용히(/S) 실행한다. run이면 설치 뒤 말랑이를 다시 켠다
function runSetup(run) {
  if (!setupFile || setupLaunched) return;
  setupLaunched = true;
  log('update: installing', updateReady);
  spawn(setupFile, ['--updated', '/S', ...(run ? ['--force-run'] : [])], { detached: true, stdio: 'ignore' }).unref();
}
function openRelease() { shell.openExternal(RELEASE_PAGE); }
ipcMain.on('open-release', openRelease);
// 렌더러가 저장 · 작별 인사를 마치고 부른다
ipcMain.on('install-update', () => {
  if (autoUpdater && updateReady) autoUpdater.quitAndInstall(true, true);
  else if (setupFile) { runSetup(true); app.quit(); }
});

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
    alwaysOnTop: false,   // 렌더러 설정(onTop)이 오면 맞춘다
    // 도구 창(WS_EX_TOOLWINDOW)으로 만든다. 화면 전체를 덮는 투명 창이라, 말랑이를 누르는 순간
    // 크롬 같은 프로그램이 '가려졌다'고 보고 화면 그리기를 멈췄다. 도구 창은 그 계산에서 빠진다
    ...(process.platform === 'win32' ? { type: 'toolbar' } : {}),
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
  win.webContents.on('did-finish-load', () => log('window ready', JSON.stringify(screen.getPrimaryDisplay().workArea)));
  win.webContents.on('did-fail-load', (_e, code, desc) => log('load failed', code, desc));
  win.webContents.on('console-message', (e) => { if (e.level === 'error') log('renderer error', e.message, `${e.sourceId}:${e.lineNumber}`); });

  screen.on('display-metrics-changed', fitToWorkArea);
  screen.on('display-added', fitToWorkArea);
  screen.on('display-removed', fitToWorkArea);
}

if (!app.requestSingleInstanceLock()) {
  log('already running - showing the existing one');
  app.quit();
} else {
  // 윈도우 알림이 표시되려면 앱 ID가 필요하다
  if (process.platform === 'win32') app.setAppUserModelId(process.execPath);
  // 이미 켜져 있는데 바로가기를 또 누르면 숨어 있던 말랑이들을 다시 보여 준다
  app.on('second-instance', () => {
    if (!win) return;
    hiddenByDnd = false;
    win.show();
  });
  app.whenReady().then(() => {
    createWindow();
    createTray();
    setupUpdater();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {
    if (watcher) watcher.kill();
    runSetup(false);   // '나중에'를 눌렀으면 끌 때 설치된다
  });
}
