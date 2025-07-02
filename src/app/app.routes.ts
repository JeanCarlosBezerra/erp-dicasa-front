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
  { path: '',   redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: LoginComponent },

  {
    path: 'menu',
    component: Menu,
    children: [
      // … suas rotas de Home e Financeiro
      { path: 'home',           component: HomeComponent },
      { path: 'dashboard',      component: DashboardComponent },
      { path: 'fluxo-caixa',    component: FluxoCaixaComponent },
      { path: 'contas-receber', component: Contasreceber },

      // 3) agora suas rotas de Comercial também entram aqui
      { path: 'comercial/dashboard',   component: Dashboard },
      { path: 'comercial/colaborador', component: ColaboradorComponent },

      // você pode redirecionar “/menu” para “/menu/home” se quiser
      { path: '', redirectTo: 'home', pathMatch: 'full' }
    ]
  },

  //{
  //  path: 'comercial',
  //  children: [
  //    { path: 'dashboard',       component: Dashboard },
  //    { path: 'colaborador',     component: ColaboradorComponent },
  //    { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
  //  ]
  //},
];

//export const routes: Routes = [
 // { path: '', component: LoginComponent }, // rota raiz/
//];
