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

  exportToPDF(headers: string[], rows: any[][], fileName: string): void {
    const doc = new jsPDF('landscape');
    autoTable(doc, {
      head: [headers],
      body: rows,
    });
    doc.save(`${fileName}.pdf`);
  }
}
