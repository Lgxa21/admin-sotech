import "server-only";
import ExcelJS from "exceljs";

type Col = { header: string; key: string; width?: number; money?: boolean; date?: boolean };

// Libro de Excel con el estilo del sistema: encabezado negro, columnas de dinero con 2 decimales.
export function workbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sotech";
  wb.created = new Date();
  return wb;
}

export function sheet(wb: ExcelJS.Workbook, name: string, cols: Col[], rows: Record<string, unknown>[], totals?: Record<string, number | string>) {
  const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16 }));
  ws.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111111" } };
    cell.alignment = { vertical: "middle" };
  });
  ws.getRow(1).height = 22;
  for (const r of rows) ws.addRow(r);
  if (totals) {
    const row = ws.addRow(totals);
    row.font = { bold: true };
    row.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFD400" } }; });
  }
  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (c.money) col.numFmt = "#,##0.00";
    if (c.date) col.numFmt = "dd/mm/yyyy";
  });
  return ws;
}

export async function xlsxResponse(wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// "2026-10-27" → Date a mediodía (evita que Excel lo corra un día)
export const day = (d: string | null | undefined) => (d ? new Date(`${d}T12:00:00Z`) : null);
export const caracasDay = (d: Date | null | undefined) => (d ? day(d.toLocaleDateString("en-CA", { timeZone: "America/Caracas" })) : null);
