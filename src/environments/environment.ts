export const environment = {
  production: false,
  apiUrl: window.location.hostname === 'erp.dicasaweb.com.br'
    ? 'https://api-erp.dicasaweb.com.br'
    : 'http://172.28.7.5:3000',
};