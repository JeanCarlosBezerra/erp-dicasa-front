import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { Menu } from './pages/menu/menu';
import { DashboardComponent } from './pages/financeiro/dashboard/dashboard.component';
import { FluxoCaixaComponent } from './pages/financeiro/fluxocaixa/fluxocaixa.component';
import { Contasreceber } from './pages/financeiro/contasreceber/contasreceber.component';
import { HomeComponent } from './pages/home/home.component';
import { ColaboradorComponent } from './pages/comercial/colaborador/colaborador.component';
import { Dashboard } from './pages/comercial/dashboard/dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },

  {
    path: 'menu',
    component: Menu,
    children: [
      // Home e Financeiro
      { path: 'home',           component: HomeComponent },
      { path: 'financeiro/dashboard',      component: DashboardComponent },
      { path: 'financeiro/fluxo-caixa',    component: FluxoCaixaComponent },
      { path: 'financeiro/contas-receber', component: Contasreceber },

      // Comercial agora também
      { path: 'comercial/dashboard',   component: Dashboard /* renomeie se for ComercialDashboardComponent */ },
      { path: 'comercial/colaborador', component: ColaboradorComponent },

      {
        path: 'settings',
        loadChildren: () =>
          import('./settings/settings.module').then(m => m.SettingsModule),
      },

      // Quando fizer `/menu` sem nada, redirecione para home
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ]
  },

  { path: '', redirectTo: '/home', pathMatch: 'full' },
];


