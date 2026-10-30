// src/app/models/premiacao-confirmacao.model.ts

export type TipoPremiacao = 'VENDEDOR' | 'GESTOR';
export type EmailStatus = 'PENDENTE' | 'ENVIADO' | 'FALHA';

export interface ConfirmacaoInfo {
  id: number;
  versao: number;
  confirmadoPor: string;
  confirmadoEm: string;
  totalPremiacao: number;
  qtdPremiados: number;
  qtdLinhas: number;
  codigoConferencia: string;
  integridadeOk: boolean;
  emailStatus: EmailStatus;
  emailDestinatarios: string | null;
  emailEnviadoEm: string | null;
  emailErro: string | null;
}

export interface ReaberturaInfo {
  versao: number;
  reabertoPor: string;
  reabertoEm: string;
  motivo: string;
}

export interface StatusCompetencia {
  tipo: TipoPremiacao;
  mes: number;
  ano: number;
  competenciaEncerrada: boolean;
  confirmada: boolean;
  confirmacao: ConfirmacaoInfo | null;
  ultimaReabertura: ReaberturaInfo | null;
}

export interface ResultadoEmail {
  status: 'ENVIADO' | 'FALHA';
  destinatarios: string[];
  modoTeste: boolean;
  erro?: string;
}

export interface ResultadoConfirmacao {
  status: StatusCompetencia;
  email: ResultadoEmail;
}