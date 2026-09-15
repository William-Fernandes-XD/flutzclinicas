import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronRight, ClipboardList, Download, PawPrint, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { AvaliarClinicaModal } from "../../components/clinic/AvaliarClinicaModal";
import { AtendimentosPorPetPanel, fromAgendaSolicitacao } from "../../components/clinic/AtendimentosPorPetPanel";
import { Button } from "../../components/ui/Button";
import { LoadingState } from "../../components/ui/EmptyState";
import { statusAgenda } from "../../lib/agenda";
import { exportTable } from "../../lib/export";
import { api, type AvaliacaoPendente } from "../../services/api";

export function ClientAtendimentosPage() {
  const agenda = useQuery({ queryKey: ["agenda-solicitacoes"], queryFn: () => api.agendaSolicitacoes() });
  const pendentes = useQuery({ queryKey: ["avaliacoes-pendentes"], queryFn: api.avaliacoesPendentes });
  const [avaliar, setAvaliar] = useState<AvaliacaoPendente | null>(null);

  const itens = useMemo(() => (agenda.data ?? []).map(fromAgendaSolicitacao), [agenda.data]);
  const destaque = useMemo(() => (pendentes.data ?? [])[0] ?? null, [pendentes.data]);

  const exportCols = [
    { header: "Pet", value: (row: (typeof itens)[number]) => row.pet },
    { header: "Status", value: (row: (typeof itens)[number]) => statusAgenda(row.statusCodigo, row.status) },
    { header: "Motivo", value: (row: (typeof itens)[number]) => row.resumo ?? "" },
    { header: "Clínica", value: (row: (typeof itens)[number]) => row.clinica },
    { header: "Profissional", value: (row: (typeof itens)[number]) => row.profissional ?? "" },
    { header: "Data", value: (row: (typeof itens)[number]) => new Date(row.quando).toLocaleString("pt-BR") },
  ];

  if (agenda.isLoading) return <LoadingState />;

  return (
    <div className="pb-8">
      <section className="relative mb-5 overflow-hidden rounded-3xl border border-[#ebe4f4] bg-white p-5 shadow-sm sm:p-6">
        <PawPrint className="pointer-events-none absolute -top-4 -right-2 size-28 text-[#f3eafc] sm:size-36" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#7828c8] text-white shadow-md shadow-[#7828c8]/30 sm:size-14">
              <ClipboardList className="size-6 sm:size-7" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-[#1f1630] sm:text-2xl">Meus atendimentos</h1>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#6e6680]">
                Seus pets e o último atendimento de cada um. Abra o histórico completo quando quiser.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="!rounded-full bg-white"
              onClick={() =>
                exportTable("excel", {
                  filename: "meus-atendimentos",
                  title: "Meus atendimentos",
                  columns: exportCols,
                  rows: itens,
                })
              }
            >
              <Download className="size-4" />
              Excel
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="!rounded-full bg-white"
              onClick={() =>
                exportTable("pdf", {
                  filename: "meus-atendimentos",
                  title: "Meus atendimentos",
                  columns: exportCols,
                  rows: itens,
                })
              }
            >
              <Download className="size-4" />
              PDF
            </Button>
          </div>
        </div>
      </section>

      {destaque ? (
        <section className="mb-5 flex flex-col gap-4 rounded-3xl border border-[#ebe4f4] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#f3eafc] text-[#7828c8]">
              <Building2 className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.14em] text-[#7828c8] uppercase">Avaliar clínica</p>
              <p className="mt-0.5 text-base font-semibold text-[#1f1630]">{destaque.clinica}</p>
              <p className="text-sm text-[#6e6680]">
                {destaque.pet} · {destaque.clinica}
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:max-w-xl sm:flex-row sm:items-center sm:justify-end">
            <p className="flex items-start gap-2 text-sm text-[#6e6680] sm:max-w-xs">
              <Star className="mt-0.5 size-4 shrink-0 fill-[#7828c8] text-[#7828c8]" />
              Sua avaliação ajuda a melhorar o atendimento da clínica
            </p>
            <Button type="button" className="!rounded-full shrink-0" onClick={() => setAvaliar(destaque)}>
              <Star className="size-4" />
              Avaliar
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </section>
      ) : null}

      <AtendimentosPorPetPanel itens={itens} clinicMode={false} />

      <AvaliarClinicaModal item={avaliar} onClose={() => setAvaliar(null)} />
    </div>
  );
}
