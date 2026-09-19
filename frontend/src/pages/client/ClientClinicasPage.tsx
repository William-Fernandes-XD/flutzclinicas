import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bookmark,
  Calendar,
  ChevronDown,
  Clock,
  MapPin,
  PawPrint,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import heroPets from "../../assets/app/busca-clinica-hero-pets.jpg";
import { Avatar } from "../../components/ui/Avatar";
import { EmptyState, LoadingState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { formatKm, isoDate } from "../../lib/agenda";
import { readBrowserPosition } from "../../lib/geo";
import { mediaUrl } from "../../lib/media";
import { api, type AgendaClinic } from "../../services/api";

type Ordenacao = "distancia" | "nota" | "nome";
type TipoAtendimento = "presencial" | "telemedicina";

const HORAS = ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];

export function ClientClinicasPage() {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gps, setGps] = useState<"idle" | "asking" | "ok" | "denied">("idle");
  const [cidadeUf] = useState("Goiânia - GO");
  const [busca, setBusca] = useState("");
  const [dataFiltro, setDataFiltro] = useState(isoDate(new Date()));
  const [horaFiltro, setHoraFiltro] = useState("");
  const [soAbertas, setSoAbertas] = useState(false);
  const [especialidade, setEspecialidade] = useState("");
  const [maxKm, setMaxKm] = useState(250);
  const [notaMin, setNotaMin] = useState(0);
  const [tipos, setTipos] = useState<TipoAtendimento[]>(["presencial"]);
  const [ordenar, setOrdenar] = useState<Ordenacao>("distancia");
  const [reviewsDe, setReviewsDe] = useState<AgendaClinic | null>(null);
  const [painelAberto, setPainelAberto] = useState<"especialidade" | "distancia" | "avaliacao" | "tipo" | null>(null);
  const [filtrosMobileAbertos, setFiltrosMobileAbertos] = useState(false);

  const lista = useQuery({
    queryKey: ["agenda-clinicas", coords?.latitude, coords?.longitude],
    queryFn: () => api.agendaClinicas(coords?.latitude, coords?.longitude),
  });

  useEffect(() => {
    pedirGps();
  }, []);

  function pedirGps() {
    setGps("asking");
    void readBrowserPosition()
      .then((pos) => {
        const next = { latitude: pos.latitude, longitude: pos.longitude };
        setCoords(next);
        setGps("ok");
        void api.saveTutorLocation(next).catch(() => undefined);
      })
      .catch(() => setGps("denied"));
  }

  function limparFiltros() {
    setBusca("");
    setDataFiltro(isoDate(new Date()));
    setHoraFiltro("");
    setSoAbertas(false);
    setEspecialidade("");
    setMaxKm(250);
    setNotaMin(0);
    setTipos(["presencial"]);
    setOrdenar("distancia");
    setPainelAberto(null);
  }

  function toggleTipo(tipo: TipoAtendimento) {
    setTipos((atual) => {
      if (atual.includes(tipo)) {
        const next = atual.filter((item) => item !== tipo);
        return next.length ? next : atual;
      }
      return [...atual, tipo];
    });
  }

  const especialidades = useMemo(() => {
    const set = new Set<string>();
    for (const clinica of lista.data ?? []) {
      for (const item of clinica.especialidades ?? []) set.add(item);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [lista.data]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let rows = [...(lista.data ?? [])];
    if (q) {
      rows = rows.filter((item) =>
        [item.nome, item.cidade, item.uf, item.endereco, item.sobre, ...(item.servicos ?? []), ...(item.especialidades ?? [])]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q)),
      );
    }
    if (soAbertas) rows = rows.filter((item) => item.aberta);
    if (especialidade) rows = rows.filter((item) => (item.especialidades ?? []).includes(especialidade));
    if (notaMin > 0) rows = rows.filter((item) => (item.notaMedia ?? 0) >= notaMin);
    rows = rows.filter((item) => item.distanciaKm != null && item.distanciaKm <= maxKm);
    if (horaFiltro) rows = rows.filter((item) => (item.horariosHoje ?? []).includes(horaFiltro));
    if (tipos.length === 1 && tipos[0] === "telemedicina") {
      rows = rows.filter((item) =>
        [...(item.servicos ?? []), ...(item.especialidades ?? [])].some((s) => /tele/i.test(s)),
      );
    }
    rows.sort((a, b) => {
      if (ordenar === "nome") return a.nome.localeCompare(b.nome);
      if (ordenar === "nota") return (b.notaMedia ?? 0) - (a.notaMedia ?? 0);
      if (a.distanciaKm == null && b.distanciaKm == null) return a.nome.localeCompare(b.nome);
      if (a.distanciaKm == null) return 1;
      if (b.distanciaKm == null) return -1;
      return a.distanciaKm - b.distanciaKm;
    });
    return rows;
  }, [busca, coords, especialidade, horaFiltro, lista.data, maxKm, notaMin, ordenar, soAbertas, tipos]);

  const filtrosProps = {
    soAbertas,
    setSoAbertas,
    horaFiltro,
    setHoraFiltro,
    especialidade,
    setEspecialidade,
    especialidades,
    maxKm,
    setMaxKm,
    notaMin,
    setNotaMin,
    tipos,
    toggleTipo,
    limparFiltros,
  };

  return (
    <div className="min-w-0 space-y-0 overflow-x-hidden pb-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-[#eee8f6] bg-white shadow-sm sm:rounded-3xl">
        <div className="grid min-w-0 items-center md:grid-cols-[minmax(0,1.15fr)_minmax(10rem,0.85fr)]">
          <div className="flex min-w-0 items-start gap-3 px-4 py-5 sm:gap-4 sm:px-6 sm:py-7 lg:px-8">
            <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f3eafc] text-[#7828c8] sm:size-12 sm:rounded-2xl">
              <PawPrint className="size-5 sm:size-6" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight tracking-tight text-[#1f1630] sm:text-2xl lg:text-[1.85rem]">
                Encontre a clínica ideal para seu pet
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[#7a738c] sm:max-w-xl">
                Escolha a clínica mais próxima e filtre pelos horários disponíveis, especialidades e muito mais.
              </p>
            </div>
          </div>
          <div className="relative mx-auto h-36 w-full max-w-sm px-2 pb-2 sm:h-40 md:mx-0 md:h-[11.5rem] md:max-w-none md:px-0 md:pb-0 lg:h-[13rem]">
            <img
              src={heroPets}
              alt="Cachorro e gato"
              className="h-full w-full object-contain object-center md:object-right-bottom"
            />
          </div>
        </div>
      </section>

      {/* Busca */}
      <div className="relative z-10 -mt-3 px-1 sm:-mt-4 sm:px-2">
        <div className="min-w-0 rounded-2xl border border-[#ebe4f4] bg-white p-3 shadow-[0_12px_40px_rgba(70,40,120,0.08)] sm:rounded-[1.35rem] sm:p-4">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto] xl:items-end">
            <Field label="Buscar" icon={<Search className="size-3.5" />} className="sm:col-span-2 lg:col-span-2 xl:col-span-1">
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar clínica ou bairro..."
                className="field-input"
              />
            </Field>

            <Field label="Localização" icon={<MapPin className="size-3.5" />}>
              <button type="button" onClick={pedirGps} className="field-input flex items-center justify-between gap-2 text-left">
                <span className="truncate">{gps === "asking" ? "Obtendo…" : cidadeUf}</span>
                <ChevronDown className="size-4 shrink-0 text-[#8b7fa3]" />
              </button>
            </Field>

            <Field label="Data" icon={<Calendar className="size-3.5" />}>
              <input
                type="date"
                value={dataFiltro}
                onChange={(event) => setDataFiltro(event.target.value)}
                className="field-input cursor-pointer"
              />
            </Field>

            <Field label="Horário" icon={<Clock className="size-3.5" />}>
              <select
                value={horaFiltro}
                onChange={(event) => setHoraFiltro(event.target.value)}
                className="field-input"
              >
                <option value="">Qualquer horário</option>
                {HORAS.map((hora) => (
                  <option key={hora} value={hora}>
                    {hora}
                  </option>
                ))}
              </select>
            </Field>

            <button
              type="button"
              onClick={() => void lista.refetch()}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#7828c8] px-4 text-sm font-semibold text-white shadow-md shadow-[#7828c8]/25 transition hover:bg-[#6a22b4] sm:col-span-2 lg:col-span-4 xl:col-span-1 xl:w-auto xl:min-w-[10.5rem]"
            >
              <Search className="size-4 shrink-0" />
              Buscar clínicas
            </button>
          </div>

          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2 border-t border-[#f3eef8] pt-3">
            <Chip active={soAbertas} onClick={() => setSoAbertas((v) => !v)}>
              Horários abertos
            </Chip>
            <Chip
              active={painelAberto === "especialidade" || Boolean(especialidade)}
              onClick={() => setPainelAberto((v) => (v === "especialidade" ? null : "especialidade"))}
            >
              Especialidades
            </Chip>
            <Chip
              active={painelAberto === "distancia" || maxKm < 250}
              onClick={() => setPainelAberto((v) => (v === "distancia" ? null : "distancia"))}
            >
              Distância
            </Chip>
            <Chip
              active={painelAberto === "avaliacao" || notaMin > 0}
              onClick={() => setPainelAberto((v) => (v === "avaliacao" ? null : "avaliacao"))}
            >
              Avaliação
            </Chip>
            <Chip
              active={painelAberto === "tipo" || tipos.length !== 1 || tipos[0] !== "presencial"}
              onClick={() => setPainelAberto((v) => (v === "tipo" ? null : "tipo"))}
            >
              Tipo de atendimento
            </Chip>
            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#7828c8] hover:underline sm:ml-auto"
            >
              <RefreshCw className="size-3.5" />
              Limpar filtros
            </button>
          </div>

          {painelAberto === "especialidade" ? (
            <div className="mt-3 max-w-sm">
              <select
                value={especialidade}
                onChange={(event) => setEspecialidade(event.target.value)}
                className="field-input"
              >
                <option value="">Todas as especialidades</option>
                {especialidades.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {painelAberto === "distancia" ? (
            <div className="mt-3 max-w-sm">
              <p className="mb-2 text-xs font-medium text-[#7a738c]">Até {maxKm} km</p>
              <input
                type="range"
                min={0}
                max={250}
                value={maxKm}
                onChange={(event) => setMaxKm(Number(event.target.value))}
                className="w-full accent-[#7828c8]"
              />
            </div>
          ) : null}
          {painelAberto === "avaliacao" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { value: 0, label: "Qualquer" },
                { value: 3, label: "3+" },
                { value: 4, label: "4+" },
                { value: 4.5, label: "4.5+" },
              ].map((item) => (
                <Chip key={item.value} active={notaMin === item.value} onClick={() => setNotaMin(item.value)}>
                  {item.label}
                </Chip>
              ))}
            </div>
          ) : null}
          {painelAberto === "tipo" ? (
            <div className="mt-3 flex flex-wrap gap-4">
              {(["presencial", "telemedicina"] as const).map((tipo) => (
                <label key={tipo} className="inline-flex items-center gap-2 text-sm text-[#1f1630]">
                  <input
                    type="checkbox"
                    checked={tipos.includes(tipo)}
                    onChange={() => toggleTipo(tipo)}
                    className="size-4 accent-[#7828c8]"
                  />
                  {tipo === "presencial" ? "Presencial" : "Telemedicina"}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Resultados + filtros */}
      <div className="mt-5 grid min-w-0 gap-5 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_15.5rem] xl:grid-cols-[minmax(0,1fr)_16.5rem]">
        <div className="min-w-0">
          <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
            <p className="text-base font-semibold text-[#1f1630]">Clínicas encontradas ({filtradas.length})</p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltrosMobileAbertos(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#e4dcf0] bg-white px-3 py-1.5 text-xs font-semibold text-[#5c4d78] lg:hidden"
              >
                <SlidersHorizontal className="size-3.5" />
                Filtros
              </button>
              <label className="inline-flex items-center gap-1.5 text-sm text-[#7a738c]">
                <span className="hidden sm:inline">Ordenar por:</span>
                <select
                  value={ordenar}
                  onChange={(event) => setOrdenar(event.target.value as Ordenacao)}
                  className="max-w-[10rem] bg-transparent font-medium text-[#1f1630] outline-none sm:max-w-none"
                >
                  <option value="distancia">Mais próximos</option>
                  <option value="nota">Melhor avaliação</option>
                  <option value="nome">Nome</option>
                </select>
                <ChevronDown className="size-4 opacity-50" />
              </label>
            </div>
          </div>

          {lista.isLoading ? (
            <LoadingState label="Buscando clínicas…" />
          ) : !filtradas.length ? (
            <EmptyState
              title="Nenhum resultado encontrado"
              description="Não encontramos clínicas com os filtros selecionados. Tente ajustar ou remover algum filtro para ver mais opções."
              onClear={limparFiltros}
            />
          ) : (
            <ul className="space-y-3 sm:space-y-4">
              {filtradas.map((clinica) => (
                <ClinicaCard
                  key={clinica.id}
                  clinica={clinica}
                  horaSelecionada={horaFiltro}
                  onReviews={() => setReviewsDe(clinica)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Sidebar desktop */}
        <aside className="hidden h-fit min-w-0 lg:block">
          <FiltrosPainel {...filtrosProps} />
        </aside>
      </div>

      {/* Drawer filtros mobile / notebook estreito */}
      {filtrosMobileAbertos ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Fechar" onClick={() => setFiltrosMobileAbertos(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[22rem] sm:rounded-none sm:rounded-l-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#1f1630]">Filtrar resultados</h2>
              <button type="button" onClick={() => setFiltrosMobileAbertos(false)} className="rounded-full p-2 text-[#7a738c] hover:bg-[#f3eafc]">
                <X className="size-5" />
              </button>
            </div>
            <FiltrosPainel {...filtrosProps} embedded />
            <button
              type="button"
              onClick={() => setFiltrosMobileAbertos(false)}
              className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-[#7828c8] text-sm font-semibold text-white"
            >
              Ver {filtradas.length} clínicas
            </button>
          </div>
        </div>
      ) : null}

      <AvaliacoesModal clinica={reviewsDe} onClose={() => setReviewsDe(null)} />

      <style>{`
        .field-input {
          height: 2.75rem;
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #ebe4f4;
          background: #faf8fc;
          padding: 0 0.75rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: #1f1630;
          outline: none;
        }
        .field-input:focus {
          border-color: rgba(120, 40, 200, 0.4);
          background: #fff;
        }
      `}</style>
    </div>
  );
}

type FiltrosProps = {
  soAbertas: boolean;
  setSoAbertas: (v: boolean) => void;
  horaFiltro: string;
  setHoraFiltro: (v: string | ((atual: string) => string)) => void;
  especialidade: string;
  setEspecialidade: (v: string) => void;
  especialidades: string[];
  maxKm: number;
  setMaxKm: (v: number) => void;
  notaMin: number;
  setNotaMin: (v: number) => void;
  tipos: TipoAtendimento[];
  toggleTipo: (tipo: TipoAtendimento) => void;
  limparFiltros: () => void;
  embedded?: boolean;
};

function FiltrosPainel(props: FiltrosProps) {
  const {
    soAbertas,
    setSoAbertas,
    horaFiltro,
    setHoraFiltro,
    especialidade,
    setEspecialidade,
    especialidades,
    maxKm,
    setMaxKm,
    notaMin,
    setNotaMin,
    tipos,
    toggleTipo,
    limparFiltros,
    embedded,
  } = props;

  return (
    <div className={embedded ? "" : "rounded-3xl border border-[#ebe4f4] bg-white p-5 shadow-sm"}>
      {!embedded ? <h2 className="text-base font-semibold text-[#1f1630]">Filtrar resultados</h2> : null}

      <div className={`${embedded ? "" : "mt-5"} flex items-start justify-between gap-3`}>
        <div>
          <p className="text-sm font-semibold text-[#1f1630]">Horários abertos</p>
          <p className="mt-0.5 text-xs text-[#8b7fa3]">Só clínicas abertas agora</p>
        </div>
        <Toggle checked={soAbertas} onChange={setSoAbertas} />
      </div>

      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold text-[#1f1630]">Horários disponíveis</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
          {HORAS.map((hora) => (
            <button
              key={hora}
              type="button"
              onClick={() => setHoraFiltro((atual) => (atual === hora ? "" : hora))}
              className={`rounded-xl px-1 py-2.5 text-xs font-semibold transition ${
                horaFiltro === hora ? "bg-[#7828c8] text-white" : "bg-[#f3eafc] text-[#5c4d78]"
              }`}
            >
              {hora}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-semibold text-[#1f1630]">Especialidades</p>
        <select
          value={especialidade}
          onChange={(event) => setEspecialidade(event.target.value)}
          className="h-11 w-full rounded-xl border border-[#ebe4f4] bg-[#faf8fc] px-3 text-sm text-[#1f1630] outline-none"
        >
          <option value="">Todas as especialidades</option>
          {especialidades.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#1f1630]">Distância</p>
          <span className="text-xs font-medium text-[#7828c8]">Até {maxKm} km</span>
        </div>
        <p className="mb-2 text-xs text-[#8b7fa3]">Até quantos km?</p>
        <input
          type="range"
          min={0}
          max={250}
          value={maxKm}
          onChange={(event) => setMaxKm(Number(event.target.value))}
          className="w-full accent-[#7828c8]"
        />
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-semibold text-[#1f1630]">Avaliação mínima</p>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 0, label: "Qualquer" },
            { value: 3, label: "3+" },
            { value: 4, label: "4+" },
            { value: 4.5, label: "4.5+" },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setNotaMin(item.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                notaMin === item.value ? "bg-[#7828c8] text-white" : "bg-[#f3eafc] text-[#5c4d78]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-semibold text-[#1f1630]">Tipo de atendimento</p>
        <div className="space-y-2">
          {(["presencial", "telemedicina"] as const).map((tipo) => (
            <label key={tipo} className="flex items-center gap-2 text-sm text-[#1f1630]">
              <input
                type="checkbox"
                checked={tipos.includes(tipo)}
                onChange={() => toggleTipo(tipo)}
                className="size-4 rounded accent-[#7828c8]"
              />
              {tipo === "presencial" ? "Presencial" : "Telemedicina"}
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={limparFiltros}
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#7828c8] hover:underline"
      >
        <RefreshCw className="size-3.5" />
        Limpar filtros
      </button>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
  className = "",
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`min-w-0 ${className}`}>
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[#8b7fa3]">
        {icon} {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-[#7828c8]" : "bg-[#d9d2e6]"}`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${checked ? "left-[1.35rem]" : "left-0.5"}`}
      />
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition sm:px-3.5 ${
        active ? "bg-[#7828c8] text-white" : "border border-[#e4dcf0] bg-white text-[#5c4d78]"
      }`}
    >
      {children}
    </button>
  );
}

function ClinicaCard({
  clinica,
  horaSelecionada,
  onReviews,
}: {
  clinica: AgendaClinic;
  horaSelecionada: string;
  onReviews: () => void;
}) {
  const tags = [...(clinica.especialidades ?? []).slice(0, 2), ...(clinica.servicos ?? []).slice(0, 2)]
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .slice(0, 3);
  const horarios = clinica.horariosHoje ?? [];

  function googleMapsUrl(item: AgendaClinic): string {
    const query = [item.endereco, item.cidade, item.uf, item.nome].filter(Boolean).join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || item.nome)}`;
  }

  return (
    <li className="min-w-0 rounded-2xl border border-[#ebe4f4] bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 gap-3 sm:gap-3.5">
          {mediaUrl(clinica.logoUrl) ? (
            <img src={mediaUrl(clinica.logoUrl)} alt="" className="size-12 shrink-0 rounded-2xl object-cover sm:size-14" />
          ) : (
            <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#f3eafc] text-lg font-bold text-[#7828c8] sm:size-14 sm:text-xl">
              {clinica.nome.slice(0, 1)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h2 className="text-[0.95rem] font-semibold text-[#1f1630] sm:text-base">{clinica.nome}</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-[11px] ${
                  clinica.aberta ? "bg-emerald-50 text-emerald-700" : "bg-[#f1f0f4] text-[#7a738c]"
                }`}
              >
                {clinica.aberta ? "Aberta agora" : "Fechada agora"}
              </span>
              <BadgeCheck className="size-4 text-[#7828c8]" aria-label="Verificada" />
            </div>
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
              <p className="min-w-0 text-sm text-[#7a738c]">
                {formatKm(clinica.distanciaKm)}
                {clinica.cidade ? ` · ${[clinica.cidade, clinica.uf].filter(Boolean).join(" - ")}` : ""}
              </p>
              <a
                href={googleMapsUrl(clinica)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#e4dcf0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#7828c8] transition hover:bg-[#f3eafc]"
              >
                <MapPin className="size-3.5" />
                Google Maps
              </a>
            </div>
            {tags.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-[#f3eafc] px-2.5 py-0.5 text-[11px] font-medium text-[#6b5a8a]">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            {horarios.length ? (
              <div className="mt-3">
                <p className="mb-1.5 text-xs font-medium text-[#8b7fa3]">Horários disponíveis hoje:</p>
                <div className="flex flex-wrap gap-1.5">
                  {horarios.slice(0, 6).map((hora) => (
                    <span
                      key={hora}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                        horaSelecionada === hora ? "bg-[#7828c8] text-white" : "bg-[#f3eafc] text-[#7828c8]"
                      }`}
                    >
                      {hora}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-[#f3eef8] pt-3 sm:border-0 sm:pt-0">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" aria-label="Favoritar" className="shrink-0 text-[#9a90b0] hover:text-[#7828c8]">
              <Bookmark className="size-5" />
            </button>
            <button
              type="button"
              onClick={onReviews}
              className="inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-[#1f1630]"
            >
              <Star className="size-4 shrink-0 fill-[#7828c8] text-[#7828c8]" />
              <span>{clinica.notaMedia != null ? Number(clinica.notaMedia).toFixed(1) : "—"}</span>
              <span className="truncate font-normal text-[#8b7fa3]">({clinica.totalAvaliacoes ?? 0})</span>
            </button>
          </div>
          <Link
            to={`/clinica/${clinica.slug}`}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-xl bg-[#7828c8] px-4 text-sm font-semibold text-white transition hover:bg-[#6a22b4]"
          >
            Ver detalhes →
          </Link>
        </div>
      </div>
    </li>
  );
}

function AvaliacoesModal({ clinica, onClose }: { clinica: AgendaClinic | null; onClose: () => void }) {
  const reviews = useQuery({
    queryKey: ["clinica-avaliacoes", clinica?.id],
    enabled: clinica != null,
    queryFn: () => api.clinicaAvaliacoes(clinica!.id),
  });

  return (
    <Modal open={Boolean(clinica)} title={clinica ? `Avaliações · ${clinica.nome}` : "Avaliações"} onClose={onClose} wide>
      {reviews.isLoading ? <LoadingState label="Carregando avaliações…" /> : null}
      {!reviews.isLoading && !(reviews.data ?? []).length ? (
        <EmptyState title="Ainda sem avaliações" description="Quando tutores concluírem um atendimento ou vacina, as notas aparecem aqui." />
      ) : (
        <ul className="space-y-3">
          {(reviews.data ?? []).map((item) => (
            <li key={item.id} className="rounded-3xl bg-[#f6effc] p-4 ring-1 ring-[#e4d6f5]">
              <div className="mb-2 flex justify-end">
                <Stars value={Number(item.nota)} />
              </div>
              <div className="flex gap-3">
                <Avatar name={item.tutor} src={item.fotoUrl} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1f1630]">{item.tutor}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#6e6680]">
                    {item.comentario?.trim() || "Sem comentário."}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function Stars({ value }: { value: number }) {
  const filled = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5 text-[#7828c8]" aria-label={`${value} de 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} className={`size-4 ${index < filled ? "fill-[#7828c8]" : "text-[#d7cce8]"}`} />
      ))}
    </span>
  );
}
