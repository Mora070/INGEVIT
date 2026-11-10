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
test.after(() => { store.limpiarSubidaSesion(); fs.rmSync(output, { recursive: true, force: true }); });
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
let respuestasConsulta = [];
const consultas = [];
test.beforeEach(t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  store.limpiarSubidaSesion(); pedidos.length = 0; respuestasConsulta = []; consultas.length = 0;
  global.fetch = async (ruta, opciones) => {
    consultas.push({ ruta, opciones });
    const respuesta = respuestasConsulta.shift() ?? {
      capas: [{ id_capa: store.obtenerSubida()?.capaId, estado_procesamiento: 'PENDIENTE' }], total_paginas: 1,
    };
    if (respuesta instanceof Error) throw respuesta;
    return new Response(JSON.stringify(respuesta), { status: 200 });
  };
});
test.afterEach(() => { store.limpiarSubidaSesion(); });

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
  assert.equal(store.obtenerSubida().estado, 'pendiente');
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
test('cancelar es un estado explícito y no promete borrado confirmado', async () => {
  store.iniciarSubidaOrtofoto('a', datos());
  store.interrumpirSubida();
  await flush();
  assert.equal(store.obtenerSubida().estado, 'cancelada');
  assert.equal(store.obtenerSubida().mensaje, undefined);
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

test('eventos de progreso tardíos no regresan una capa aceptada a confirmando', async () => {
  store.iniciarSubidaOrtofoto('a', datos());
  pedidos[0].responder(201, { id_capa: 'nueva', estado_procesamiento: 'PROCESANDO' });
  await flush();
  pedidos[0].upload.onload();
  pedidos[0].upload.onprogress({ loaded: 30, total: 100, lengthComputable: true });
  assert.equal(store.obtenerSubida().estado, 'procesando');
});

test('la respuesta DONE también confirma la recepción y no duplica el evento', async () => {
  let eventos = 0;
  const listener = () => eventos++;
  window.addEventListener('ingevit:ortofoto-recibida', listener);
  store.iniciarSubidaOrtofoto('a', datos());
  Object.assign(pedidos[0], { status: 201, readyState: 4, responseText: JSON.stringify({ id_capa: 'nueva', estado_procesamiento: 'PENDIENTE' }) });
  pedidos[0].onreadystatechange();
  pedidos[0].onload();
  await flush();
  assert.equal(store.obtenerSubida().estado, 'pendiente');
  assert.equal(eventos, 1);
  window.removeEventListener('ingevit:ortofoto-recibida', listener);
});

test('sigue la capa exacta aunque otra del mismo nombre ya esté lista', async t => {
  store.iniciarSubidaOrtofoto('a', datos());
  pedidos[0].responder(201, { id_capa: 'nueva', estado_procesamiento: 'PENDIENTE' });
  await flush();
  respuestasConsulta.push({ capas: [
    { id_capa: 'anterior', nombre: 'Gratitud', estado_procesamiento: 'LISTA' },
    { id_capa: 'nueva', nombre: 'Gratitud', estado_procesamiento: 'PROCESANDO' },
  ], total_paginas: 1 });
  t.mock.timers.tick(5000); await flush();
  assert.equal(store.obtenerSubida().estado, 'procesando');
  assert.equal(store.obtenerSubida().capaId, 'nueva');
});

test('encuentra la capa en otra página y retira el aviso al quedar lista', async t => {
  store.iniciarSubidaOrtofoto('a', datos());
  pedidos[0].responder(201, { id_capa: 'nueva', estado_procesamiento: 'PROCESANDO' });
  await flush();
  respuestasConsulta.push({ capas: [{ id_capa: 'otra' }], total_paginas: 2 },
    { capas: [{ id_capa: 'nueva', estado_procesamiento: 'LISTA' }], total_paginas: 2 });
  t.mock.timers.tick(5000); await flush();
  assert.equal(store.obtenerSubida().estado, 'lista');
  assert.match(consultas[1].ruta, /pagina=2/);
  t.mock.timers.tick(4000);
  assert.equal(store.obtenerSubida(), null);
});

test('una consulta fallida no convierte el procesamiento en un error del archivo', async t => {
  store.iniciarSubidaOrtofoto('a', datos());
  pedidos[0].responder(201, { id_capa: 'nueva', estado_procesamiento: 'PROCESANDO' });
  await flush();
  respuestasConsulta.push(new Error('sin red'));
  t.mock.timers.tick(5000); await flush();
  assert.equal(store.obtenerSubida().estado, 'procesando');
  assert.match(store.obtenerSubida().avisoEstado, /Volveremos/);
  respuestasConsulta.push({ capas: [{ id_capa: 'nueva', estado_procesamiento: 'LISTA' }], total_paginas: 1 });
  t.mock.timers.tick(5000); await flush();
  assert.equal(store.obtenerSubida().estado, 'lista');
  assert.equal(store.obtenerSubida().avisoEstado, undefined);
});

test('no infiere recepción por nombre ni consulta antes de la respuesta del POST', t => {
  store.iniciarSubidaOrtofoto('a', datos());
  pedidos[0].upload.onload();
  t.mock.timers.tick(20000);
  assert.equal(store.obtenerSubida().estado, 'confirmando');
  assert.equal(consultas.length, 0);
});

test('el temporizador de una subida terminada no oculta la siguiente', async t => {
  store.iniciarSubidaOrtofoto('a', datos());
  pedidos[0].responder(201, { id_capa: 'lista', estado_procesamiento: 'LISTA' });
  await flush();
  store.iniciarSubidaOrtofoto('b', datos());
  t.mock.timers.tick(4000);
  assert.equal(store.obtenerSubida().proyecto, 'b');
  assert.equal(store.obtenerSubida().estado, 'subiendo');
});

test('cancelar se retira automáticamente y ya no cancela una recepción completa', async t => {
  store.iniciarSubidaOrtofoto('a', datos());
  store.interrumpirSubida(); await flush();
  assert.equal(store.obtenerSubida().estado, 'cancelada');
  t.mock.timers.tick(4000);
  assert.equal(store.obtenerSubida(), null);
  store.iniciarSubidaOrtofoto('b', datos());
  pedidos[1].upload.onload();
  store.interrumpirSubida();
  assert.equal(store.obtenerSubida().estado, 'confirmando');
});

test('descartar o cerrar sesión detiene las consultas de procesamiento', async t => {
  store.iniciarSubidaOrtofoto('a', datos());
  pedidos[0].responder(201, { id_capa: 'nueva', estado_procesamiento: 'PROCESANDO' });
  await flush();
  store.descartarSubida();
  t.mock.timers.tick(10000); await flush();
  assert.equal(consultas.length, 0);
  assert.equal(store.obtenerSubida(), null);
});
