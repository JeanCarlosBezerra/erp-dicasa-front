import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { Menu } from './pages/menu/menu';
import { DashboardComponent } from './pages/financeiro/dashboard/dashboard.component';
import { FluxoCaixaComponent } from './pages/financeiro/fluxocaixa/fluxocaixa.component';
import { Contasreceber } from './pages/financeiro/contasreceber/contasreceber.component';
import { HomeComponent } from './pages/home/home.component';

export const routes: Routes = [
  { path: '', redirectTo: 'menu', pathMatch: 'full' },

  { path: 'login', component: LoginComponent },

  {
    path: 'menu',
    component: Menu,
    children: [
      { path: '', component: HomeComponent },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'fluxo-caixa', component: FluxoCaixaComponent },
      { path: 'contas-receber', component: Contasreceber }
    ]
  }
];

//export const routes: Routes = [
 // { path: '', component: LoginComponent }, // rota raiz/
//];
