const http = require('node:http');

if (process.env.NODE_ENV !== 'development') {
  throw new Error('Esta herramienta solo funciona en desarrollo.');
}

const clientId = process.env.AUTH_GOOGLE_CLIENT_ID;

if (
  typeof clientId !== 'string' ||
  !/^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId)
) {
  throw new Error('AUTH_GOOGLE_CLIENT_ID no es válido.');
}

/*
 * Página local y proxy limitado a tres rutas.
 * No registra credenciales, cookies ni cuerpos de solicitudes.
 * El backend mantiene sus comprobaciones de origen y autenticación.
 */
const pagina = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>INGEVIT · Prueba de Google</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 760px;
      margin: 60px auto;
      padding: 0 20px;
      background: #f4f6f8;
      color: #172b3a;
    }
    main { background: white; padding: 28px; border-radius: 16px; }
    button { padding: 10px 16px; margin: 16px 8px 0 0; cursor: pointer; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; }
  </style>
</head>
<body>
<main>
  <h1>Prueba de inicio de sesión con Google</h1>
  <p>La credencial se envía al backend sin mostrarse en pantalla.</p>
  <div id="google"></div>
  <button id="perfil">Consultar mi perfil</button>
  <button id="salir">Cerrar sesión</button>
  <pre id="resultado" aria-live="polite">Cargando Google…</pre>
</main>
<script>
  const salida = document.getElementById('resultado');

  async function solicitar(ruta, opciones = {}) {
    const respuesta = await fetch(ruta, {
      ...opciones,
      credentials: 'same-origin'
    });

    const texto = await respuesta.text();
    let contenido = texto;

    try {
      contenido = JSON.stringify(JSON.parse(texto), null, 2);
    } catch {}

    salida.textContent = 'HTTP ' + respuesta.status + '\\n' + contenido;
    return respuesta.ok;
  }

  window.iniciarGoogle = function () {
    google.accounts.id.initialize({
      client_id: ${JSON.stringify(clientId)},
      auto_select: false,
      callback: async function (resultado) {
        salida.textContent = 'Validando identidad…';

        try {
          await solicitar('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: resultado.credential })
          });
        } catch {
          salida.textContent = 'No se pudo completar la solicitud.';
        }
      }
    });

    google.accounts.id.renderButton(
      document.getElementById('google'),
      { theme: 'outline', size: 'large', text: 'signin_with' }
    );

    salida.textContent = 'Selecciona tu cuenta de Google.';
  };

  document.getElementById('perfil').onclick = async function () {
    try {
      await solicitar('/api/auth/me');
    } catch {
      salida.textContent = 'No se pudo consultar el perfil.';
    }
  };

  document.getElementById('salir').onclick = async function () {
    try {
      await solicitar('/api/auth/logout', { method: 'POST' });
    } catch {
      salida.textContent = 'No se pudo cerrar la sesión.';
    }
  };
</script>
<script
  src="https://accounts.google.com/gsi/client"
  async
  onload="iniciarGoogle()"
  onerror="document.getElementById('resultado').textContent='No se pudo cargar Google.'">
</script>
</body>
</html>`;

const rutas = new Set([
  'POST /api/auth/google',
  'GET /api/auth/me',
  'POST /api/auth/logout',
]);

const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  // Solo atiende el origen local previsto.
  if (req.headers.host !== 'localhost:4300') {
    res.writeHead(403);
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(pagina);
  }

  if (!rutas.has(req.method + ' ' + req.url)) {
    res.writeHead(404);
    return res.end();
  }

  if (
    req.method === 'POST' &&
    req.headers.origin !== 'http://localhost:4300'
  ) {
    res.writeHead(403);
    return res.end();
  }

  try {
    const fragmentos = [];
    let bytes = 0;

    for await (const fragmento of req) {
      bytes += fragmento.length;

      if (bytes > 32 * 1024) {
        res.writeHead(413);
        res.end();
        return;
      }

      fragmentos.push(fragmento);
    }

    const contenido = Buffer.concat(fragmentos);
    const headers = {};

    for (const nombre of ['content-type', 'cookie', 'origin']) {
      if (req.headers[nombre]) {
        headers[nombre] = req.headers[nombre];
      }
    }

    headers['content-length'] = String(contenido.length);

    const proxy = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: req.url,
      method: req.method,
      headers,
    }, (respuesta) => {
      res.writeHead(respuesta.statusCode, respuesta.headers);
      respuesta.on('error', () => res.destroy());
      respuesta.pipe(res);
    });

    proxy.setTimeout(30000, () => proxy.destroy());

    proxy.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('No se pudo comunicar con el backend.');
      } else {
        res.destroy();
      }
    });

    res.on('close', () => proxy.destroy());
    proxy.end(contenido);
  } catch {
    if (!res.headersSent && !res.destroyed) {
      res.writeHead(400);
      res.end();
    } else {
      res.destroy();
    }
  }
});

server.listen(4300, '127.0.0.1', () => {
  console.log('Prueba de Google: http://localhost:4300');
});