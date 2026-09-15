import type { ReactNode } from "react";
import { ExportMenu } from "./ExportMenu";
import type { ExportColumn } from "../../lib/export";

export type Column<T> = {
  key: string;
  header: string;
  hideOnMobile?: boolean;
  cell: (row: T) => ReactNode;
};

export function DataTable<T extends { id: string | number }>({
  columns,
  rows,
  mobile,
  exportTitle,
  exportColumns,
}: {
  columns: Column<T>[];
  rows: T[];
  mobile: (row: T) => ReactNode;
  exportTitle?: string;
  exportColumns?: ExportColumn<T>[];
}) {
  return (
    <div className="space-y-3">
      {exportTitle && exportColumns ? (
        <div className="flex justify-end">
          <ExportMenu filename={exportTitle} title={exportTitle} columns={exportColumns} rows={rows} />
        </div>
      ) : null}
      <div className="grid gap-3 md:hidden">{rows.map((row) => <div key={row.id}>{mobile(row)}</div>)}</div>
      <div className="hidden min-w-0 md:block">
        <div className="living-card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs tracking-wide text-muted uppercase dark:border-zinc-800">
                {columns.map((column) => (
                  <th key={column.key} className="px-4 py-3 font-semibold">
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line/70 last:border-0 hover:bg-brand-soft/40 dark:border-zinc-800">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3 align-middle">
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
