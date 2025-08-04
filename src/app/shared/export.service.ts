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
  infoCabecalho: { dataInicio?: Date; dataFim?: Date; empresa?: number } = {}
): void {
  const doc = new jsPDF();

  // Logo no canto superior direito
  const logoBase64 = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZAAAAGQCAMAAAD+nJ/TAAAAhFBMVEUAAAD///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////9gHeM9AAAALXRSTlMAEBAgIDAwMFBQUFxcX2BgYGFhYmNjZ2dnZ2hoaGxsb29vc3N3d3e3u7u7u7+/v7+/v7+/tDUvlAAANFElEQVR4nO3b23KqMBBF0XzFggAiR9n9X5R12eFkCRl1Ntvnv2biJgKpEyTFEUAAAAAAAAAAAAAAAAAAAAAAAAA+LPNOS4N/ay77OtqvPj39JDeMH8C7Q/hTGbC3xqyuF+ObP+1G4/yz2fPh7QfMaHeCf5O3I3R39vC7YUdwe3JXVpHg0x/5HOSMyx+Mw//SlQzPN1kAv2FYzPdZer2UKG9Q6LmvPznDfVNo2Hcf57P0MH2VjvvvQ9MY9zqf6A8ZvjF5xZbfrq1fdfONZXDH2yR7s2m7N+LG7zqN+7t+2z4N9d4OEbbE3zbTo9z5U7r9Pr6wGxyk7X6zqnfbxOea5uPfbk+Nd2fjfbv0O+ZEn3qT1GMzHY/OfX7vSvb0/jHF4PTTceBLKGP3PbMNqebfTjPkfRrfOy+ddvqfbTeOfQ3Zsz3dY6f2bj2+baZjfl+8DW3B1vPOdzr1m+I92fQdV8Z7OpzvntV9fjfV/oPXv+CPQ5+d+6VXk3E4P3NH+pvuX3HwVvOZ/3k/Z5HvDwXzfrgG26+NvnWHpX88Vn1m+/meXvBz2/mC8Tq9V7yZdd+cfuJX8dt5jxAAAAAElFTkSuQmCC`;

  doc.addImage(logoBase64, 'PNG', 160, 10, 35, 15); // (x, y, width, height)

  // Título
  doc.setFontSize(14);
  doc.text('Relatório de Produtividade por Colaborador', 14, 15);

  // Subtítulo com filtros
  doc.setFontSize(10);
  let linha = 22;

  if (infoCabecalho.dataInicio && infoCabecalho.dataFim) {
    const ini = new Date(infoCabecalho.dataInicio).toLocaleDateString();
    const fim = new Date(infoCabecalho.dataFim).toLocaleDateString();
    doc.text(`Período: ${ini} a ${fim}`, 14, linha);
    linha += 6;
  }

  if (infoCabecalho.empresa !== undefined) {
    doc.text(`Empresa: ${infoCabecalho.empresa}`, 14, linha);
    linha += 6;
  }

  // Tabela
  autoTable(doc, {
    startY: linha + 5,
    head: [headers],
    body: rows,
  });

  doc.save(`${filename}.pdf`);
}
}
