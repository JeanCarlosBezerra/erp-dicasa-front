// src/app/pages/comercial/dashboard/dashboard-comercial.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom, combineLatest } from 'rxjs';

// service que você criou para chamar o backend
import { DashboardComercialService, IndicadorEmpresa } from '../../../services/dashboard-comercial.service';
import { EmpresaService } from '../../../services/empresa.service';

interface EmpresaLite {
  id: number;
  apelido: string; // EMPALIAS / NOMEFANTASIA
}

interface IndicadorEmpresaComercial {
  idEmpresa: number;
  faturamento: number;
  lucro: number;
  // % lucro você já calcula no component
}

@Component({
  selector: 'app-dashboard-comercial',
  templateUrl: './dashboard-comercial.component.html',
  styleUrls: ['./dashboard-comercial.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
  ],
})


export class DashboardComercialComponent implements OnInit {
  
  cards: Array<IndicadorEmpresaComercial & { apelido?: string }> = [];

  dataInicio = new Date();
  dataFim = new Date();

  carregando = false;
  //cards: IndicadorEmpresa[] = [];      // um card por empresa
  metas: Record<number, { metaFat?: number; metaMargem?: number }> = {}; // se quiser manter metas locais

  constructor(
    private dashSvc: DashboardComercialService,
    private empresaSvc: EmpresaService
  ) {}

  ngOnInit(): void {
    // data padrão: hoje (mas você pode setar 1º dia do mês e hoje)
    this.buscar();
  }

async buscar() {
    this.carregando = true;
    try {
      const empresas = await firstValueFrom(this.empresaSvc.getEmpresas()); // EmpresaLite[]
      const indic    = await firstValueFrom(
        this.dashSvc.indicadores(this.dataISO(this.dataInicio), this.dataISO(this.dataFim))
      ); // { idEmpresa, faturamento, lucro }[]

      // mapa id -> apelido
      const empMap = new Map<number, string>();
      empresas.forEach(e => empMap.set(e.id, e.apelido));

      // monta os cards, garantindo tipos numéricos e apelido string
      this.cards = (indic ?? [])
        .map(i => {
          const idEmp = Number((i as any).idEmpresa);
          return {
            idEmpresa   : idEmp,
            faturamento : Number((i as any).faturamento) || 0,
            lucro       : Number((i as any).lucro) || 0,
            apelido     : empMap.get(idEmp) ?? String(idEmp),
          };
        })
        .filter(c => c.faturamento > 0 || c.lucro > 0);
    } finally {
      this.carregando = false;
    }
  }

 private dataISO(d: Date) { return d?.toISOString().slice(0, 10); }

  moeda(v?: number | null) {
    const n = Number(v || 0);
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  margemReal(c: IndicadorEmpresaComercial) {
    const fat = c.faturamento || 0;
    return fat ? (c.lucro || 0) / fat : 0;
  }

  get faturamentoTotal() {
    return this.cards.reduce((s, c) => s + (c.faturamento || 0), 0);
  }
  get lucroTotal() {
    return this.cards.reduce((s, c) => s + (c.lucro || 0), 0);
  }
}
