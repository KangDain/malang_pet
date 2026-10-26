const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

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
}
