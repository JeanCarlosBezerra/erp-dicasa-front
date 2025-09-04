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

// troque por um tipo "Card" que aceita null no id e tem apelido
type IndicadorCard = {
  idEmpresa: number | null;   // 👈 pode vir null
  faturamento: number;
  lucro: number;
  apelido: string;            // 👈 string garantida
};

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
  
  cards: IndicadorCard[] = [];

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
    console.log('--- BUSCAR INÍCIO ---',
      this.dataISO(this.dataInicio), this.dataISO(this.dataFim));

    const empresas = await firstValueFrom(this.empresaSvc.getEmpresas());
    console.log('[BUSCAR] empresas (lite):', empresas);                 // ⬅️ log A

    const indic = await firstValueFrom(
      this.dashSvc.indicadores(
        this.dataISO(this.dataInicio),
        this.dataISO(this.dataFim)
      )
    );
    console.log('[BUSCAR] indicadores:', indic);                        // ⬅️ log B

    // mapa id -> apelido (string!)
    const empMap = new Map<number, string>();
    for (const e of (empresas ?? [])) {
      empMap.set(Number(e.id), String(e.apelido));
    }
    console.log('[BUSCAR] empMap:', Array.from(empMap.entries()));      // ⬅️ log C

    // monta cards tipados e loga cada um
    this.cards = (indic ?? [])
      .map((i: any) => {
    // Pega todas as variações possíveis de nome:
    const idRaw =
      i?.idEmpresa ??
      i?.IDEMPRESA ??
      i?.idempresa ??
      i?.empresa ??
      i?.ID_EMPRESA;

    const idEmp = (idRaw === null || idRaw === undefined || idRaw === '')
      ? undefined
      : Number(idRaw);

    const faturamento = Number(i?.faturamento ?? i?.FATURAMENTO) || 0;
    const lucro       = Number(i?.lucro ?? i?.LUCRO) || 0;

    // Se não tem id, não tenta achar apelido; exibe traço
    const apelido = (idEmp !== undefined && !Number.isNaN(idEmp))
      ? (empMap.get(idEmp) ?? String(idEmp))
      : '—';

    const card = { idEmpresa: idEmp ?? null, faturamento, lucro, apelido };
    console.log('[CARD]', card);
    return card;
  })
  // mantém a filtragem por valor
  .filter(c => c.faturamento > 0 || c.lucro > 0);

    console.log('[CARDS][FINAL]', this.cards);                          // ⬅️ log E
  } catch (err) {
    console.error('BUSCAR ERRO', err);
  } finally {
    this.carregando = false;
  }
}
  

 private dataISO(d: Date) { return d?.toISOString().slice(0, 10); }

  moeda(v?: number | null) {
    const n = Number(v || 0);
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  margemReal(c: IndicadorCard ) {
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
