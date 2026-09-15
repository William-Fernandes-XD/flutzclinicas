export type ExportCell = string | number | boolean | null | undefined;

export type ExportColumn<T> = {
  header: string;
  value: (row: T) => ExportCell;
};

function cellText(value: ExportCell): string {
  if (value == null || value === "") return "";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60) || "exportacao";
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function matrix<T>(columns: ExportColumn<T>[], rows: T[]): { headers: string[]; data: string[][] } {
  return {
    headers: columns.map((column) => column.header),
    data: rows.map((row) => columns.map((column) => cellText(column.value(row)))),
  };
}

export function exportExcel<T>(opts: {
  filename: string;
  title?: string;
  columns: ExportColumn<T>[];
  rows: T[];
}) {
  const { headers, data } = matrix(opts.columns, opts.rows);
  const sheetName = xmlEscape((opts.title ?? "Dados").slice(0, 31) || "Dados");
  const headerRow = `<Row>${headers.map((header) => `<Cell><Data ss:Type="String">${xmlEscape(header)}</Data></Cell>`).join("")}</Row>`;
  const body = data
    .map(
      (row) =>
        `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${xmlEscape(cell)}</Data></Cell>`).join("")}</Row>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${sheetName}">
  <Table>${headerRow}${body}</Table>
 </Worksheet>
</Workbook>`;
  download(`${slug(opts.filename)}.xls`, new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" }));
}

export function exportPdf<T>(opts: {
  filename: string;
  title: string;
  columns: ExportColumn<T>[];
  rows: T[];
}) {
  const { headers, data } = matrix(opts.columns, opts.rows);
  const when = new Date().toLocaleString("pt-BR");
  const tableHead = headers.map((header) => `<th>${xmlEscape(header)}</th>`).join("");
  const tableBody = data
    .map((row) => `<tr>${row.map((cell) => `<td>${xmlEscape(cell) || "—"}</td>`).join("")}</tr>`)
    .join("");
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${xmlEscape(opts.title)}</title>
  <style>
    body { font-family: "Segoe UI", sans-serif; color: #1a1423; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    p { color: #6b6475; font-size: 12px; margin: 0 0 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #e4dceb; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f6f1fb; }
    @media print { body { margin: 12px; } }
  </style>
</head>
<body>
  <h1>${xmlEscape(opts.title)}</h1>
  <p>Flutz · ${xmlEscape(when)} · ${data.length} registro(s)</p>
  <table>
    <thead><tr>${tableHead}</tr></thead>
    <tbody>${tableBody || `<tr><td colspan="${headers.length}">Nenhum registro.</td></tr>`}</tbody>
  </table>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;
  const popup = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");
  if (!popup) {
    download(`${slug(opts.filename)}.html`, new Blob([html], { type: "text/html;charset=utf-8" }));
    return;
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}

export function exportTable<T>(
  format: "excel" | "pdf",
  opts: { filename: string; title: string; columns: ExportColumn<T>[]; rows: T[] },
) {
  if (format === "excel") exportExcel(opts);
  else exportPdf(opts);
}
