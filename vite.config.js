import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [angular()],
  server: {
    proxy: {
      '/api': {
        target: 'http://172.28.7.5:3000/',  // O endereço do seu backend
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
    allowedHosts: ['erp.dicasaweb.com.br'],  // Adiciona seu domínio aqui
  },
});
