const { app, BrowserWindow, Menu, protocol, net, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { resolveAsset } = require('./asset-path.cjs');
const ORIGIN = 'siegress://game';
const smokeTest = process.argv.includes('--smoke-test');
protocol.registerSchemesAsPrivileged([{ scheme: 'siegress', privileges: {
  standard: true, secure: true, supportFetchAPI: true, stream: true
} }]);
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg',
  '.svg':'image/svg+xml', '.woff2':'font/woff2', '.mp3':'audio/mpeg', '.wav':'audio/wav' };
function isGame(url) { try { const u=new URL(url); return u.protocol==='siegress:' && u.hostname==='game'; } catch { return false; } }
function createWindow() {
  const window = new BrowserWindow({ width:1280, height:800, minWidth:800, minHeight:500,
    show: !smokeTest,
    title:'Siegress', backgroundColor:'#1a0f1c', autoHideMenuBar:true,
    webPreferences:{ nodeIntegration:false, contextIsolation:true, sandbox:true, webSecurity:true }
  });
  window.webContents.setWindowOpenHandler(() => ({ action:'deny' }));
  let rendererFailed = false;
  window.webContents.on('console-message', details => {
    if (details.level === 'error' || details.level === 3) {
      rendererFailed = true;
      console.error(details.message);
    }
  });
  window.webContents.on('did-fail-load', (_event, code, description) => {
    console.error(`Game load failed: ${code} ${description}`);
    if (smokeTest) app.exit(1);
  });
  if (smokeTest) {
    const timeout = setTimeout(() => { console.error('Desktop startup timed out'); app.exit(1); }, 45000);
    window.webContents.on('did-finish-load', () => {
      let checking = false;
      const poll = setInterval(async () => {
        if (checking) return;
        checking = true;
        const state = await window.webContents.executeJavaScript(`({
          title:document.title, canvas:!!document.querySelector('canvas')?.width,
          ready:document.body.innerText.includes('press any key to start')
        })`);
        if (!state.ready) checking = false;
        if (state.ready) {
          clearInterval(poll); clearTimeout(timeout);
          console.log(JSON.stringify({ ...state, rendererFailed }));
          app.exit(rendererFailed || !state.canvas ? 1 : 0);
        }
      }, 250);
    });
  }
  window.webContents.on('will-navigate', (event, url) => { if (!isGame(url)) event.preventDefault(); });
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type==='keyDown' && (input.key==='F11' || (input.key==='Enter' && input.alt))) {
      window.setFullScreen(!window.isFullScreen()); event.preventDefault();
    }
  });
  window.loadURL(ORIGIN + '/');
}
app.whenReady().then(() => {
  const root = path.join(app.getAppPath(), 'dist-desktop');
  protocol.handle('siegress', async request => {
    if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405});
    try {
      const file=resolveAsset(root,request.url);
      const response=await net.fetch(pathToFileURL(file).href);
      const headers=new Headers(response.headers);
      headers.set('Content-Type',mime[path.extname(file).toLowerCase()] || 'application/octet-stream');
      return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
    } catch { return new Response('Not found',{status:404}); }
  });
  session.defaultSession.setPermissionRequestHandler((contents,permission,callback) => {
    callback(isGame(contents.getURL()) && ['pointerLock','fullscreen'].includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((contents,permission,origin) =>
    isGame(origin || contents?.getURL()) && ['pointerLock','fullscreen'].includes(permission));
  Menu.setApplicationMenu(process.platform==='darwin' ? Menu.buildFromTemplate([
    {role:'appMenu'}, {label:'View',submenu:[{role:'togglefullscreen'},{role:'reload'},{role:'toggleDevTools'}]}
  ]) : null);
  createWindow();
  app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
