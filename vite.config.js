import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    allowedHosts: ['erp.dicasaweb.com.br'], // Adiciona seu domínio aqui
    proxy: {
      '/api': {
        target: 'http://172.28.7.5:3000/', // O endereço do seu backend
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
});

