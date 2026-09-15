import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Search, SendHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { EmptyState, LoadingState } from "../../components/ui/EmptyState";
import { Select } from "../../components/ui/Field";
import { api, type TutorConversa } from "../../services/api";

export function ClientChatPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const chatParam = searchParams.get("chatId");
  const [selecionada, setSelecionada] = useState<TutorConversa | null>(null);
  const [busca, setBusca] = useState("");
  const [texto, setTexto] = useState("");
  const [novaAberta, setNovaAberta] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const conversas = useQuery({ queryKey: ["tutor-chats"], queryFn: api.tutorChats, refetchInterval: 8000 });
  const clinicas = useQuery({ queryKey: ["tutor-clinicas"], queryFn: api.tutorClinics });
  const agendaClinicas = useQuery({ queryKey: ["agenda-clinicas"], queryFn: () => api.agendaClinicas() });

  const abrir = useMutation({
    mutationFn: (empresaId: number) => api.abrirTutorChat(empresaId),
    onSuccess: async (item) => {
      await queryClient.invalidateQueries({ queryKey: ["tutor-chats"] });
      setSelecionada(item);
      setNovaAberta(false);
    },
  });

  const chatId = selecionada?.chatId ?? null;
  const detalhe = useQuery({
    queryKey: ["chat", chatId],
    enabled: chatId != null,
    queryFn: () => api.chat(chatId!),
    refetchInterval: chatId != null ? 4000 : false,
  });

  const enviar = useMutation({
    mutationFn: () => api.sendChat(chatId!, texto.trim()),
    onSuccess: async () => {
      setTexto("");
      await queryClient.invalidateQueries({ queryKey: ["chat", chatId] });
      await queryClient.invalidateQueries({ queryKey: ["tutor-chats"] });
    },
  });

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (conversas.data ?? []).filter((item) => !q || item.clinica.toLowerCase().includes(q));
  }, [busca, conversas.data]);

  const clinicasParaNova = useMemo(() => {
    const abertas = new Set((conversas.data ?? []).map((item) => item.empresaId));
    const mapa = new Map<number, { id: number; nome: string; jaAberta: boolean }>();
    for (const item of clinicas.data ?? []) {
      mapa.set(item.id, { id: item.id, nome: item.nome, jaAberta: abertas.has(item.id) });
    }
    for (const item of agendaClinicas.data ?? []) {
      const atual = mapa.get(item.id);
      mapa.set(item.id, {
        id: item.id,
        nome: item.nome,
        jaAberta: atual?.jaAberta ?? abertas.has(item.id),
      });
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [agendaClinicas.data, clinicas.data, conversas.data]);

  useEffect(() => {
    if (!chatParam || !conversas.data?.length) return;
    const id = Number(chatParam);
    if (!Number.isFinite(id)) return;
    const encontrada = conversas.data.find((item) => item.chatId === id);
    if (encontrada) setSelecionada(encontrada);
  }, [chatParam, conversas.data]);

  useEffect(() => {
    if (!selecionada) return;
    const atualizada = (conversas.data ?? []).find((item) => item.empresaId === selecionada.empresaId);
    if (atualizada && (atualizada.chatId !== selecionada.chatId || atualizada.preview !== selecionada.preview)) {
      setSelecionada(atualizada);
    }
  }, [conversas.data, selecionada]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detalhe.data?.mensagens.length, chatId]);

  function selecionar(item: TutorConversa) {
    if (item.chatId == null) {
      abrir.mutate(item.empresaId);
      return;
    }
    setSelecionada(item);
  }

  if (conversas.isLoading) return <LoadingState />;

  const mensagens = detalhe.data?.mensagens ?? [];

  return (
    <div className="flex h-[calc(100svh-5.5rem)] min-h-[28rem] overflow-hidden rounded-3xl border border-[#ebe4f4] bg-white shadow-sm lg:h-[calc(100svh-6.5rem)]">
      <aside
        className={`flex w-full shrink-0 flex-col border-r border-[#ebe4f4] bg-[#faf8fc] sm:w-[20rem] ${
          selecionada ? "hidden sm:flex" : "flex"
        }`}
      >
        <div className="border-b border-[#ebe4f4] bg-[#7828c8] px-4 py-4 text-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-5" />
              <h1 className="text-base font-semibold">Conversas</h1>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="!rounded-full !bg-white !px-3 !py-1.5 !text-xs !text-[#7828c8]"
              onClick={() => setNovaAberta((value) => !value)}
            >
              {novaAberta ? "Fechar" : "Nova"}
            </Button>
          </div>
          <p className="mt-1 text-xs text-white/80">Cada contato com chat já aberto</p>
        </div>

        {novaAberta ? (
          <form
            className="space-y-2 border-b border-[#ebe4f4] bg-white p-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const empresaId = Number(data.get("empresaId"));
              if (!empresaId) return;
              const existente = (conversas.data ?? []).find((item) => item.empresaId === empresaId);
              if (existente?.chatId != null) {
                setSelecionada(existente);
                setNovaAberta(false);
                return;
              }
              abrir.mutate(empresaId);
            }}
          >
            <Select name="empresaId" required disabled={agendaClinicas.isLoading && clinicas.isLoading}>
              <option value="">
                {agendaClinicas.isLoading || clinicas.isLoading ? "Carregando clínicas…" : "Escolher clínica"}
              </option>
              {clinicasParaNova.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                  {item.jaAberta ? " (já na lista)" : ""}
                </option>
              ))}
            </Select>
            <Button type="submit" className="w-full" busy={abrir.isPending} busyLabel="Abrindo…">
              Abrir chat
            </Button>
            {!clinicasParaNova.length && !agendaClinicas.isLoading && !clinicas.isLoading ? (
              <p className="text-[11px] text-[#8b7fa3]">Nenhuma clínica disponível no momento.</p>
            ) : (
              <p className="text-[11px] text-[#8b7fa3]">Escolha a clínica para iniciar ou reabrir a conversa.</p>
            )}
          </form>
        ) : null}

        <label className="relative m-3">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#9a90b0]" />
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar contato..."
            className="h-10 w-full rounded-full border border-[#ebe4f4] bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-[#7828c8]/40"
          />
        </label>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!lista.length ? (
            <div className="px-3 py-6">
              <EmptyState
                title="Nenhum chat aberto"
                description="Use Nova para iniciar com uma clínica, ou agende um horário para abrir automaticamente."
              />
            </div>
          ) : (
            <ul>
              {lista.map((item) => {
                const ativa = selecionada?.empresaId === item.empresaId;
                return (
                  <li key={item.empresaId}>
                    <button
                      type="button"
                      onClick={() => selecionar(item)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                        ativa ? "bg-[#f3eafc]" : "hover:bg-white"
                      }`}
                    >
                      <Avatar name={item.clinica} src={item.logoUrl} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold text-[#1f1630]">{item.clinica}</span>
                          {item.ultimaAtividade ? (
                            <span className="shrink-0 text-[10px] text-[#9a90b0]">{formatHora(item.ultimaAtividade)}</span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[#6e6680]">
                          {item.preview?.trim() || "Conversa aberta"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <section className={`min-w-0 flex-1 flex-col ${selecionada ? "flex" : "hidden sm:flex"}`}>
        {!selecionada ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-[#f7f2fc] px-6 text-center">
            <span className="inline-flex size-16 items-center justify-center rounded-full bg-white text-[#7828c8] shadow-sm">
              <MessageSquare className="size-7" />
            </span>
            <p className="text-base font-semibold text-[#1f1630]">Selecione um contato</p>
            <p className="max-w-sm text-sm text-[#6e6680]">
              A lista mostra cada clínica com chat já aberto. Use Nova para iniciar com outra.
            </p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-[#ebe4f4] bg-white px-4 py-3">
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm font-medium text-[#7828c8] sm:hidden"
                onClick={() => setSelecionada(null)}
              >
                Voltar
              </button>
              <Avatar name={selecionada.clinica} src={selecionada.logoUrl} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#1f1630]">{selecionada.clinica}</p>
                <p className="text-xs text-[#6e6680]">Conversa com a clínica</p>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#efe6f8] px-3 py-4 sm:px-5">
              {detalhe.isLoading ? (
                <LoadingState />
              ) : !mensagens.length ? (
                <p className="rounded-2xl bg-white/80 px-4 py-3 text-center text-sm text-[#6e6680]">
                  Nenhuma mensagem ainda. Envie a primeira para a clínica.
                </p>
              ) : (
                mensagens.map((msg) => {
                  const minha = msg.remetente === "CLIENTE";
                  const sistema = msg.remetente === "SISTEMA";
                  if (sistema) {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <p className="max-w-[90%] rounded-2xl bg-white/90 px-3 py-2 text-center text-xs text-[#5c4d78] shadow-sm">
                          {msg.texto}
                          <span className="mt-1 block text-[10px] text-[#9a90b0]">{formatHora(msg.quando)}</span>
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div key={msg.id} className={`flex ${minha ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%] ${
                          minha
                            ? "rounded-br-md bg-[#7828c8] text-white"
                            : "rounded-bl-md bg-white text-[#1f1630]"
                        }`}
                      >
                        {msg.remetenteNome ? (
                          <p className={`mb-0.5 text-[11px] font-semibold ${minha ? "text-white/85" : "text-[#7828c8]"}`}>
                            {msg.remetenteNome}
                          </p>
                        ) : null}
                        <p className="whitespace-pre-wrap break-words">{msg.texto}</p>
                        <p className={`mt-1 text-right text-[10px] ${minha ? "text-white/70" : "text-[#9a90b0]"}`}>
                          {formatHora(msg.quando)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <form
              className="flex items-end gap-2 border-t border-[#ebe4f4] bg-[#faf8fc] px-3 py-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!texto.trim() || !chatId || enviar.isPending) return;
                enviar.mutate();
              }}
            >
              <textarea
                value={texto}
                onChange={(event) => setTexto(event.target.value)}
                rows={1}
                disabled={chatId == null}
                placeholder="Digite uma mensagem"
                className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-[#ebe4f4] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#7828c8]/40 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!texto.trim() || chatId == null || enviar.isPending}
                className="inline-flex size-11 items-center justify-center rounded-full bg-[#7828c8] text-white disabled:opacity-50"
                aria-label="Enviar"
              >
                <SendHorizontal className="size-5" />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}

function formatHora(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hoje = new Date();
  const mesmaData =
    date.getDate() === hoje.getDate() &&
    date.getMonth() === hoje.getMonth() &&
    date.getFullYear() === hoje.getFullYear();
  if (mesmaData) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
