import { app, BrowserWindow, dialog, ipcMain, Menu, screen, shell } from 'electron';
import { existsSync, mkdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/index.mjs';
import {
  desktopCSP,
  isExternalURL,
  isTrustedURL,
  readWindowState,
  sanitizeSearch,
  searchFromDeepLink,
  writeWindowState,
} from './state.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const development = !app.isPackaged && process.argv.includes('--dev');
const profile = process.env.ELECTRICITY_MAP_PROFILE;
const name = development ? 'Electricity Map Dev' : 'Electricity Map';
app.setName(name);
app.setAppUserModelId(`dev.cujuju.electricity-map${development ? '.dev' : ''}`);
if (profile) {
  if (!isAbsolute(profile))
    throw new Error('ELECTRICITY_MAP_PROFILE must be an absolute directory.');
  mkdirSync(profile, { recursive: true });
  app.setPath('userData', profile);
}
const stateFile = join(app.getPath('userData'), 'window-state.json');
let window = null;
let api = null;
let origin = '';
let saveTimer;
let stopping = false;
let pendingSearch = process.argv.map(searchFromDeepLink).find((value) => value !== null);

function saveState() {
  if (!window || window.isDestroyed()) return;
  try {
    const search = isTrustedURL(window.webContents.getURL(), origin)
      ? sanitizeSearch(new URL(window.webContents.getURL()).search)
      : '';
    writeWindowState(stateFile, {
      ...window.getNormalBounds(),
      maximized: window.isMaximized(),
      search,
    });
  } catch (error) {
    console.error('Could not save window state:', error.message);
  }
}

function external(url) {
  if (isExternalURL(url))
    void shell.openExternal(url).catch((error) => console.error(error.message));
}

function trusted(event) {
  return (
    window &&
    !window.isDestroyed() &&
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    isTrustedURL(event.senderFrame.url, origin)
  );
}

function registerIPC() {
  for (const [channel, action] of Object.entries({
    minimize: () => window.minimize(),
    'toggle-maximize': () => (window.isMaximized() ? window.unmaximize() : window.maximize()),
    close: () => window.close(),
    menu: () => Menu.getApplicationMenu()?.popup({ window }),
  }))
    ipcMain.on(`electricity:window:${channel}`, (event) => {
      if (trusted(event)) action();
    });
  ipcMain.handle('electricity:window:state', (event) => {
    if (!trusted(event)) throw new Error('Untrusted window');
    return { maximized: window.isMaximized() };
  });
}

function createWindow() {
  const saved = readWindowState(
    stateFile,
    screen.getAllDisplays().map((d) => d.workArea),
  );
  const isMac = process.platform === 'darwin';
  // Spillway's custom chrome, isolated preload, native macOS traffic lights and delayed show.
  window = new BrowserWindow({
    x: saved.x,
    y: saved.y,
    width: saved.width,
    height: saved.height,
    minWidth: 900,
    minHeight: 600,
    show: false,
    ...(isMac
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 11 } }
      : { frame: false }),
    backgroundColor: '#111916',
    title: name,
    icon: app.isPackaged
      ? join(process.resourcesPath, 'icon.png')
      : join(root, 'resources/icon.png'),
    webPreferences: {
      preload: join(root, 'desktop/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
    },
  });
  window.setMenuBarVisibility(false);
  if (saved.maximized) window.maximize();
  for (const event of ['resize', 'move'])
    window.on(event, () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveState, 500);
    });
  for (const event of ['maximize', 'unmaximize'])
    window.on(event, () => {
      window?.webContents.send('electricity:window:maximized', window.isMaximized());
    });
  window.on('close', saveState);
  window.on('closed', () => {
    clearTimeout(saveTimer);
    window = null;
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    external(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedURL(url, origin)) {
      event.preventDefault();
      external(url);
    }
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  const permissions = window.webContents.session;
  permissions.setPermissionRequestHandler((contents, permission, callback) => {
    callback(
      contents === window?.webContents &&
        isTrustedURL(contents.getURL(), origin) &&
        permission === 'clipboard-sanitized-write',
    );
  });
  permissions.setPermissionCheckHandler(
    (contents, permission) =>
      contents === window?.webContents &&
      isTrustedURL(contents.getURL(), origin) &&
      permission === 'clipboard-sanitized-write',
  );
  window.once('ready-to-show', () => window?.show());
  const search = pendingSearch ?? saved.search;
  pendingSearch = undefined;
  void window.loadURL(`${origin}/${search}`).catch((error) => {
    if (error.code === 'ERR_ABORTED') return;
    dialog.showErrorBox('Electricity Map could not open', error.message);
    app.quit();
  });
  return window;
}

function activate(search) {
  if (stopping) return;
  if (search !== null && search !== undefined) pendingSearch = search;
  if (!origin) return;
  if (!window) createWindow();
  else if (pendingSearch !== undefined) {
    void window.loadURL(`${origin}/${pendingSearch}`);
    pendingSearch = undefined;
  }
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function installMenu() {
  const mac = process.platform === 'darwin';
  const menu = Menu.buildFromTemplate([
    ...(mac
      ? [{ label: name, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] }]
      : []),
    { label: 'File', submenu: [{ role: mac ? 'close' : 'quit' }] },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        ...(!app.isPackaged ? [{ role: 'toggleDevTools' }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }] },
    {
      label: 'Help',
      submenu: [
        {
          label: 'EIA electricity data',
          click: () => external('https://www.eia.gov/electricity/data.php'),
        },
        {
          label: 'Project repository',
          click: () => external('https://github.com/Cujuju/electricity-map'),
        },
        ...(!mac
          ? [
              {
                label: 'About Electricity Map',
                click: () =>
                  dialog.showMessageBox(window, {
                    type: 'info',
                    title: 'Electricity Map',
                    message: `Electricity Map ${app.getVersion()}`,
                    detail:
                      'SolidJS + Electron + Node.js\nData: U.S. Energy Information Administration\nDesktop shell adapted from Spillway (MIT).',
                  }),
              },
            ]
          : []),
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
  app.setAboutPanelOptions({
    applicationName: 'Electricity Map',
    applicationVersion: app.getVersion(),
    credits: 'EIA electricity data. Desktop shell adapted from Spillway (MIT).',
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) =>
    activate(argv.map(searchFromDeepLink).find((s) => s !== null)),
  );
  app.on('open-url', (event, url) => {
    event.preventDefault();
    const search = searchFromDeepLink(url);
    if (search !== null) activate(search);
  });
  app.on('activate', () => activate());
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('before-quit', (event) => {
    if (stopping) return;
    event.preventDefault();
    stopping = true;
    clearTimeout(saveTimer);
    saveState();
    void (async () => {
      if (api?.listening) {
        api.closeAllConnections();
        await new Promise((resolve) => api.close(resolve));
      }
    })()
      .catch(console.error)
      .finally(() => app.quit());
  });
  app
    .whenReady()
    .then(async () => {
      if (!development && !existsSync(join(root, 'dist/index.html')))
        throw new Error('Build the frontend first: npm run build');
      if (development) {
        const renderer = new URL(process.env.ELECTRICITY_MAP_RENDERER_URL ?? '');
        if (
          renderer.protocol !== 'http:' ||
          renderer.hostname !== '127.0.0.1' ||
          !renderer.port ||
          !isTrustedURL(renderer.href, renderer.origin)
        )
          throw new Error(
            'Development renderer must be a local loopback URL. Start with npm run dev.',
          );
        origin = renderer.origin;
      } else {
        api = await createApp({ contentSecurityPolicy: desktopCSP() });
        await new Promise((resolve, reject) => {
          api.once('error', reject);
          api.listen(0, '127.0.0.1', resolve);
        });
        origin = `http://127.0.0.1:${api.address().port}`;
      }
      registerIPC();
      installMenu();
      createWindow();
    })
    .catch((error) => {
      console.error(error);
      dialog.showErrorBox('Electricity Map could not start', error.message);
      app.quit();
    });
}
