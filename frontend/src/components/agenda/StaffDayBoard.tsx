import { Avatar } from "../ui/Avatar";
import { AppointmentBlock, type AgendaItemView } from "./AppointmentBlock";

export type StaffColumn = {
  id: number | null;
  nome: string;
  cargo?: string | null;
  fotoUrl?: string | null;
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 07–18
const STAFF_COL = "13.5rem";
const HOUR_COL = "9.5rem";

function hourOf(item: AgendaItemView): number {
  return new Date(item.inicio).getHours();
}

function freePct(totalSlots: number, used: number): number {
  if (totalSlots <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(((totalSlots - used) / totalSlots) * 100)));
}

export function StaffDayBoard({
  staff,
  items,
  onSelect,
}: {
  staff: StaffColumn[];
  items: AgendaItemView[];
  onSelect: (item: AgendaItemView) => void;
}) {
  const rows: StaffColumn[] = [{ id: null, nome: "A definir", cargo: "Sem profissional" }, ...staff];
  const byStaff = new Map<number | "none", AgendaItemView[]>();
  byStaff.set("none", []);
  for (const member of staff) byStaff.set(member.id!, []);
  for (const item of items) {
    const key = item.colaboradorId == null ? "none" : item.colaboradorId;
    if (!byStaff.has(key === "none" ? "none" : key)) {
      byStaff.set("none", [...(byStaff.get("none") ?? []), item]);
      continue;
    }
    byStaff.get(key === "none" ? "none" : key)!.push(item);
  }

  const slotBudget = HOURS.length * 2;
  const gridCols = `${STAFF_COL} repeat(${HOURS.length}, minmax(${HOUR_COL}, 1fr))`;

  return (
    <div className="living-card overflow-auto">
      <div className="min-w-max">
        <div
          className="sticky top-0 z-20 grid border-b border-line bg-white dark:border-zinc-800 dark:bg-zinc-950"
          style={{ gridTemplateColumns: gridCols }}
        >
          <div className="sticky left-0 z-30 border-r border-line bg-white px-3 py-3 text-xs font-semibold tracking-wide text-muted uppercase dark:border-zinc-800 dark:bg-zinc-950">
            Equipe
          </div>
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="border-l border-line px-2 py-3 text-center text-xs font-semibold text-muted dark:border-zinc-800"
            >
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {rows.map((row) => {
          const list = byStaff.get(row.id == null ? "none" : row.id) ?? [];
          const pct = freePct(slotBudget, list.length);
          return (
            <div
              key={row.id ?? "none"}
              className="grid border-b border-line/70 last:border-0 dark:border-zinc-800"
              style={{ gridTemplateColumns: gridCols }}
            >
              <div className="sticky left-0 z-10 border-r border-line bg-[#faf8fc] px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center gap-2">
                  <Avatar name={row.nome} src={row.fotoUrl} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{row.nome}</p>
                    <p className="truncate text-[11px] text-muted">{row.cargo || "Equipe"}</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line dark:bg-zinc-800">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${100 - pct}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  {list.length} {list.length === 1 ? "marcação" : "marcações"} · {pct}% livre
                </p>
              </div>
              {HOURS.map((hour) => {
                const hourItems = list.filter((item) => hourOf(item) === hour);
                return (
                  <div
                    key={`${row.id ?? "none"}-${hour}`}
                    className="min-h-[5.5rem] space-y-1.5 border-l border-line/70 p-2 dark:border-zinc-800"
                  >
                    {hourItems.map((item) => (
                      <AppointmentBlock key={item.id} item={item} compact onClick={() => onSelect(item)} />
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
