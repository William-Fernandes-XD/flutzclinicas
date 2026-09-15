import { AppointmentBlock, type AgendaItemView } from "./AppointmentBlock";

const COLUMNS: { id: string; title: string; match: (codigo: string) => boolean }[] = [
  { id: "solicitado", title: "Solicitado", match: (c) => c === "SOLICITADO" },
  { id: "pagamento", title: "Aguardando pagamento", match: (c) => c === "AGUARDANDO_PAGAMENTO" },
  { id: "confirmado", title: "Confirmado", match: (c) => c === "CONFIRMADO" },
  { id: "aguardando", title: "Aguardando tutor", match: (c) => c === "AGUARDANDO_CLIENTE" },
  {
    id: "encerrados",
    title: "Encerrados",
    match: (c) => ["RECUSADO", "CANCELADO", "CANCELADO_CLIENTE", "CANCELADO_CLINICA", "FALTOU", "CONCLUIDO"].includes(c),
  },
];

export function AgendaKanban({
  items,
  onSelect,
}: {
  items: AgendaItemView[];
  onSelect: (item: AgendaItemView) => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-5">
      {COLUMNS.map((column) => {
        const rows = items.filter((item) => column.match((item.statusCodigo ?? "").toUpperCase()));
        return (
          <section key={column.id} className="living-card flex min-h-72 flex-col p-3">
            <div className="mb-3 flex items-center justify-between gap-2 px-1">
              <h3 className="text-sm font-semibold">{column.title}</h3>
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand">{rows.length}</span>
            </div>
            <ul className="flex flex-1 flex-col gap-2">
              {!rows.length ? (
                <li className="rounded-2xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted dark:border-zinc-700">
                  Nenhum item
                </li>
              ) : (
                rows.map((item) => (
                  <li key={item.id}>
                    <AppointmentBlock item={item} onClick={() => onSelect(item)} />
                  </li>
                ))
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
