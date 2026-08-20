import ExcelJS from "exceljs";

export type ExcelColumn = { header: string; key: string; width?: number };

export async function buildExcelResponse(
  filename: string,
  sheetName: string,
  columns: ExcelColumn[],
  rows: Record<string, unknown>[]
) {
  return buildMultiSheetExcelResponse(filename, [{ name: sheetName, columns, rows }]);
}

export type ExcelSheet = {
  name: string;
  columns: ExcelColumn[];
  rows: Record<string, unknown>[];
};

/** Un solo .xlsx con varias pestañas — usado por Reportes para juntar
 * Ingresos y Gastos en una sola descarga en vez de dos archivos sueltos. */
export async function buildMultiSheetExcelResponse(filename: string, sheets: ExcelSheet[]) {
  const workbook = new ExcelJS.Workbook();

  for (const { name, columns, rows } of sheets) {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 20 }));
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
