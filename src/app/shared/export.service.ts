import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  exportToExcel(headers: string[], rows: any[][], fileName: string): void {
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    FileSaver.saveAs(blob, `${fileName}.xlsx`);
  }

exportToPDF(
  headers: string[],
  rows: any[][],
  filename: string,
  infoCabecalho: Record<string, any> = {}
): void {
  const doc = new jsPDF();

  // Cabeçalho do relatório
  doc.setFontSize(14);
  doc.text('Relatório de Produtividade por Colaborador', 14, 15);

  // Subcabeçalho com os filtros utilizados
  doc.setFontSize(10);
  if (infoCabecalho.dataInicio && infoCabecalho.dataFim) {
    const ini = new Date(infoCabecalho.dataInicio).toLocaleDateString();
    const fim = new Date(infoCabecalho.dataFim).toLocaleDateString();
    doc.text(`Período: ${ini} a ${fim}`, 14, 22);
  }

  if (infoCabecalho.empresa !== undefined) {
    doc.text(`Empresa: ${infoCabecalho.empresa}`, 14, 28);
  }

  // Tabela com dados
  autoTable(doc, {
    startY: 35,
    head: [headers],
    body: rows,
  });

  doc.save(`${filename}.pdf`);
}
}
