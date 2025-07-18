// src/app/settings/settings.module.ts
import { NgModule }      from '@angular/core';
import { CommonModule }  from '@angular/common';
import { FormsModule }   from '@angular/forms';

// Angular Material
import { MatListModule }      from '@angular/material/list';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule }      from '@angular/material/icon';
import { MatButtonModule }    from '@angular/material/button';

import { SettingsRoutingModule }   from './settings-routing.module';
// São componentes *standalone*, portanto importamos aqui:
import { PermissoesComponent }     from './permissoes/permissoes.component';
import { GeralComponent }          from './geral/geral.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    MatListModule,
    MatExpansionModule,
    MatIconModule,
    MatButtonModule,
    SettingsRoutingModule,
    PermissoesComponent,
    GeralComponent,
  ],
})
export class SettingsModule {}
