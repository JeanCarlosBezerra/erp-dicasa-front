import { Routes } from '@angular/router';
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

/* === INÍCIO ALTERAÇÃO: imports Compras Estratégicas === */
import { ResumoExecutivoComponent } from './pages/compras-estrategicas/resumo-executivo/resumo-executivo.component';
import { AnaliseFornecedoresComponent } from './pages/compras-estrategicas/analise-fornecedores/analise-fornecedores.component';
import { AnaliseProdutosComponent } from './pages/compras-estrategicas/analise-produtos/analise-produtos.component';
import { AnaliseSpendAbcComponent } from './pages/compras-estrategicas/analise-spend-abc/analise-spend-abc.component';
import { PedidosListComponent } from './pages/pedidos-list/pedidos-list.component';
import { FaturamentoComponent } from './pages/comercial/faturamento/faturamento.component';
/* === FIM ALTERAÇÃO === */

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },

  {
    path: 'menu',
    component: Menu,
    children: [
      { path: 'home', component: HomeComponent },

      { path: 'financeiro/dashboard', component: DashboardComponent },
      { path: 'financeiro/indicadores', component: IndicadoresComponent },
      { path: 'financeiro/fluxo-caixa', component: FluxoCaixaComponent },
      { path: 'financeiro/contas-receber', component: Contasreceber },

      { path: 'pedidos-list', component: PedidosListComponent },

      { path: 'comercial/dashboard', component: DashboardComercialComponent },
      { path: 'comercial/colaborador', component: ColaboradorComponent },
      { path: 'comercial/faturamento', component: FaturamentoComponent },

      { path: 'estoque/produtos', component: ProdutosComponent },

      /* === INÍCIO ALTERAÇÃO: rotas Compras Estratégicas === */
      { path: 'compras-estrategicas/resumo-executivo', component: ResumoExecutivoComponent },
      { path: 'compras-estrategicas/analise-fornecedores', component: AnaliseFornecedoresComponent },
      { path: 'compras-estrategicas/analise-produtos', component: AnaliseProdutosComponent },
      { path: 'compras-estrategicas/analise-spend-abc', component: AnaliseSpendAbcComponent },
      /* === FIM ALTERAÇÃO === */

      {
        path: 'settings',
        loadChildren: () =>
          import('./settings/settings.module').then(m => m.SettingsModule),
      },

      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ]
  },

  { path: '**', redirectTo: 'login' }
];