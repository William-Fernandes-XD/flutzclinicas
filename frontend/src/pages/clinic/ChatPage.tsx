import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Search, SendHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState, LoadingState } from "../../components/ui/EmptyState";
import { Select } from "../../components/ui/Field";
import { http } from "../../lib/http";
import { api, type ChatSummary } from "../../services/api";
import { useToast } from "../../providers/ToastProvider";

type Tutor = { id: number; nome: string; fotoUrl?: string | null };

export function ChatPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const chatParam = searchParams.get("chatId");
  const [atual, setAtual] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  const [novaAberta, setNovaAberta] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const chats = useQuery({ queryKey: ["chats"], queryFn: api.chats, refetchInterval: 8000 });
  const detalhe = useQuery({
    queryKey: ["chat", atual],
    enabled: atual != null,
    queryFn: () => api.chat(atual!),
    refetchInterval: atual != null ? 4000 : false,
  });
  const tutores = useQuery({ queryKey: ["tutores"], queryFn: () => http<Tutor[]>("/api/tutores") });

  useEffect(() => {
    if (!chatParam) return;
    const id = Number(chatParam);
    if (Number.isFinite(id)) setAtual(id);
  }, [chatParam]);

  const enviar = useMutation({
    mutationFn: () => api.sendChat(atual!, texto.trim()),
    onSuccess: async () => {
      setTexto("");
      await queryClient.invalidateQueries({ queryKey: ["chat", atual] });
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  const abrir = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.openChat(body),
    onSuccess: async (chat) => {
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
      setAtual(chat.id);
      setNovaAberta(false);
      toast.push(chat.preview ? "Conversa reaberta." : "Conversa aberta.");
    },
  });

  const encerrar = useMutation({
    mutationFn: () => api.closeChat(atual!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["chats"] });
      await queryClient.invalidateQueries({ queryKey: ["chat", atual] });
      toast.push("Chat encerrado.");
    },
  });

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (chats.data ?? []).filter((item) => !q || item.tutor.toLowerCase().includes(q));
  }, [busca, chats.data]);

  const tutoresSemConversa = useMemo(() => tutores.data ?? [], [tutores.data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detalhe.data?.mensagens.length, atual]);

  if (chats.isLoading) return <LoadingState />;

  const chat = detalhe.data?.chat;
  const mensagens = detalhe.data?.mensagens ?? [];
  const selecionada: ChatSummary | undefined = (chats.data ?? []).find((item) => item.id === atual);

  return (
    <div className="flex h-[calc(100svh-5.5rem)] min-h-[28rem] overflow-hidden rounded-3xl border border-[#ebe4f4] bg-white shadow-sm lg:h-[calc(100svh-6.5rem)]">
      <aside
        className={`flex w-full shrink-0 flex-col border-r border-[#ebe4f4] bg-[#faf8fc] sm:w-[20rem] ${
          atual != null ? "hidden sm:flex" : "flex"
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
          <p className="mt-1 text-xs text-white/80">Abra uma conversa já criada na lista</p>
        </div>

        {novaAberta ? (
          <form
            className="space-y-2 border-b border-[#ebe4f4] bg-white p-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const clienteId = Number(data.get("clienteId"));
              if (!clienteId) return;
              abrir.mutate({ clienteId });
            }}
          >
            <Select name="clienteId" required>
              <option value="">Escolher tutor</option>
              {tutoresSemConversa.map((tutor) => (
                <option key={tutor.id} value={tutor.id}>
                  {tutor.nome}
                </option>
              ))}
            </Select>
            <Button type="submit" className="w-full" busy={abrir.isPending} busyLabel="Abrindo…">
              Abrir conversa existente
            </Button>
            <p className="text-[11px] text-[#8b7fa3]">Se já houver chat com esse tutor, o histórico é mantido.</p>
          </form>
        ) : null}

        <label className="relative m-3">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#9a90b0]" />
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar tutor..."
            className="h-10 w-full rounded-full border border-[#ebe4f4] bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-[#7828c8]/40"
          />
        </label>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!lista.length ? (
            <div className="px-3 py-6">
              <EmptyState title="Nenhuma conversa ainda" description="Use Nova para iniciar com um tutor, ou aguarde um agendamento." />
            </div>
          ) : (
            <ul>
              {lista.map((item) => {
                const ativa = atual === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setAtual(item.id)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                        ativa ? "bg-[#f3eafc]" : "hover:bg-white"
                      }`}
                    >
                      <Avatar name={item.tutor} src={item.fotoUrl} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold text-[#1f1630]">{item.tutor}</span>
                          {item.ultimaAtividade ? (
                            <span className="shrink-0 text-[10px] text-[#9a90b0]">{formatHora(item.ultimaAtividade)}</span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className="truncate text-xs text-[#6e6680]">{item.preview?.trim() || "Sem mensagens"}</span>
                          <Badge tone={item.status === "aberto" ? "brand" : "neutral"}>{item.status}</Badge>
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

      <section className={`min-w-0 flex-1 flex-col ${atual != null ? "flex" : "hidden sm:flex"}`}>
        {atual == null ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-[#f7f2fc] px-6 text-center">
            <span className="inline-flex size-16 items-center justify-center rounded-full bg-white text-[#7828c8] shadow-sm">
              <MessageSquare className="size-7" />
            </span>
            <p className="text-base font-semibold text-[#1f1630]">Selecione uma conversa</p>
            <p className="max-w-sm text-sm text-[#6e6680]">
              A lista à esquerda mostra as conversas já criadas. Clique para abrir o histórico completo.
            </p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-[#ebe4f4] bg-white px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-sm font-medium text-[#7828c8] sm:hidden"
                  onClick={() => setAtual(null)}
                >
                  Voltar
                </button>
                <Avatar name={chat?.tutor ?? selecionada?.tutor ?? "Tutor"} src={chat?.fotoUrl ?? selecionada?.fotoUrl} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#1f1630]">{chat?.tutor ?? selecionada?.tutor}</p>
                  <p className="text-xs text-[#6e6680]">{chat?.pet ?? "Conversa geral"}</p>
                </div>
              </div>
              {chat?.status === "aberto" ? (
                <Button variant="secondary" busy={encerrar.isPending} busyLabel="Encerrando…" onClick={() => encerrar.mutate()}>
                  Encerrar
                </Button>
              ) : (
                <Badge>Encerrado</Badge>
              )}
            </header>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#efe6f8] px-3 py-4 sm:px-5">
              {detalhe.isLoading ? (
                <LoadingState />
              ) : !mensagens.length ? (
                <p className="rounded-2xl bg-white/80 px-4 py-3 text-center text-sm text-[#6e6680]">
                  Nenhuma mensagem ainda nesta conversa.
                </p>
              ) : (
                mensagens.map((mensagem) => {
                  if (mensagem.remetente === "SISTEMA") {
                    return (
                      <div key={mensagem.id} className="flex justify-center">
                        <p className="max-w-[90%] rounded-2xl bg-white/90 px-3 py-2 text-center text-xs text-[#5c4d78] shadow-sm">
                          {mensagem.texto}
                          <span className="mt-1 block text-[10px] text-[#9a90b0]">{formatHora(mensagem.quando)}</span>
                        </p>
                      </div>
                    );
                  }
                  const minha = mensagem.remetente === "COLABORADOR";
                  return (
                    <div key={mensagem.id} className={`flex ${minha ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%] ${
                          minha ? "rounded-br-md bg-[#7828c8] text-white" : "rounded-bl-md bg-white text-[#1f1630]"
                        }`}
                      >
                        {mensagem.remetenteNome ? (
                          <div
                            className={`mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold ${
                              minha ? "text-white/85" : "text-[#7828c8]"
                            }`}
                          >
                            <Avatar name={mensagem.remetenteNome} src={mensagem.remetenteFoto} size="sm" />
                            <span className="min-w-0 truncate">{mensagem.remetenteNome}</span>
                          </div>
                        ) : null}
                        <p className="whitespace-pre-wrap break-words">{mensagem.texto}</p>
                        <p className={`mt-1 text-right text-[10px] ${minha ? "text-white/70" : "text-[#9a90b0]"}`}>
                          {formatHora(mensagem.quando)}
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
                if (!texto.trim() || !atual || enviar.isPending) return;
                enviar.mutate();
              }}
            >
              <textarea
                value={texto}
                onChange={(event) => setTexto(event.target.value)}
                rows={1}
                placeholder="Digite uma mensagem"
                className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-[#ebe4f4] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#7828c8]/40"
              />
              <button
                type="submit"
                disabled={!texto.trim() || !atual || enviar.isPending}
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
