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
    const [empresas, indic] = await Promise.all([
      this.empresaSvc.getEmpresas().toPromise(),                // [{id, apelido}, ...]
      this.dashSvc.indicadores(this.dataISO(this.dataInicio),
                               this.dataISO(this.dataFim)).toPromise() // [{idEmpresa, faturamento, lucro}, ...]
    ]);

    // cria um mapa de empresas por id para pegar o apelido
    const empMap = new Map<number, { id: number; apelido: string }>();
    (empresas ?? []).forEach(e => empMap.set(e.id, e));

    // enriquece os indicadores com o apelido e **filtra** só quem tem valor
    this.cards = (indic ?? [])
    .map(i => ({
    ...i,
    apelido: empMap.get(i.idEmpresa)?.apelido ?? String(i.idEmpresa)
    }))
    .filter(i => (i.faturamento ?? 0) > 0 || (i.lucro ?? 0) > 0);

    // agora os totais do seu template vão somar certo
  } finally {
    this.carregando = false;
  }
}

private dataISO(d: Date) {
  return d?.toISOString().slice(0, 10);
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

