// src/app/settings/settings-routing.module.ts
import { NgModule }             from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PermissoesComponent } from './permissoes/permissoes.component';
import { GeralComponent }       from './geral/geral.component';
import { AuthGuard } from '../guards/auth.guard';

const routes: Routes = [
  { path: 'permissions', component: PermissoesComponent, canActivate: [AuthGuard] },
  { path: 'geral',       component: GeralComponent,       canActivate: [AuthGuard] },
  { path: '', redirectTo: 'permissions', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SettingsRoutingModule {}
