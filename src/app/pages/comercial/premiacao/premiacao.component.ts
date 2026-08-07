import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { PremiacaoVendedorComponent } from './premiacao-vendedor/premiacao-vendedor.component';
import { PremiacaoGestorComponent } from './premiacao-gestor/premiacao-gestor.component';


@Component({
  selector: 'app-premiacao',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatIconModule,
    PremiacaoVendedorComponent,
    PremiacaoGestorComponent,
  ],
  templateUrl: './premiacao.component.html',
  styleUrl: './premiacao.component.scss',
})
export class PremiacaoComponent {}