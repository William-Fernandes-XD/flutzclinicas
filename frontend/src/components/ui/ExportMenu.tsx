import { Button } from "./Button";
import { exportTable, type ExportColumn } from "../../lib/export";

export function ExportMenu<T>({
  filename,
  title,
  columns,
  rows,
  disabled,
}: {
  filename: string;
  title: string;
  columns: ExportColumn<T>[];
  rows: T[];
  disabled?: boolean;
}) {
  const empty = disabled || rows.length === 0;
  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      <Button
        variant="secondary"
        disabled={empty}
        onClick={() => exportTable("excel", { filename, title, columns, rows })}
      >
        Excel
      </Button>
      <Button
        variant="secondary"
        disabled={empty}
        onClick={() => exportTable("pdf", { filename, title, columns, rows })}
      >
        PDF
      </Button>
    </div>
  );
}
