import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, LifeBuoy, LoaderCircle, LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { http, HttpError } from "../../lib/http";
import { mediaUrl } from "../../lib/media";
import type { Perfil } from "../../lib/perfil";
import { isPlatformAdmin, isTutor } from "../../lib/session";
import { useAuth } from "../../providers/AuthProvider";
import { useToast } from "../../providers/ToastProvider";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/EmptyState";
import { Field, Input, Textarea } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { Switch } from "../ui/Switch";

type Dialog = "dados" | "notificacoes" | "suporte" | null;
type TicketPhase = "idle" | "sending" | "ok";

export function AccountMenu() {
  const { session, logout, loggingOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const wrap = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [ticketPhase, setTicketPhase] = useState<TicketPhase>("idle");
  const [error, setError] = useState("");
  const perfil = useQuery({ queryKey: ["perfil"], queryFn: () => http<Perfil>("/api/perfil") });
  const data = perfil.data;
  const notificationsOn = Boolean(data?.permitirNotificacoes);
  const canEdit = data?.tipo === "tutor" || data?.tipo === "colaborador";
  const canNotify = data?.permitirNotificacoes != null;
  const canSupport = Boolean(session && !isPlatformAdmin(session));

  const salvar = useMutation({
    mutationFn: (body: Record<string, unknown>) => http<Perfil>("/api/perfil", { method: "PUT", json: body }),
    onSuccess: (next) => {
      queryClient.setQueryData(["perfil"], next);
    },
  });

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (wrap.current && !wrap.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (ticketPhase !== "ok") return;
    const timer = window.setTimeout(() => setTicketPhase("idle"), 4200);
    return () => window.clearTimeout(timer);
  }, [ticketPhase]);

  function closeMenu() {
    setOpen(false);
  }

  function openDialog(next: Dialog) {
    setError("");
    setDialog(next);
    closeMenu();
  }

  async function onLogout() {
    closeMenu();
    await logout();
    navigate("/", { replace: true });
  }

  async function onSaveDados(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      await salvar.mutateAsync({
        nome: form.get("nome"),
        email: form.get("email"),
        telefone: form.get("telefone"),
        senha: form.get("senha") || null,
      });
      const foto = form.get("foto");
      if (foto instanceof File && foto.size > 0) {
        const body = new FormData();
        body.append("alvo", isTutor(session) ? "tutor" : "colaborador");
        body.append("arquivo", foto);
        await http("/api/perfil/foto", { method: "POST", body });
        await queryClient.invalidateQueries({ queryKey: ["perfil"] });
      }
      toast.push("Dados atualizados.");
      setDialog(null);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Não foi possível atualizar os dados.");
    }
  }

  async function onConfirmNotifications() {
    if (!data) return;
    setError("");
    try {
      await salvar.mutateAsync({ permitirNotificacoes: !notificationsOn });
      toast.push(notificationsOn ? "Notificações desativadas." : "Notificações ativadas.");
      setDialog(null);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Não foi possível atualizar as notificações.");
    }
  }

  async function onSendTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setDialog(null);
    setTicketPhase("sending");
    try {
      await http("/api/suporte", {
        method: "POST",
        json: { motivo: form.get("motivo"), mensagem: form.get("mensagem") },
      });
      setTicketPhase("ok");
    } catch (err) {
      setTicketPhase("idle");
      setDialog("suporte");
      setError(err instanceof HttpError ? err.message : "Não foi possível enviar o ticket.");
    }
  }

  if (!session) return null;

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        className="inline-flex max-w-[min(100%,22rem)] items-center gap-2 rounded-xl px-2 py-1 hover:bg-brand-soft dark:hover:bg-zinc-800"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Conta"
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={data?.nome ?? session.nome} src={data?.fotoUrl} size="sm" />
        <span className="hidden max-w-[16rem] truncate text-sm font-semibold sm:inline">{data?.nome ?? session.nome}</span>
        <ChevronDown className={`hidden size-4 text-muted sm:block ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-line bg-white py-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="truncate px-4 pb-2 text-xs text-muted">{session.identificador}</p>
          {canEdit ? (
            <MenuButton icon={<UserRound className="size-4" />} onClick={() => openDialog("dados")}>
              Alterar Dados
            </MenuButton>
          ) : null}
          {canNotify ? (
            <div className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Desativar notificações</p>
                <p className="text-xs text-muted">{notificationsOn ? "Avisos ligados" : "Avisos desligados"}</p>
              </div>
              <Switch
                checked={notificationsOn}
                label={notificationsOn ? "Desativar notificações" : "Ativar notificações"}
                onChange={() => openDialog("notificacoes")}
              />
            </div>
          ) : null}
          {canSupport ? (
            <MenuButton
              icon={<LifeBuoy className="size-4" />}
              onClick={() => {
                setOpen(false);
                if (data?.tipo === "colaborador") {
                  navigate("/app/suporte");
                  return;
                }
                if (data?.tipo === "tutor" || isTutor(session)) {
                  navigate("/cliente/suporte");
                  return;
                }
                openDialog("suporte");
              }}
            >
              Suporte
            </MenuButton>
          ) : null}
          <MenuButton icon={<LogOut className="size-4" />} danger onClick={() => void onLogout()} disabled={loggingOut}>
            {loggingOut ? "Saindo…" : "Sair"}
          </MenuButton>
        </div>
      ) : null}

        <Modal open={dialog === "dados"} title="Alterar Dados" onClose={() => setDialog(null)}>
        {!data ? (
          <p className="text-sm text-muted">Carregando seus dados…</p>
        ) : (
          <form onSubmit={onSaveDados} className="grid gap-3">
            {mediaUrl(data.fotoUrl) ? (
              <img src={mediaUrl(data.fotoUrl)} alt="" className="size-20 rounded-2xl object-cover" />
            ) : null}
            <Field label="Foto">
              <Input name="foto" type="file" accept="image/png,image/jpeg,image/webp" />
            </Field>
            <Field label="Nome">
              <Input name="nome" defaultValue={data.nome} required />
            </Field>
            <Field label="E-mail">
              <Input
                name="email"
                type="email"
                defaultValue={data.email ?? ""}
                disabled={!isTutor(session)}
              />
            </Field>
            <Field label="Telefone">
              <Input name="telefone" defaultValue={data.telefone ?? ""} />
            </Field>
            <Field label="Nova senha" hint="Deixe em branco para manter a atual.">
              <Input name="senha" type="password" autoComplete="new-password" />
            </Field>
            {error ? <ErrorState message={error} /> : null}
            <Button type="submit" busy={salvar.isPending} busyLabel="Salvando…">
              Salvar
            </Button>
          </form>
        )}
      </Modal>

      <Modal
        open={dialog === "notificacoes"}
        title={notificationsOn ? "Desativar notificações" : "Ativar notificações"}
        onClose={() => setDialog(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button busy={salvar.isPending} busyLabel="Salvando…" onClick={() => void onConfirmNotifications()}>
              Confirmar
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {notificationsOn
            ? "Você deixará de receber avisos desta conta. Pode ligar de novo quando quiser."
            : "Os avisos desta conta voltam a ser enviados."}
        </p>
        {error ? <div className="mt-3"><ErrorState message={error} /></div> : null}
      </Modal>

      <Modal open={dialog === "suporte"} title="Suporte" onClose={() => setDialog(null)}>
        <form onSubmit={onSendTicket} className="grid gap-3">
          <p className="text-sm text-muted">
            Fale com a administração do Flutz. A resposta chega no e-mail da sua conta.
          </p>
          <Field label="Motivo">
            <Input name="motivo" required maxLength={180} placeholder="Motivo do Ticket..." />
          </Field>
          <Field label="Mensagem">
            <Textarea name="mensagem" required maxLength={4000} placeholder="Como podemos te ajudar?" />
          </Field>
          {error ? <ErrorState message={error} /> : null}
          <Button type="submit">Enviar ticket</Button>
        </form>
      </Modal>

      {ticketPhase !== "idle" ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-ink/40" />
          <div
            role="dialog"
            aria-live="polite"
            aria-modal="true"
            className="relative w-full max-w-sm rounded-3xl bg-white px-6 py-10 text-center shadow-2xl dark:bg-zinc-900"
          >
            {ticketPhase === "sending" ? (
              <>
                <LoaderCircle className="mx-auto size-10 animate-spin text-brand" />
                <p className="mt-4 text-sm font-medium text-muted">Enviando seu ticket…</p>
              </>
            ) : (
              <>
                <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
                <p className="mt-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  Seu ticket foi enviado, em breve entraremos em contato via email!
                </p>
                <Button className="mt-6" variant="secondary" onClick={() => setTicketPhase("idle")}>
                  Fechar
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuButton({
  children,
  icon,
  onClick,
  danger,
  disabled,
}: {
  children: string;
  icon: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium",
        danger ? "text-danger hover:bg-red-50 dark:hover:bg-red-950/30" : "hover:bg-brand-soft dark:hover:bg-zinc-800",
        disabled ? "opacity-50" : "",
      ].join(" ")}
    >
      <span className="opacity-80">{icon}</span>
      {children}
    </button>
  );
}
