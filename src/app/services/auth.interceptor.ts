// src/app/services/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  
  console.log('🔐 Interceptor chamado:', req.url, 'browser?', isPlatformBrowser(platformId));
  
  if (isPlatformBrowser(platformId)) {
    const token = localStorage.getItem('access_token');
    console.log('🎫 Token:', token ? 'ENCONTRADO' : 'NULL');
    if (token) {
      return next(req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      }));
    }
  }
  return next(req);
};