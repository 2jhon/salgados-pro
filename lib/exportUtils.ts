
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Re-declarando o tipo para evitar problemas com @types se não estiverem instalados corretamente
declare module 'jspdf' {
  interface jsPDF {
    autoTable: any;
  }
}

export const exportToExcel = (data: any[], fileName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportToPDF = (headers: string[], data: any[][], fileName: string, title?: string) => {
  const doc = new jsPDF();
  
  if (title) {
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);
  }

  doc.autoTable({
    head: [headers],
    body: data,
    startY: title ? 40 : 20,
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229] }, // indigo-600
    styles: { fontSize: 8, cellPadding: 2 },
  });

  doc.save(`${fileName}.pdf`);
};
