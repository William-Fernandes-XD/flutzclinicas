import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Clock3,
  LifeBuoy,
  MessageSquare,
  Search,
  Shield,
  Syringe,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { env } from "../../lib/env";
import { http } from "../../lib/http";
import { mediaUrl } from "../../lib/media";
import { useToast } from "../../providers/ToastProvider";
import { api, type AppNotification } from "../../services/api";
import { Modal } from "../ui/Modal";

const NOTIF_SOUND_SRC = "/notification_sound.mp3";
const NOTIF_POLL_MS = 2_500;

type Tutor = { id: number; nome: string };
type Pet = { id: number; nome: string; especie: string; tutor: string };
type Atendimento = { id: number; pet: string; status: string };
type FiltroNotif = "todas" | "agendamentos" | "mensagens" | "avisos";

function categoria(tipo: string): FiltroNotif {
  if (tipo === "CHAT_MENSAGEM") return "mensagens";
  if (
    tipo === "TICKET_SUPORTE" ||
    tipo === "TICKET_RESPOSTA" ||
    tipo === "ASSINATURA_D3" ||
    tipo === "LGPD_SOLICITACAO" ||
    tipo === "LGPD_ATUALIZACAO"
  ) {
    return "avisos";
  }
  if (tipo.startsWith("VACINA_") || tipo.startsWith("ASSINATURA_") || tipo.startsWith("LGPD_")) return "avisos";
  if (tipo.startsWith("AGENDA_") || tipo.startsWith("ATENDIMENTO_")) return "agendamentos";
  return "avisos";
}

export function HeaderTools({ variant }: { variant: "platform" | "clinic" | "client" }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [filtro, setFiltro] = useState<FiltroNotif>("todas");
  const [q, setQ] = useState("");
  const enabled = variant === "clinic" && searchOpen;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevNaoLidasRef = useRef<number | null>(null);
  const lastSoundAtRef = useRef(0);

  const tutores = useQuery({ queryKey: ["tutores"], queryFn: () => http<Tutor[]>("/api/tutores"), enabled });
  const pets = useQuery({ queryKey: ["pets"], queryFn: () => http<Pet[]>("/api/pets"), enabled });
  const atendimentos = useQuery({
    queryKey: ["atendimentos"],
    queryFn: () => http<Atendimento[]>("/api/atendimentos"),
    enabled,
  });

  const notesEnabled = variant === "clinic" || variant === "client" || variant === "platform";
  const notificacoes = useQuery({
    queryKey: ["notificacoes"],
    queryFn: api.notificacoes,
    enabled: notesEnabled,
    refetchInterval: notesEnabled ? NOTIF_POLL_MS : false,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });
  const naoLidas = useQuery({
    queryKey: ["notificacoes-nao-lidas"],
    queryFn: api.notificacoesNaoLidas,
    enabled: notesEnabled,
    refetchInterval: notesEnabled ? NOTIF_POLL_MS : false,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  function playNotifSound() {
    const now = Date.now();
    if (now - lastSoundAtRef.current < 1200) return;
    const som = audioRef.current;
    if (!som) return;
    lastSoundAtRef.current = now;
    try {
      som.currentTime = 0;
      void som.play().catch(() => undefined);
    } catch {
      /* ignore autoplay blocks */
    }
  }

  useEffect(() => {
    if (!notesEnabled) return;
    const som = new Audio(NOTIF_SOUND_SRC);
    som.preload = "auto";
    som.volume = 1;
    audioRef.current = som;

    function unlockAudio() {
      void som
        .play()
        .then(() => {
          som.pause();
          som.currentTime = 0;
        })
        .catch(() => undefined);
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    }
    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);

    const url = `${env.apiUrl}/api/notificacoes/stream`;
    let source: EventSource | null = null;
    let closed = false;
    let retryTimer: number | undefined;
    let backoffMs = 4_000;

    function connect() {
      if (closed) return;
      // Aba em segundo plano: não reconectar em loop (evita tempestade noturna no backend).
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        retryTimer = window.setTimeout(connect, 30_000);
        return;
      }
      try {
        source = new EventSource(url, { withCredentials: true });
      } catch {
        retryTimer = window.setTimeout(connect, backoffMs);
        backoffMs = Math.min(backoffMs * 2, 60_000);
        return;
      }
      source.addEventListener("notificacoes", (event) => {
        backoffMs = 4_000;
        void queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
        void queryClient.invalidateQueries({ queryKey: ["notificacoes-nao-lidas"] });
        try {
          const data = JSON.parse(String((event as MessageEvent).data ?? "{}")) as { naoLidas?: number };
          const total = typeof data.naoLidas === "number" ? data.naoLidas : null;
          const prev = prevNaoLidasRef.current;
          if (total != null && prev != null && total > prev) {
            playNotifSound();
          }
        } catch {
          /* ignore malformed SSE payload */
        }
      });
      source.onerror = () => {
        source?.close();
        source = null;
        if (!closed) {
          retryTimer = window.setTimeout(connect, backoffMs);
          backoffMs = Math.min(backoffMs * 2, 60_000);
        }
      };
    }

    function onVisibility() {
      if (document.visibilityState === "visible" && !source && !closed) {
        if (retryTimer) window.clearTimeout(retryTimer);
        backoffMs = 4_000;
        connect();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    connect();
    return () => {
      closed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      source?.close();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      som.pause();
      audioRef.current = null;
    };
  }, [notesEnabled, queryClient]);

  // Polling: atualiza badge e toca o som quando a contagem sobe
  const naoLidasTotal = naoLidas.data?.total ?? 0;
  const seenIdsRef = useRef<Set<number>>(new Set());
  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (!notesEnabled || naoLidas.isLoading || naoLidas.data == null) return;
    const prev = prevNaoLidasRef.current;
    if (prev == null) {
      prevNaoLidasRef.current = naoLidasTotal;
      return;
    }
    if (naoLidasTotal > prev) {
      playNotifSound();
    }
    prevNaoLidasRef.current = naoLidasTotal;
  }, [naoLidasTotal, naoLidas.isLoading, naoLidas.data, notesEnabled]);

  useEffect(() => {
    if (!notesEnabled || notificacoes.isLoading || !notificacoes.data) return;
    const listaAtual = notificacoes.data;
    if (!bootstrappedRef.current) {
      seenIdsRef.current = new Set(listaAtual.map((item) => item.id));
      bootstrappedRef.current = true;
      return;
    }
    const novas = listaAtual.filter((item) => !seenIdsRef.current.has(item.id) && !item.lida);
    for (const item of novas.slice(0, 3).reverse()) {
      toast.push(item.titulo || "Nova notificação", {
        detail: item.corpo,
        fotoUrl: item.fotoUrl,
        atorNome: item.atorNome,
      });
    }
    for (const item of listaAtual) {
      seenIdsRef.current.add(item.id);
    }
  }, [notificacoes.data, notificacoes.isLoading, notesEnabled, toast]);

  const marcar = useMutation({
    mutationFn: (id: number) => api.marcarNotificacaoLida(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
      await queryClient.invalidateQueries({ queryKey: ["notificacoes-nao-lidas"] });
    },
  });

  const marcarTodas = useMutation({
    mutationFn: () => api.marcarNotificacoesLidas(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
      await queryClient.invalidateQueries({ queryKey: ["notificacoes-nao-lidas"] });
    },
  });

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const people = (tutores.data ?? [])
      .filter((item) => item.nome.toLowerCase().includes(term))
      .map((item) => ({ to: "/app/clientes", label: item.nome, kind: "Cliente" }));
    const animals = (pets.data ?? [])
      .filter((item) => item.nome.toLowerCase().includes(term) || item.tutor.toLowerCase().includes(term))
      .map((item) => ({ to: `/app/pets/${item.id}`, label: item.nome, kind: "Pet" }));
    const visits = (atendimentos.data ?? [])
      .filter((item) => item.pet.toLowerCase().includes(term))
      .map((item) => ({ to: "/app/atendimentos", label: `${item.pet} · ${item.status}`, kind: "Atendimento" }));
    return [...animals, ...people, ...visits].slice(0, 12);
  }, [atendimentos.data, pets.data, q, tutores.data]);

  const totalNaoLidas = naoLidas.data?.total ?? 0;
  const lista = notificacoes.data ?? [];
  const contagens = useMemo(() => {
    const base = { todas: 0, agendamentos: 0, mensagens: 0, avisos: 0 };
    for (const item of lista) {
      if (item.lida) continue;
      base.todas += 1;
      base[categoria(item.tipo)] += 1;
    }
    return base;
  }, [lista]);

  const filtradas = useMemo(() => {
    if (filtro === "todas") return lista;
    return lista.filter((item) => categoria(item.tipo) === filtro);
  }, [filtro, lista]);

  async function abrirNotificacao(item: AppNotification) {
    if (!item.lida) {
      try {
        await marcar.mutateAsync(item.id);
      } catch {
        // segue mesmo se a leitura falhar
      }
    }
    setNotesOpen(false);
    if (item.linkPath) navigate(item.linkPath);
  }

  const subtitulo =
    variant === "platform"
      ? "Pedidos de suporte e avisos da plataforma"
      : variant === "client"
        ? "Acompanhe novidades das suas clínicas"
        : "Acompanhe as novidades da sua clínica";

  return (
    <>
      {variant === "clinic" ? (
        <button
          type="button"
          className="hidden size-10 items-center justify-center rounded-xl text-muted hover:bg-brand-soft md:inline-flex"
          aria-label="Pesquisar cliente, pet ou atendimento"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="size-4" />
        </button>
      ) : null}
      <button
        type="button"
        className="relative inline-flex size-10 items-center justify-center rounded-xl text-muted hover:bg-brand-soft"
        aria-label="Notificações"
        onClick={() => setNotesOpen(true)}
      >
        <Bell className="size-4" />
        {totalNaoLidas > 0 ? (
          <span className="absolute top-1.5 right-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[#7828c8] px-1 text-[10px] font-semibold text-white">
            {totalNaoLidas > 99 ? "99+" : totalNaoLidas}
          </span>
        ) : null}
      </button>

      <Modal open={searchOpen} title="Pesquisar" onClose={() => setSearchOpen(false)}>
        <input
          autoFocus
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Cliente, pet ou atendimento"
          className="w-full rounded-xl border border-line px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <ul className="mt-4 divide-y divide-line dark:divide-zinc-800">
          {q.trim() && results.length === 0 ? (
            <li className="py-6 text-sm text-muted">Nada encontrado nesta clínica.</li>
          ) : (
            results.map((item) => (
              <li key={`${item.kind}-${item.to}-${item.label}`}>
                <Link
                  to={item.to}
                  onClick={() => setSearchOpen(false)}
                  className="flex items-center justify-between gap-3 py-3 text-sm hover:text-brand"
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-muted">{item.kind}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </Modal>

      <NotificationsPanel
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        subtitulo={subtitulo}
        filtro={filtro}
        onFiltro={setFiltro}
        contagens={contagens}
        totalNaoLidas={totalNaoLidas}
        loading={notificacoes.isLoading}
        items={filtradas}
        onAbrir={(item) => void abrirNotificacao(item)}
        onMarcarTodas={() => marcarTodas.mutate()}
        marcandoTodas={marcarTodas.isPending}
        enabled={notesEnabled}
      />
    </>
  );
}

function NotificationsPanel({
  open,
  onClose,
  subtitulo,
  filtro,
  onFiltro,
  contagens,
  totalNaoLidas,
  loading,
  items,
  onAbrir,
  onMarcarTodas,
  marcandoTodas,
  enabled,
}: {
  open: boolean;
  onClose: () => void;
  subtitulo: string;
  filtro: FiltroNotif;
  onFiltro: (value: FiltroNotif) => void;
  contagens: Record<FiltroNotif, number>;
  totalNaoLidas: number;
  loading: boolean;
  items: AppNotification[];
  onAbrir: (item: AppNotification) => void;
  onMarcarTodas: () => void;
  marcandoTodas: boolean;
  enabled: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const filtros: { id: FiltroNotif; label: string; icon: ReactNode }[] = [
    { id: "todas", label: "Todas", icon: <Bell className="size-3.5" /> },
    { id: "agendamentos", label: "Agendamentos", icon: <CalendarDays className="size-3.5" /> },
    { id: "mensagens", label: "Mensagens", icon: <MessageSquare className="size-3.5" /> },
    { id: "avisos", label: "Avisos", icon: <Bell className="size-3.5" /> },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notif-title"
        className="relative flex max-h-[min(92svh,40rem)] w-full max-w-lg min-w-0 flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-2xl dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#ebe4f4] px-5 pt-5 pb-4 dark:border-zinc-800">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#f3eafc] text-[#7828c8]">
              <Bell className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 id="notif-title" className="text-lg font-bold text-[#2d2145] dark:text-zinc-100">
                Notificações
              </h2>
              <p className="mt-0.5 text-sm text-[#8b7fa3]">{subtitulo}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-[#8b7fa3] hover:bg-[#f3eafc] hover:text-[#7828c8]"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="flex flex-wrap gap-2">
            {filtros.map((item) => {
              const ativo = filtro === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onFiltro(item.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    ativo
                      ? "bg-[#7828c8] text-white shadow-sm"
                      : "bg-[#f4f0f8] text-[#5c4d78] hover:bg-[#ebe4f4] dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {item.icon}
                  {item.label}
                  <span
                    className={`ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] ${
                      ativo ? "bg-white/20 text-white" : "bg-white text-[#7828c8] dark:bg-zinc-700"
                    }`}
                  >
                    {contagens[item.id]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 mb-3 flex items-center justify-between gap-2">
            <p className="text-sm text-[#5c4d78] dark:text-zinc-400">
              {totalNaoLidas > 0
                ? `${totalNaoLidas} ${totalNaoLidas === 1 ? "notificação" : "notificações"} não lida${totalNaoLidas === 1 ? "" : "s"}`
                : "Nenhuma notificação não lida"}
            </p>
            {totalNaoLidas > 0 ? (
              <button
                type="button"
                disabled={marcandoTodas}
                onClick={onMarcarTodas}
                className="inline-flex items-center gap-1 text-sm font-medium text-[#7828c8] hover:underline disabled:opacity-60"
              >
                <CheckCheck className="size-3.5" />
                Marcar todas como lidas
              </button>
            ) : null}
          </div>

          {!enabled ? (
            <p className="py-8 text-center text-sm text-[#8b7fa3]">Notificações indisponíveis nesta área.</p>
          ) : loading ? (
            <p className="py-8 text-center text-sm text-[#8b7fa3]">Carregando…</p>
          ) : !items.length ? (
            <p className="py-8 text-center text-sm text-[#8b7fa3]">Nenhuma notificação neste filtro.</p>
          ) : (
            <ul className="space-y-2.5 pb-1">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onAbrir(item)}
                    className={`flex w-full items-start gap-2.5 rounded-2xl px-3 py-3 text-left transition hover:bg-[#f3eafc]/70 ${
                      item.lida ? "bg-white dark:bg-zinc-900" : "bg-[#f7f2fb] dark:bg-zinc-800/80"
                    }`}
                  >
                    <TipoIcone tipo={item.tipo} />
                    <NotifAvatar nome={item.atorNome || item.titulo} src={item.fotoUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#7828c8]">{item.titulo}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-[#6e6680] dark:text-zinc-400">{item.corpo}</p>
                      <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#9a90b0]">
                        <Clock3 className="size-3" />
                        {formatQuando(item.quando)}
                      </p>
                    </div>
                    <span className="mt-1 flex shrink-0 flex-col items-center gap-2">
                      {!item.lida ? <span className="size-2 rounded-full bg-[#7828c8]" /> : <span className="size-2" />}
                      <ChevronRight className="size-4 text-[#c4bdd4]" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TipoIcone({ tipo }: { tipo: string }) {
  const cat = categoria(tipo);
  const Icon =
    tipo === "TICKET_SUPORTE" || tipo === "TICKET_RESPOSTA"
      ? LifeBuoy
      : tipo.startsWith("LGPD_")
        ? Shield
        : cat === "mensagens"
          ? MessageSquare
          : cat === "agendamentos"
            ? CalendarDays
            : cat === "avisos" && tipo.startsWith("VACINA_")
              ? Syringe
              : Bell;
  const cores =
    tipo === "TICKET_SUPORTE" || tipo === "TICKET_RESPOSTA"
      ? "bg-[#efe8ff] text-[#7828c8]"
      : tipo.startsWith("LGPD_")
        ? "bg-[#efe8ff] text-[#7828c8]"
        : cat === "mensagens"
          ? "bg-[#e8f6ee] text-[#1f8a4c]"
          : cat === "agendamentos"
            ? "bg-[#efe8ff] text-[#7828c8]"
            : "bg-[#fff3e0] text-[#c27803]";
  return (
    <span className={`mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl ${cores}`}>
      <Icon className="size-4" />
    </span>
  );
}

function NotifAvatar({ nome, src }: { nome: string; src?: string | null }) {
  const shown = mediaUrl(src);
  if (shown) {
    return <img src={shown} alt="" className="mt-0.5 size-9 shrink-0 rounded-full object-cover ring-2 ring-white" />;
  }
  return (
    <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-[#7828c8] ring-2 ring-[#ebe4f4] dark:bg-zinc-800 dark:ring-zinc-700">
      {(nome.trim()[0] || "?").toUpperCase()}
    </span>
  );
}

function formatQuando(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
