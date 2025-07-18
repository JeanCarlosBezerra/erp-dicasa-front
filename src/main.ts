import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { HttpClientModule }    from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import localePt from '@angular/common/locales/pt';
import { LOCALE_ID } from '@angular/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { AuthInterceptor } from './app/services/auth.interceptor';

registerLocaleData(localePt);

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),       // <- ESSENCIAL PARA O HttpClient funcionar
    provideAnimations(),
    provideRouter(routes),
    { provide: LOCALE_ID,   useValue: 'pt-BR' },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' }    // Angular Material
  ]
}).catch(err => console.error(err));
