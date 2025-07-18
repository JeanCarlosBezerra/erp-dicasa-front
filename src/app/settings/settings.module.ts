import { NgModule }      from '@angular/core';
import { CommonModule }  from '@angular/common';
import { SettingsRoutingModule } from './settings-routing.module';

// componentes standalone
import { PermissoesComponent } from './permissoes/permissoes.component';
import { GeralComponent }      from './geral/geral.component';

@NgModule({
  imports: [
    CommonModule,
    SettingsRoutingModule,
    PermissoesComponent,
    GeralComponent,
  ],
})
export class SettingsModule {}
