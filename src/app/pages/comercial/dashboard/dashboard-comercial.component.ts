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

// service que você criou para chamar o backend
import { DashboardComercialService, IndicadorEmpresa } from '../../../services/dashboard-comercial.service';
import { EmpresaService } from '../../../services/empresa.service';

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
  dataInicio = new Date();
  dataFim = new Date();

  carregando = false;
  cards: IndicadorEmpresa[] = [];      // um card por empresa
  metas: Record<number, { metaFat?: number; metaMargem?: number }> = {}; // se quiser manter metas locais

  constructor(
    private dashSvc: DashboardComercialService,
    private empresaSvc: EmpresaService
  ) {}

  ngOnInit(): void {
    // data padrão: hoje (mas você pode setar 1º dia do mês e hoje)
    this.buscar();
  }

  toISO(d: Date) {
    return d.toISOString().slice(0, 10);
  }

    async buscar() {
    try {
      this.carregando = true;
      // exemplo: primeiro busca empresas e gera cards vazios
      const empresas = await this.empresaSvc.getEmpresas().toPromise();
      // mapeia empresas para ID/apelido, adequar as props conforme retorno da API
      const map = (empresas || []).map(e => ({ idEmpresa: e.id, apelido: e.apelido }));

      // chama backend de indicadores com as datas
      const d1 = this.dataInicio.toISOString().slice(0, 10);
      const d2 = this.dataFim.toISOString().slice(0, 10);
      const indicadores = await this.dashSvc.indicadores(d1, d2).toPromise();

      // junta as listas por idEmpresa
      const porId = new Map<number, IndicadorEmpresa>();
      (indicadores || []).forEach(i => porId.set(i.idEmpresa, i));

      this.cards = map.map(m => ({
        idEmpresa: m.idEmpresa,
        apelido  : m.apelido,
        faturamento: porId.get(m.idEmpresa)?.faturamento ?? 0,
        lucro      : porId.get(m.idEmpresa)?.lucro ?? 0,
      }));
    } finally {
      this.carregando = false;
    }
  }

  // util para formatar moeda (se você ainda não usa pipe currency)
  moeda(v: number | null | undefined): string {
    const n = Number(v || 0);
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  margemReal(c: IndicadorEmpresa): number {
    const fat = c.faturamento || 0;
    if (!fat) return 0;
    return (c.lucro || 0) / fat;
  }

  get faturamentoTotal(): number {
    return this.cards.reduce((s, c) => s + (c.faturamento || 0), 0);
  }
  
  get lucroTotal(): number {
    return this.cards.reduce((s, c) => s + (c.lucro || 0), 0);
  }
}

