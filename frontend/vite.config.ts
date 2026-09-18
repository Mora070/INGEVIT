import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Configuración de desarrollo.
 *
 * El navegador utiliza /api y Vite reenvía esas solicitudes a NestJS.
 * Esto permite trabajar con la cookie HttpOnly sin almacenar tokens
 * en localStorage ni configurar llamadas entre orígenes distintos.
 *
 * En producción necesitaremos una configuración equivalente
 * en el servidor que publique la aplicación.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 4300,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: false,
      },
    },
  },
});