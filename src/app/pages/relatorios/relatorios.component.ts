import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface Empresa { IDEMPRESA: number; EMPALIAS: string; }
interface Divisao { IDDIVISAO: number; DESCRDIVISAO: string; }


@Component({
  selector: 'app-relatorios',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './relatorios.component.html',
  styleUrls: ['./relatorios.component.scss'],
})
export class RelatoriosComponent {
  private cdr  = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private api  = environment.apiUrl;

  ciclos: any[] = [];
  filiais = ['HCAB','SHRM','COM1','HCAM','HCVR','ATACADO'];
  statusPdi = ['Aguardando Início','Em andamento','Concluído','Atrasado'];
  
  // Filtros avaliações
  avalCiclo  = '';
  avalFilial = '';
  avalSetor  = '';
  baixandoAval = false;
  
  // Filtros PDI
  pdiCiclo  = '';
  pdiFilial = '';
  pdiStatus = '';
  baixandoPdi = false;
  
  // Filtros ranking
  rankCiclo  = '';
  rankFilial = '';
  baixandoRank = false;

  empresas: Empresa[] = [];
  divisoes: Divisao[] = [];

  // Filtros ruptura
  rupturaEmpresa = '';
  rupturaDivisao = '';
  baixandoRuptura = false;

  // Filtros sem giro
  semGiroEmpresa = '';
  semGiroDivisao = '';
  semGiroDias    = 60;
  baixandoGiro   = false;

  ngOnInit() {
    this.http.get<Empresa[]>(`${this.api}/empresas`).subscribe({
      next: e => { this.empresas = e.filter(x => x.IDEMPRESA <= 10); this.cdr.detectChanges(); }
    });
    this.http.get<Divisao[]>(`${this.api}/estoque/alertas/divisoes`).subscribe({
      next: d => { this.divisoes = d; this.cdr.detectChanges(); }
    });
    this.http.get<any[]>(`${this.api}/rh/avaliacao/ciclos`).subscribe({
      next: c => { this.ciclos = c; if (c.length) { this.avalCiclo = c[0].id_ciclo; this.rankCiclo = c[0].id_ciclo; } this.cdr.detectChanges(); }
    });
  }

  private buildParams(empresa: string, divisao: string, extra: Record<string,any> = {}): string {
    const p: string[] = [];
    if (empresa) p.push(`empresa=${empresa}`);
    if (divisao) p.push(`divisao=${divisao}`);
    Object.entries(extra).forEach(([k,v]) => p.push(`${k}=${v}`));
    return p.length ? '?' + p.join('&') : '';
  }

  baixarRuptura() {
    this.baixandoRuptura = true;
    const url = `${this.api}/estoque/relatorios/ruptura${this.buildParams(this.rupturaEmpresa, this.rupturaDivisao)}`;
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ruptura_${new Date().toISOString().slice(0,10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.baixandoRuptura = false;
        this.cdr.detectChanges();
      },
      error: () => { this.baixandoRuptura = false; this.cdr.detectChanges(); }
    });
  }

  baixarSemGiro() {
    this.baixandoGiro = true;
    const url = `${this.api}/estoque/relatorios/sem-giro${this.buildParams(this.semGiroEmpresa, this.semGiroDivisao, { dias: this.semGiroDias })}`;
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `sem_giro_${new Date().toISOString().slice(0,10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.baixandoGiro = false;
        this.cdr.detectChanges();
      },
      error: () => { this.baixandoGiro = false; this.cdr.detectChanges(); }
    });
  }

  baixarAvaliacoes() {
  if (!this.avalCiclo) { alert('Selecione um ciclo.'); return; }
  this.baixandoAval = true;
  const p = this.buildParams('', '', { ciclo: this.avalCiclo, ...(this.avalFilial && { filial: this.avalFilial }), ...(this.avalSetor && { setor: this.avalSetor }) });
  this.http.get(`${this.api}/rh/relatorios/avaliacoes${p}`, { responseType: 'blob' }).subscribe({
    next: blob => { this.salvarBlob(blob, `avaliacoes_${this.avalCiclo}.xlsx`); this.baixandoAval = false; this.cdr.detectChanges(); },
    error: () => { this.baixandoAval = false; this.cdr.detectChanges(); }
  });
}

baixarPdi() {
  this.baixandoPdi = true;
  const p = this.buildParams('', '', { ...(this.pdiCiclo && { ciclo: this.pdiCiclo }), ...(this.pdiFilial && { filial: this.pdiFilial }), ...(this.pdiStatus && { status: this.pdiStatus }) });
  this.http.get(`${this.api}/rh/relatorios/pdi${p}`, { responseType: 'blob' }).subscribe({
    next: blob => { this.salvarBlob(blob, `pdi.xlsx`); this.baixandoPdi = false; this.cdr.detectChanges(); },
    error: () => { this.baixandoPdi = false; this.cdr.detectChanges(); }
  });
}

baixarRanking() {
  if (!this.rankCiclo) { alert('Selecione um ciclo.'); return; }
  this.baixandoRank = true;
  const p = this.buildParams('', '', { ciclo: this.rankCiclo, ...(this.rankFilial && { filial: this.rankFilial }) });
  this.http.get(`${this.api}/rh/relatorios/ranking${p}`, { responseType: 'blob' }).subscribe({
    next: blob => { this.salvarBlob(blob, `ranking_9box.xlsx`); this.baixandoRank = false; this.cdr.detectChanges(); },
    error: () => { this.baixandoRank = false; this.cdr.detectChanges(); }
  });
}

private salvarBlob(blob: Blob, nome: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}
}