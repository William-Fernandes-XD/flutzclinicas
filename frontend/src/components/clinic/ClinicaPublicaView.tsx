import {
  CalendarDays,
  Camera,
  Heart,
  Mail,
  MapPin,
  MessageCircle,
  PawPrint,
  Phone,
  Share2,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { env } from "../../lib/env";
import { mediaUrl } from "../../lib/media";
import { petArt } from "../../lib/pets-art";
import { ServiceTypeIcon } from "../../lib/service-icons";
import type { PageItem, PublicClinic, PublicMembro } from "../../services/api";
import { AgendarNaClinica } from "../agenda/AgendarNaClinica";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";

const PASTELS = [
  "bg-violet-100 text-brand",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700",
  "bg-emerald-100 text-emerald-700",
];

const DEFAULT_TOPICOS = [
  { id: "t1", titulo: "Atendimento especializado", texto: null, Icon: Stethoscope },
  { id: "t2", titulo: "Ambiente seguro e acolhedor", texto: null, Icon: Heart },
  { id: "t3", titulo: "Tecnologia e estrutura moderna", texto: null, Icon: ShieldCheck },
];

function visivel(tipo: string, data: PublicClinic): boolean {
  const secao = data.secoes.find((item) => item.tipo === tipo);
  return secao ? secao.visivel : true;
}

function money(value: number | null): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function enderecoTexto(data: PublicClinic): string {
  const e = data.endereco;
  if (!e) return "";
  return [e.logradouro, e.numero, e.complemento, e.bairro, [e.cidade, e.uf].filter(Boolean).join(" - "), e.cep]
    .filter(Boolean)
    .join(", ");
}

function cidadeUf(data: PublicClinic): string {
  return [data.endereco?.cidade, data.endereco?.uf].filter(Boolean).join(" - ") || "Local a confirmar";
}

function scrollPreviewTo(event: MouseEvent<HTMLAnchorElement>, id: string, preview: boolean) {
  if (!preview) return;
  event.preventDefault();
  const el = document.getElementById(id);
  const scroller = el?.closest("[data-page-preview]");
  if (!el || !(scroller instanceof HTMLElement)) return;
  const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  scroller.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
}

function Headline({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  if (words.length < 4) return <>{text}</>;
  const highlightCount = Math.min(5, Math.max(3, Math.round(words.length * 0.35)));
  return (
    <>
      {words.slice(0, -highlightCount).join(" ")} <span className="text-brand">{words.slice(-highlightCount).join(" ")}</span>
    </>
  );
}

function servicoTexto(item: PageItem): string {
  if (item.texto?.trim()) return item.texto;
  const value = item.nome.toLowerCase();
  if (value.includes("consulta")) return "Avaliação clínica completa do seu pet.";
  if (value.includes("vacin")) return "Protocolo vacinal em dia, com segurança.";
  if (value.includes("exame")) return "Exames para um diagnóstico preciso.";
  if (value.includes("emerg")) return "Pronto atendimento quando seu pet precisa.";
  if (value.includes("proced") || value.includes("cirurg")) return "Procedimentos com estrutura adequada.";
  return "Cuidado veterinário com acompanhamento da equipe.";
}

function asMembros(equipe: PublicClinic["equipe"]): PublicMembro[] {
  return (equipe ?? []).map((item) =>
    typeof item === "string" ? { nome: item, cargo: null, fotoUrl: null } : item,
  );
}

function PageSection({
  tipo,
  publicId,
  preview,
  hidden,
  highlight,
  className,
  children,
}: {
  tipo: string;
  publicId?: string;
  preview?: boolean;
  hidden?: boolean;
  highlight?: string | null;
  className: string;
  children: ReactNode;
}) {
  return (
    <section
      id={publicId ?? `preview-${tipo}`}
      data-section={tipo}
      className={`${className} ${preview && hidden ? "relative opacity-60" : ""} ${
        preview && highlight === tipo ? "ring-2 ring-inset ring-brand" : ""
      }`}
    >
      {preview && hidden ? (
        <p className="pointer-events-none absolute right-4 top-3 z-10 rounded-full bg-ink px-2.5 py-1 text-[10px] font-semibold tracking-wide text-white uppercase">
          Oculta
        </p>
      ) : null}
      {children}
    </section>
  );
}

export function ClinicaPublicaView({
  data,
  preview = false,
  highlight = null,
}: {
  data: PublicClinic;
  preview?: boolean;
  highlight?: string | null;
}) {
  const clinica = data.clinica ?? { nome: "Clínica", slug: "", logoUrl: null, sobre: null, email: null, telefone: null };
  const hero = data.hero ? { ...data.hero, topicos: data.hero.topicos ?? [] } : null;
  const ordem = [...(data.secoes ?? [])]
    .filter((item) => preview || item.visivel)
    .sort((a, b) => a.ordem - b.ordem);
  const equipe = asMembros(data.equipe);
  const heroFoto = mediaUrl(hero?.imagemFundoUrl) || petArt.dog;
  const titulo = hero?.titulo?.trim() || "Cuidando do seu pet com todo o carinho que ele merece";
  const subtitulo =
    hero?.subtitulo?.trim() ||
    "Uma equipe especializada pronta para cuidar da saúde e do bem-estar do seu companheiro, com estrutura moderna e atendimento humanizado.";
  const topicos = hero?.topicos?.filter((item) => item.titulo.trim()).length
    ? hero.topicos.filter((item) => item.titulo.trim())
    : DEFAULT_TOPICOS;
  const loginNext = `/login?next=${encodeURIComponent(`/clinica/${clinica.slug}#agendar`)}`;

  return (
    <div className={`min-w-0 bg-white text-ink ${preview ? "" : "min-h-svh"}`}>
      <header className="sticky top-0 z-30 border-b border-violet-100/80 bg-white/95 backdrop-blur [[data-public-panel]_&]:top-14 lg:[[data-public-panel]_&]:top-0">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:h-[4.25rem] sm:px-6">
          <a
            href="#inicio"
            className="flex min-w-0 items-center gap-3"
            onClick={(event) => scrollPreviewTo(event, "inicio", preview)}
          >
            {mediaUrl(clinica.logoUrl) ? (
              <img src={mediaUrl(clinica.logoUrl)} alt="" className="size-11 shrink-0 rounded-xl object-cover sm:size-12" />
            ) : (
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-lg font-bold text-brand sm:size-12">
                {clinica.nome.slice(0, 1)}
              </span>
            )}
            <span className="truncate font-semibold">{clinica.nome}</span>
          </a>
          <nav className="ml-auto hidden items-center gap-6 text-sm font-medium text-muted lg:flex">
            {visivel("SERVICOS", data) ? (
              <a href="#servicos" onClick={(event) => scrollPreviewTo(event, "servicos", preview)}>
                Serviços
              </a>
            ) : null}
            {visivel("EQUIPE", data) ? (
              <a href="#equipe" onClick={(event) => scrollPreviewTo(event, "equipe", preview)}>
                Equipe
              </a>
            ) : null}
            {visivel("AVALIACOES", data) ? (
              <a href="#avaliacoes" onClick={(event) => scrollPreviewTo(event, "avaliacoes", preview)}>
                Avaliações
              </a>
            ) : null}
            {visivel("CONTATO", data) ? (
              <a href="#contato" onClick={(event) => scrollPreviewTo(event, "contato", preview)}>
                Contato
              </a>
            ) : null}
          </nav>
          <a
            href="#agendar"
            onClick={(event) => scrollPreviewTo(event, "agendar", preview)}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-hover"
          >
            <CalendarDays className="size-4" />
            Agendar
          </a>
        </div>
      </header>

      <main id="inicio">
        {ordem.map((secao) => {
          const hidden = !secao.visivel;
          const frame = { preview, hidden, highlight };

          if (secao.tipo === "HERO") {
            return (
              <PageSection key="HERO" tipo="HERO" className="relative overflow-hidden bg-[#f6f0ff]" {...frame}>
                <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:py-20">
                  <div>
                    <p className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-wide text-brand uppercase ring-1 ring-violet-100">
                      Clínica veterinária
                    </p>
                    <h1 className="mt-5 text-4xl font-bold tracking-tight text-[#3b2064] sm:text-5xl">
                      <Headline text={titulo} />
                    </h1>
                    <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">{subtitulo}</p>
                    {hero?.texto || clinica.sobre ? (
                      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">{hero?.texto || clinica.sobre}</p>
                    ) : preview ? (
                      <p className="mt-4 max-w-xl text-sm text-muted">Escreva o texto da hero para aparecer aqui.</p>
                    ) : null}
                    <ul className="mt-8 grid gap-3 sm:grid-cols-3">
                      {topicos.map((topico, index) => {
                        const Icon = DEFAULT_TOPICOS[index % DEFAULT_TOPICOS.length].Icon;
                        return (
                          <li key={topico.id || topico.titulo} className="flex items-start gap-2.5">
                            <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-brand shadow-sm ring-1 ring-violet-100">
                              <Icon className="size-4" />
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-ink">{topico.titulo}</p>
                              {topico.texto ? <p className="mt-0.5 text-xs text-muted">{topico.texto}</p> : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div className="relative">
                    <div className="absolute -right-6 -top-6 size-40 rounded-full bg-violet-200/50 blur-2xl" />
                    <img
                      src={heroFoto}
                      alt=""
                      className="relative aspect-[4/3] w-full rounded-[2rem] object-cover shadow-[0_24px_60px_-28px_rgba(120,40,200,0.45)]"
                    />
                  </div>
                </div>
              </PageSection>
            );
          }

          if (secao.tipo === "SOBRE") {
            if (!clinica.sobre && !preview) return null;
            return (
              <PageSection key="SOBRE" tipo="SOBRE" className="mx-auto max-w-6xl px-4 py-14 sm:px-6" {...frame}>
                <p className="text-sm font-semibold tracking-wide text-brand uppercase">Sobre</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight">Mais que uma clínica</h2>
                {clinica.sobre ? (
                  <p className="mt-4 max-w-3xl leading-relaxed text-muted whitespace-pre-wrap">{clinica.sobre}</p>
                ) : (
                  <p className="mt-4 text-sm text-muted">Escreva o texto da clínica para esta seção aparecer no público.</p>
                )}
              </PageSection>
            );
          }

          if (secao.tipo === "SERVICOS") {
            return (
              <PageSection key="SERVICOS" tipo="SERVICOS" publicId="servicos" className="mx-auto max-w-6xl px-4 py-16 sm:px-6" {...frame}>
                <div className="text-center">
                  <h2 className="text-3xl font-bold tracking-tight">Nossos Serviços</h2>
                  <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-brand" />
                  <p className="mx-auto mt-4 max-w-2xl text-sm text-muted">
                    Tudo o que seu pet precisa, com uma equipe preparada e estrutura completa.
                  </p>
                </div>
                {!data.servicos.length ? (
                  <div className="mt-8">
                    <EmptyState title="Serviços em atualização" description="A clínica ainda não publicou a oferta." />
                  </div>
                ) : (
                  <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    {data.servicos.map((item, index) => {
                      return (
                        <li key={item.id} className="rounded-3xl bg-white px-5 py-6 text-center shadow-sm ring-1 ring-violet-100">
                          <span
                            className={`mx-auto inline-flex size-14 items-center justify-center rounded-full ${PASTELS[index % PASTELS.length]}`}
                          >
                            <ServiceTypeIcon icone={item.icone} nome={item.nome} className="size-6" />
                          </span>
                          <p className="mt-4 font-semibold">{item.nome}</p>
                          <p className="mt-2 text-sm leading-relaxed text-muted">{servicoTexto(item)}</p>
                          {money(item.preco) ? <p className="mt-3 text-sm font-medium text-brand">{money(item.preco)}</p> : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </PageSection>
            );
          }

          if (secao.tipo === "ESPECIALIDADE") {
            if (!data.especialidades.length && !preview) return null;
            return (
              <PageSection key="ESPECIALIDADE" tipo="ESPECIALIDADE" className="mx-auto max-w-6xl px-4 py-12 sm:px-6" {...frame}>
                <h2 className="text-2xl font-bold">Especialidades</h2>
                {!data.especialidades.length ? (
                  <p className="mt-3 text-sm text-muted">Nenhuma especialidade visível no momento.</p>
                ) : (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {data.especialidades.map((item) => (
                      <li key={item} className="rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand">
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </PageSection>
            );
          }

          if (secao.tipo === "EQUIPE") {
            return (
              <PageSection key="EQUIPE" tipo="EQUIPE" publicId="equipe" className="mx-auto max-w-6xl px-4 py-16 sm:px-6" {...frame}>
                <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight">Nossa Equipe</h2>
                    <p className="mt-4 max-w-md leading-relaxed text-muted">
                      Profissionais dedicados, prontos para cuidar do seu pet com técnica, atenção e carinho em cada atendimento.
                    </p>
                    <a
                      href="#equipe-lista"
                      onClick={(event) => scrollPreviewTo(event, "equipe-lista", preview)}
                      className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"
                    >
                      Conheça nossa equipe
                      <span aria-hidden>→</span>
                    </a>
                  </div>
                  <div id="equipe-lista" className="rounded-[2rem] bg-[#f3f4f6] p-5 sm:p-7">
                    {!equipe.length ? (
                      <p className="text-sm text-muted">A equipe pública aparece quando o colaborador autoriza a exibição.</p>
                    ) : (
                      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {equipe.map((membro) => (
                          <li key={membro.nome} className="rounded-3xl bg-white px-3 py-5 text-center shadow-sm">
                            {mediaUrl(membro.fotoUrl) ? (
                              <img
                                src={mediaUrl(membro.fotoUrl)}
                                alt=""
                                className="mx-auto size-20 rounded-full object-cover ring-4 ring-brand-soft"
                              />
                            ) : (
                              <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-brand-soft text-xl font-bold text-brand ring-4 ring-white">
                                {membro.nome.slice(0, 1)}
                              </span>
                            )}
                            <p className="mt-3 text-sm font-semibold">{membro.nome}</p>
                            <p className="mt-1 text-xs text-muted">{membro.cargo || "Equipe clínica"}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </PageSection>
            );
          }

          if (secao.tipo === "AVALIACOES") {
            if (!data.avaliacoes.length && !preview) return null;
            return (
              <PageSection key="AVALIACOES" tipo="AVALIACOES" publicId="avaliacoes" className="mx-auto max-w-6xl px-4 py-16 sm:px-6" {...frame}>
                <div className="text-center">
                  <h2 className="text-3xl font-bold tracking-tight">Avaliações</h2>
                  <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-brand" />
                </div>
                {!data.avaliacoes.length ? (
                  <p className="mt-6 text-center text-sm text-muted">Nenhum depoimento autorizado e visível.</p>
                ) : (
                  <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {data.avaliacoes.map((item) => (
                      <li key={item.id} className="rounded-3xl bg-[#f6f0ff] p-5">
                        <p className="font-semibold">{item.tutor}</p>
                        <p className="text-sm text-muted">
                          Nota {item.nota}
                          {item.pet ? ` · ${item.pet}` : ""}
                        </p>
                        <p className="mt-3 text-sm leading-relaxed">{item.texto}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </PageSection>
            );
          }

          if (secao.tipo === "GALERIA") {
            if (!data.galeria?.length && !preview) return null;
            return (
              <PageSection key="GALERIA" tipo="GALERIA" className="mx-auto max-w-6xl px-4 py-14 sm:px-6" {...frame}>
                <h2 className="text-2xl font-bold">Galeria</h2>
                {!data.galeria?.length ? (
                  <p className="mt-3 text-sm text-muted">As fotos escolhidas aparecem aqui.</p>
                ) : (
                  <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                    {data.galeria.map((item) => (
                      <img key={item.id} src={mediaUrl(item.url)} alt={item.alt ?? ""} className="aspect-square w-full rounded-3xl object-cover" />
                    ))}
                  </div>
                )}
              </PageSection>
            );
          }

          if (secao.tipo === "LOCALIZACAO") {
            const texto = enderecoTexto(data);
            const mapsUrl = data.endereco?.mapsUrl;
            if (!texto && !mapsUrl && !preview) return null;
            return (
              <PageSection key="LOCALIZACAO" tipo="LOCALIZACAO" className="mx-auto max-w-6xl px-4 py-14 sm:px-6" {...frame}>
                <h2 className="text-2xl font-bold">Onde estamos</h2>
                {texto ? <p className="mt-3 text-muted">{texto}</p> : preview ? <p className="mt-3 text-sm text-muted">Preencha o endereço para ver o texto aqui.</p> : null}
                {mapsUrl ? (
                  mapsUrl.includes("/embed") || mapsUrl.includes("output=embed") ? (
                    <iframe title="Mapa da clínica" src={mapsUrl} className="mt-4 h-64 w-full rounded-3xl border-0" />
                  ) : (
                    <a href={mapsUrl} className="mt-3 inline-block font-medium text-brand hover:underline" target="_blank" rel="noreferrer">
                      Ver no mapa
                    </a>
                  )
                ) : null}
              </PageSection>
            );
          }

          if (secao.tipo === "CONTATO") {
            return (
              <PageSection key="CONTATO" tipo="CONTATO" publicId="contato" className="border-t border-violet-100 bg-white" {...frame}>
                <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                      <MapPin className="size-5" />
                    </span>
                    <div>
                      <p className="font-semibold">Onde estamos</p>
                      <p className="mt-1 text-sm text-muted">{cidadeUf(data)}</p>
                      {enderecoTexto(data) ? <p className="mt-1 text-xs text-muted">{enderecoTexto(data)}</p> : null}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                      <Phone className="size-5" />
                    </span>
                    <div>
                      <p className="font-semibold">Contato</p>
                      {clinica.telefone ? (
                        <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                          <Phone className="size-3.5" />
                          {clinica.telefone}
                        </p>
                      ) : preview ? (
                        <p className="mt-1 text-sm text-muted">Telefone da clínica</p>
                      ) : null}
                      {clinica.email ? (
                        <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                          <Mail className="size-3.5" />
                          {clinica.email}
                        </p>
                      ) : preview ? (
                        <p className="mt-1 text-sm text-muted">E-mail da clínica</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center sm:justify-end">
                    {!preview ? (
                      <Button to={loginNext} variant="secondary" className="rounded-full">
                        Agendar / entrar no Flutz
                      </Button>
                    ) : (
                      <span className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand">
                        Agendar / entrar no Flutz
                      </span>
                    )}
                  </div>
                </div>
              </PageSection>
            );
          }

          if (secao.tipo === "DOACOES") {
            return (
              <PageSection key="DOACOES" tipo="DOACOES" className="mx-auto max-w-6xl px-4 py-14 sm:px-6" {...frame}>
                <h2 className="text-2xl font-bold">Doações</h2>
                {!data.doacoes.length ? (
                  <p className="mt-3 text-sm text-muted">Nenhuma campanha visível no momento.</p>
                ) : (
                  <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {data.doacoes.map((item) => (
                      <li key={item.id} className="rounded-3xl bg-[#f6f0ff] p-4">
                        <p className="font-semibold">{item.titulo}</p>
                        {item.texto ? <p className="mt-2 text-sm leading-relaxed text-muted">{item.texto}</p> : null}
                        {item.metaValor != null ? <p className="mt-2 text-sm">Meta {money(item.metaValor)}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </PageSection>
            );
          }

          return null;
        })}

        {preview || data.clinica.id ? (
          <AgendarNaClinica
            empresaId={data.clinica.id ?? undefined}
            nome={clinica.nome}
            slug={clinica.slug || undefined}
            preview={preview}
          />
        ) : null}
      </main>

      <footer className="border-t border-violet-100 bg-[#faf7ff] px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {mediaUrl(clinica.logoUrl) ? (
              <img src={mediaUrl(clinica.logoUrl)} alt="" className="size-11 shrink-0 rounded-xl object-cover sm:size-12" />
            ) : (
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-lg font-bold text-brand sm:size-12">
                {clinica.nome.slice(0, 1)}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold">{clinica.nome}</p>
              <p className="text-sm text-muted">Mais que uma clínica, um parceiro na vida do seu pet.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-brand">
            {data.redes.length
              ? data.redes.map((rede) => (
                  <a
                    key={`${rede.tipoId}-${rede.url}`}
                    href={rede.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex size-10 items-center justify-center rounded-full bg-white ring-1 ring-violet-100 hover:bg-brand-soft"
                    aria-label={rede.nome}
                  >
                    <SocialIcon nome={rede.nome} url={rede.url} />
                  </a>
                ))
              : (
                  <>
                    <a
                      href={env.instagramUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex size-10 items-center justify-center rounded-full bg-white ring-1 ring-violet-100 hover:bg-brand-soft"
                      aria-label="Instagram"
                    >
                      <Camera className="size-4" />
                    </a>
                    <span className="inline-flex size-10 items-center justify-center rounded-full bg-white text-muted ring-1 ring-violet-100">
                      <Share2 className="size-4" />
                    </span>
                    {clinica.telefone || env.contactWhatsapp ? (
                      <a
                        href={`https://wa.me/${(clinica.telefone || env.contactWhatsapp).replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex size-10 items-center justify-center rounded-full bg-white ring-1 ring-violet-100 hover:bg-brand-soft"
                        aria-label="WhatsApp"
                      >
                        <MessageCircle className="size-4" />
                      </a>
                    ) : null}
                  </>
                )}
          </div>
        </div>
        {!preview ? (
          <p className="mx-auto mt-8 max-w-6xl text-center text-xs text-muted">
            Página da clínica · plataforma{" "}
            <Link to="/" className="underline">
              Flutz
            </Link>
          </p>
        ) : null}
      </footer>
    </div>
  );
}

function SocialIcon({ nome, url }: { nome: string; url: string }) {
  const value = `${nome} ${url}`.toLowerCase();
  if (value.includes("insta")) return <Camera className="size-4" />;
  if (value.includes("face") || value.includes("fb.com")) return <Share2 className="size-4" />;
  if (value.includes("whats") || value.includes("wa.me")) return <MessageCircle className="size-4" />;
  return <PawPrint className="size-4" />;
}

export function editorToPublic(editor: {
  secoes: PublicClinic["secoes"];
  identidade: PublicClinic["clinica"];
  endereco: PublicClinic["endereco"];
  hero: PublicClinic["hero"];
  servicos: PublicClinic["servicos"];
  especialidades: { nome: string; visivel: boolean }[];
  equipe: { nome: string; visivel: boolean; autorizado: boolean | null; cargo?: string | null; fotoUrl?: string | null }[];
  avaliacoes: PublicClinic["avaliacoes"];
  galeria: PublicClinic["galeria"];
  redes: PublicClinic["redes"];
  doacoes: PublicClinic["doacoes"];
}): PublicClinic {
  return {
    clinica: editor.identidade ?? { nome: "Clínica", slug: "", logoUrl: null, sobre: null, email: null, telefone: null },
    endereco: editor.endereco ?? {
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      uf: null,
      cep: null,
      mapsUrl: null,
      latitude: null,
      longitude: null,
    },
    secoes: editor.secoes ?? [],
    hero: editor.hero ? { ...editor.hero, topicos: editor.hero.topicos ?? [] } : null,
    servicos: (editor.servicos ?? []).filter((item) => item.visivel),
    equipe: (editor.equipe ?? [])
      .filter((item) => item.visivel && item.autorizado)
      .map((item) => ({ nome: item.nome, cargo: item.cargo ?? null, fotoUrl: item.fotoUrl ?? null })),
    especialidades: (editor.especialidades ?? []).filter((item) => item.visivel).map((item) => item.nome),
    avaliacoes: (editor.avaliacoes ?? []).filter((item) => item.visivel && item.autorizado),
    galeria: (editor.galeria ?? []).filter((item) => item.visivel),
    redes: (editor.redes ?? []).filter((item) => item.tipoId && item.url.trim()),
    doacoes: (editor.doacoes ?? []).filter((item) => item.visivelPagina),
  };
}
