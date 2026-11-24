// src/app/services/dias-venda.util.ts
//
// Calendário de dias de venda do Comercial.
// Padrão: segunda a sábado é dia de venda, domingo não.
// Exceções cadastradas em Metas > Dias de venda:
//   FECHADO = dia de semana em que a loja não abriu (Natal, Dia do Comerciário...)
//   ABERTO  = domingo em que a loja abriu
// Exceção de uma loja vale mais que a exceção de "todas as lojas".

export type TipoExcecao = 'FECHADO' | 'ABERTO';

export interface ExcecaoDiaVenda {
  id?: number;
  data: string;               // yyyy-mm-dd
  id_empresa: number | null;  // null = todas as lojas
  tipo: TipoExcecao;
  descricao: string | null;
  criado_por?: string | null;
}

export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A exceção que vale para o dia e a loja (a da loja primeiro, depois a de todas). */
export function excecaoDoDia(iso: string, excecoes: ExcecaoDiaVenda[], idEmpresa: number | null): ExcecaoDiaVenda | undefined {
  if (idEmpresa != null) {
    const daLoja = excecoes.find(e => e.data === iso && e.id_empresa === idEmpresa);
    if (daLoja) return daLoja;
  }
  return excecoes.find(e => e.data === iso && e.id_empresa == null);
}

export function ehDiaDeVenda(d: Date, excecoes: ExcecaoDiaVenda[], idEmpresa: number | null): boolean {
  const exc = excecaoDoDia(isoLocal(d), excecoes, idEmpresa);
  if (exc) return exc.tipo === 'ABERTO';
  return d.getDay() !== 0;
}

/** Dias de venda entre duas datas (inclusive). idEmpresa null = calendário geral (todas as lojas). */
export function contarDiasVenda(inicio: Date, fim: Date, excecoes: ExcecaoDiaVenda[], idEmpresa: number | null): number {
  const cur = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const end = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
  let n = 0;
  while (cur <= end) {
    if (ehDiaDeVenda(cur, excecoes, idEmpresa)) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}
