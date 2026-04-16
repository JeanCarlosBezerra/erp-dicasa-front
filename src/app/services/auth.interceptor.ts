// src/app/services/auth.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);

  console.log('🔐 Interceptor chamado:', req.url, 'browser?', isPlatformBrowser(platformId));

  if (isPlatformBrowser(platformId)) {
    const token = localStorage.getItem('access_token');
    console.log('🎫 Token:', token ? 'ENCONTRADO' : 'NULL');
    
    if (token) {
      req = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
    }
  }

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && isPlatformBrowser(platformId)) {
        localStorage.removeItem('access_token');
        router.navigate(['/login']);
      }
      return throwError(() => err);
    })
  );
};