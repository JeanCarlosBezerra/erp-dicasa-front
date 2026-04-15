import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { LoginComponent } from './pages/login/login.component';
import { Menu } from './pages/menu/menu';
import { DashboardComponent } from './pages/financeiro/dashboard/dashboard.component';
import { FluxoCaixaComponent } from './pages/financeiro/fluxocaixa/fluxocaixa.component';
import { Contasreceber } from './pages/financeiro/contasreceber/contasreceber.component';
import { HomeComponent } from './pages/home/home.component';
import { ColaboradorComponent } from './pages/comercial/colaborador/colaborador.component';
import { DashboardComercialComponent } from './pages/comercial/dashboard/dashboard-comercial.component';
import { IndicadoresComponent } from './pages/financeiro/indicadores/indicadores.component';
import { ProdutosComponent } from './pages/estoque/produtos/produtos.component';
import { ResumoExecutivoComponent } from './pages/compras-estrategicas/resumo-executivo/resumo-executivo.component';
import { AnaliseFornecedoresComponent } from './pages/compras-estrategicas/analise-fornecedores/analise-fornecedores.component';
import { AnaliseProdutosComponent } from './pages/compras-estrategicas/analise-produtos/analise-produtos.component';
import { AnaliseSpendAbcComponent } from './pages/compras-estrategicas/analise-spend-abc/analise-spend-abc.component';
import { PedidosListComponent } from './pages/pedidos-list/pedidos-list.component';
import { FaturamentoComponent } from './pages/comercial/faturamento/faturamento.component';
import { AvaliacaoDesempenhoComponent } from './pages/rh/avaliacao-desempenho/avaliacao-desempenho.component';
import { FormularioAvaliacaoComponent } from './pages/rh/formulario-avaliacao/formulario-avaliacao.component';

// Guard reutilizável
const guard = (role: string) => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.hasRole(role)) return true;
  return router.createUrlTree(['/menu/home']); // redireciona sem permissão
};

// Guard de login
const loginGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/login']);
};

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },

  {
    path: 'menu',
    component: Menu,
    canActivate: [loginGuard], // ← protege tudo dentro de menu
    children: [
      { path: 'home', component: HomeComponent },

      // Financeiro
      { path: 'financeiro/dashboard',      component: DashboardComponent,   canActivate: [guard('MOD_FINANCEIRO')] },
      { path: 'financeiro/indicadores',    component: IndicadoresComponent,  canActivate: [guard('FIN_INDICADORES')] },
      { path: 'financeiro/fluxo-caixa',   component: FluxoCaixaComponent,   canActivate: [guard('FIN_FLUXO_CAIXA')] },
      { path: 'financeiro/contas-receber', component: Contasreceber,         canActivate: [guard('FIN_CONTAS_RECEBER')] },

      // Pedidos
      { path: 'pedidos-list', component: PedidosListComponent, canActivate: [guard('MOD_PEDIDOS')] },

      // Comercial
      { path: 'comercial/dashboard',   component: DashboardComercialComponent, canActivate: [guard('COM_DASHBOARD')] },
      { path: 'comercial/colaborador', component: ColaboradorComponent,         canActivate: [guard('COM_COLABORADOR')] },
      { path: 'comercial/faturamento', component: FaturamentoComponent,         canActivate: [guard('COM_FATURAMENTO')] },

      // Estoque
      { path: 'estoque/produtos', component: ProdutosComponent, canActivate: [guard('MOD_ESTOQUE')] },

      // Compras Estratégicas — todas protegidas por MOD_COMPRAS
      { path: 'compras-estrategicas/resumo-executivo',   component: ResumoExecutivoComponent,    canActivate: [guard('MOD_COMPRAS')] },
      { path: 'compras-estrategicas/analise-fornecedores', component: AnaliseFornecedoresComponent, canActivate: [guard('MOD_COMPRAS')] },
      { path: 'compras-estrategicas/analise-produtos',   component: AnaliseProdutosComponent,    canActivate: [guard('MOD_COMPRAS')] },
      { path: 'compras-estrategicas/analise-spend-abc',  component: AnaliseSpendAbcComponent,    canActivate: [guard('MOD_COMPRAS')] },

      // RH
      { path: 'rh/avaliacao-desempenho', component: AvaliacaoDesempenhoComponent, canActivate: [guard('RH_AVALIACAO')] },
      { path: 'rh/formulario-avaliacao', component: FormularioAvaliacaoComponent,  canActivate: [guard('RH_AVALIACAO')] },
      { path: 'rh/avaliacao-desempenho', component: AvaliacaoDesempenhoComponent, canActivate: [guard('RH_DASHBOARD')] },
      { path: 'rh/formulario-avaliacao', component: FormularioAvaliacaoComponent,  canActivate: [guard('RH_AVALIACAO')] },

      // Settings
      {
        path: 'settings',
        canActivate: [guard('MOD_CONFIGURACOES')],
        loadChildren: () => import('./settings/settings.module').then(m => m.SettingsModule),
      },

      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ]
  },

  { path: '**', redirectTo: 'login' }
];