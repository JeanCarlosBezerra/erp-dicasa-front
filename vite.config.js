import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://172.28.7.5:3000/',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ''),
      },
    }, 
    //teste
  },
});