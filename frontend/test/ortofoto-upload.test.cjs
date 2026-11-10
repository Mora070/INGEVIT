const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const test = require('node:test');
const assert = require('node:assert/strict');
const base = path.join(__dirname, '../src');
const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'ingevit-upload-tests-'));
for (const ruta of ['shared/api/http.ts', 'shared/api/subirFormulario.ts', 'features/proyectos/uploads/subidaOrtofoto.ts']) {
  const file = path.join(output, ruta.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, ts.transpileModule(fs.readFileSync(path.join(base, ruta), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
}
test.after(() => fs.rmSync(output, { recursive: true, force: true }));
const pedidos = [];
class XHR {
  upload = {};
  headers = {};
  status = 0;
  responseText = '';
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(key, value) { this.headers[key] = value; }
  send(body) { this.body = body; pedidos.push(this); }
  abort() { this.onabort?.(); }
  responder(status, data) { this.status = status; this.responseText = JSON.stringify(data); this.onload(); }
}
global.XMLHttpRequest = XHR;
global.window = new EventTarget();
const store = require(path.join(output, 'features/proyectos/uploads/subidaOrtofoto.js'));
const datos = () => ({ nombre: 'Gratitud', descripcion: '', archivo: new File(['contenido'], 'obra.tif') });
const flush = () => new Promise(resolve => setImmediate(resolve));
test.beforeEach(() => { store.limpiarSubidaSesion(); pedidos.length = 0; });

test('mantiene la petición y el progreso aunque se desmonte el consumidor', () => {
  const unsubscribe = store.observarSubida(() => {});
  store.iniciarSubidaOrtofoto('proyecto A', datos());
  unsubscribe();
  pedidos[0].upload.onprogress({ loaded: 40, total: 100, lengthComputable: true });
  assert.equal(store.obtenerSubida().enviados, 40);
  assert.equal(store.obtenerSubida().estado, 'subiendo');
  assert.equal(pedidos[0].url, '/api/proyectos/proyecto%20A/capas');
  assert.ok(pedidos[0].body instanceof FormData);
  assert.equal(pedidos[0].headers['Content-Type'], undefined);
});
test('no inventa porcentaje cuando se desconoce el total', () => {
  store.iniciarSubidaOrtofoto('a', datos());
  pedidos[0].upload.onprogress({ loaded: 20, total: 0, lengthComputable: false });
  assert.equal(store.obtenerSubida().total, null);
});
test('el 100 % de transferencia espera aceptación antes de avisar al mapa', async () => {
  let recibido;
  const listener = event => { recibido = event.detail; };
  window.addEventListener('ingevit:ortofoto-recibida', listener, { once: true });
  store.iniciarSubidaOrtofoto('a', datos());
  pedidos[0].upload.onload();
  assert.equal(store.obtenerSubida().estado, 'confirmando');
  assert.equal(recibido, undefined);
  pedidos[0].responder(201, { id_capa: 'capa-1' });
  await flush();
  assert.equal(store.obtenerSubida().estado, 'recibida');
  assert.deepEqual(recibido, { proyecto: 'a', capa: { id_capa: 'capa-1' } });
});
test('no permite envíos duplicados mientras otro está activo', () => {
  store.iniciarSubidaOrtofoto('a', datos());
  assert.throws(() => store.iniciarSubidaOrtofoto('b', datos()), /Ya hay/);
  assert.equal(pedidos.length, 1);
});
test('conserva el mensaje de rechazo del servidor sin observadores', async () => {
  store.iniciarSubidaOrtofoto('a', datos());
  pedidos[0].responder(413, { message: ['Archivo demasiado grande'] });
  await flush();
  assert.equal(store.obtenerSubida().estado, 'error');
  assert.match(store.obtenerSubida().mensaje, /demasiado grande/);
});
test('error de red no reintenta la subida automáticamente', async () => {
  store.iniciarSubidaOrtofoto('a', datos());
  pedidos[0].onerror();
  await flush();
  assert.equal(pedidos.length, 1);
  assert.match(store.obtenerSubida().mensaje, /Revisa las capas/);
});
test('cancelar no afirma que se eliminaron datos del servidor', async () => {
  store.iniciarSubidaOrtofoto('a', datos());
  store.interrumpirSubida();
  await flush();
  assert.equal(store.obtenerSubida().estado, 'error');
  assert.match(store.obtenerSubida().mensaje, /podría haber recibido/);
});
test('cerrar sesión limpia el estado e ignora callbacks anteriores', async () => {
  store.iniciarSubidaOrtofoto('a', datos());
  const anterior = pedidos[0];
  store.limpiarSubidaSesion();
  store.iniciarSubidaOrtofoto('b', datos());
  anterior.upload.onprogress({ loaded: 90, total: 100, lengthComputable: true });
  await flush();
  assert.equal(store.obtenerSubida().proyecto, 'b');
  assert.equal(store.obtenerSubida().enviados, 0);
});
test('respuesta exitosa inválida no anuncia recepción confirmada', async () => {
  store.iniciarSubidaOrtofoto('a', datos());
  pedidos[0].responder(200, { unexpected: true });
  await flush();
  assert.equal(store.obtenerSubida().estado, 'error');
  store.descartarSubida();
  assert.equal(store.obtenerSubida(), null);
});
