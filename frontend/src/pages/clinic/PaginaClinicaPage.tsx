import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClinicaPublicaView, editorToPublic } from "../../components/clinic/ClinicaPublicaView";
import { ImagePickField } from "../../components/clinic/ImagePickField";
import { Button } from "../../components/ui/Button";
import { ErrorState, LoadingState } from "../../components/ui/EmptyState";
import { Field, Input, Select, Surface, Textarea } from "../../components/ui/Field";
import { PageHeader } from "../../components/ui/PageHeader";
import { http, HttpError } from "../../lib/http";
import { readBrowserPosition, type EnderecoSugerido } from "../../lib/geo";
import { mediaUrl } from "../../lib/media";
import { ensureHero, normalizePageEditor, patchHero } from "../../lib/page-editor";
import { useClinicBrand } from "../../providers/ClinicContext";
import { useToast } from "../../providers/ToastProvider";
import { api, type PageDonation, type PageEditor, type PageSection } from "../../services/api";

const LABELS: Record<string, string> = {
  HERO: "Hero",
  SOBRE: "Sobre",
  SERVICOS: "Serviços",
  ESPECIALIDADE: "Especialidades",
  EQUIPE: "Equipe",
  AVALIACOES: "Avaliações",
  GALERIA: "Galeria",
  LOCALIZACAO: "Localização",
  CONTATO: "Contato",
  DOACOES: "Doações",
};

const CAMPANHA_VAZIA = { titulo: "", texto: "", metaValor: "", dataInicio: "", dataFim: "" };

export function PaginaClinicaPage() {
  const toast = useToast();
  const clinic = useClinicBrand();
  const queryClient = useQueryClient();
  const pagina = useQuery({ queryKey: ["pagina"], queryFn: api.pageConfig });
  const [atual, setAtual] = useState("HERO");
  const [draft, setDraft] = useState<PageEditor | null>(null);
  const [campanha, setCampanha] = useState(CAMPANHA_VAZIA);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pagina.data) return;
    setDraft((atual) => atual ?? normalizePageEditor(pagina.data, clinic));
  }, [pagina.data, clinic]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["pagina"] });
    queryClient.invalidateQueries({ queryKey: ["contexto", "clinica"] });
  };

  const layout = useMutation({
    mutationFn: api.saveLayout,
    meta: { skipErrorToast: true },
    onSuccess: () => toast.push("Ordem e visibilidade salvas."),
    onError: (error) => toast.push(error instanceof HttpError ? error.message : "Não foi possível salvar o layout.", "danger"),
  });
  const salvarHero = useMutation({
    mutationFn: api.saveHero,
    meta: { skipErrorToast: true },
    onSuccess: () => toast.push("Hero salva."),
    onError: (error) => toast.push(error instanceof HttpError ? error.message : "Não foi possível salvar a hero.", "danger"),
  });
  const salvarIdentidade = useMutation({
    mutationFn: api.saveIdentidade,
    meta: { skipErrorToast: true },
    onSuccess: () => toast.push("Sobre salvo."),
    onError: (error) => toast.push(error instanceof HttpError ? error.message : "Não foi possível salvar o sobre.", "danger"),
  });
  const salvarEndereco = useMutation({
    mutationFn: api.saveEndereco,
    meta: { skipErrorToast: true },
    onSuccess: () => toast.push("Localização salva."),
    onError: (error) => toast.push(error instanceof HttpError ? error.message : "Não foi possível salvar a localização.", "danger"),
  });
  const salvarContato = useMutation({
    mutationFn: api.saveContato,
    meta: { skipErrorToast: true },
    onSuccess: () => toast.push("Contato salvo."),
    onError: (error) => toast.push(error instanceof HttpError ? error.message : "Não foi possível salvar o contato.", "danger"),
  });
  const visibilidade = useMutation({
    mutationFn: api.saveVisibilidade,
    meta: { skipErrorToast: true },
    onError: (error) => toast.push(error instanceof HttpError ? error.message : "Não foi possível atualizar a visibilidade.", "danger"),
  });
  const doacao = useMutation({
    mutationFn: api.createDoacao,
    meta: { skipErrorToast: true },
    onSuccess: (salvo) => {
      setDraft((atualDraft) => {
        if (!atualDraft) return atualDraft;
        const nova: PageDonation = {
          id: salvo.id,
          titulo: campanha.titulo,
          texto: campanha.texto || null,
          metaValor: campanha.metaValor ? Number(campanha.metaValor) : null,
          dataInicio: campanha.dataInicio || null,
          dataFim: campanha.dataFim || null,
          visivelPagina: true,
        };
        return { ...atualDraft, doacoes: [...atualDraft.doacoes, nova] };
      });
      setCampanha(CAMPANHA_VAZIA);
      toast.push("Campanha publicada.");
    },
    onError: (error) => toast.push(error instanceof HttpError ? error.message : "Não foi possível publicar a campanha.", "danger"),
  });
  const arquivo = useMutation({
    mutationFn: ({ destino, file }: { destino: "logo" | "hero" | "galeria"; file: File }) => api.uploadArquivo(destino, file),
    meta: { skipErrorToast: true },
  });

  if (pagina.isError && !draft) {
    return (
      <ErrorState
        message={pagina.error instanceof HttpError ? pagina.error.message : "Não foi possível abrir o construtor da página."}
      />
    );
  }
  if (pagina.isLoading || !draft) return <LoadingState label="Abrindo o construtor da página…" />;

  const page = draft;
  const previewDraft: PageEditor = {
    ...page,
    doacoes:
      campanha.titulo.trim() && page.permiteDoacoes
        ? [
            ...page.doacoes,
            {
              id: -1,
              titulo: campanha.titulo,
              texto: campanha.texto || null,
              metaValor: campanha.metaValor ? Number(campanha.metaValor) : null,
              dataInicio: campanha.dataInicio || null,
              dataFim: campanha.dataFim || null,
              visivelPagina: true,
            },
          ]
        : page.doacoes,
  };

  const scrollPreview = (tipo: string) => {
    const root = previewRef.current;
    const el = root?.querySelector(`[data-section="${tipo}"]`);
    if (!root || !(el instanceof HTMLElement)) return;
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
    root.scrollTo({ top: Math.max(0, top - 8), behavior: "smooth" });
  };

  const abrirSecao = (tipo: string) => {
    setAtual(tipo);
    requestAnimationFrame(() => scrollPreview(tipo));
  };

  const mover = (index: number, dir: number) => {
    if (layout.isPending) return;
    const next = [...page.secoes];
    const dest = index + dir;
    if (dest < 0 || dest >= next.length) return;
    [next[index], next[dest]] = [next[dest], next[index]];
    const secoes = next.map((item, ordem) => ({ ...item, ordem: ordem + 1 }));
    setDraft({ ...page, secoes });
    layout.mutate(secoes);
  };

  const alternar = (secao: PageSection) => {
    if (layout.isPending) return;
    const secoes = page.secoes.map((item) => (item.tipo === secao.tipo ? { ...item, visivel: !item.visivel } : item));
    setDraft({ ...page, secoes });
    layout.mutate(secoes);
  };

  const onPick = (destino: "logo" | "hero" | "galeria", file: File, previewUrl: string) => {
    setDraft((atualDraft) => {
      if (!atualDraft) return atualDraft;
      if (destino === "logo") return { ...atualDraft, identidade: { ...atualDraft.identidade, logoUrl: previewUrl } };
      if (destino === "hero") return patchHero(atualDraft, { imagemFundoUrl: previewUrl });
      return {
        ...atualDraft,
        galeria: [
          ...atualDraft.galeria,
          { id: -Date.now(), url: previewUrl, alt: file.name, ordem: atualDraft.galeria.length + 1, visivel: true },
        ],
      };
    });
    arquivo.mutate(
      { destino, file },
      {
        onSuccess: (salvo) => {
          setDraft((atualDraft) => {
            if (!atualDraft) return atualDraft;
            if (destino === "logo") return { ...atualDraft, identidade: { ...atualDraft.identidade, logoUrl: salvo.url } };
            if (destino === "hero") return patchHero(atualDraft, { imagemFundoUrl: salvo.url });
            return {
              ...atualDraft,
              galeria: atualDraft.galeria.map((item) =>
                item.url === previewUrl ? { ...item, url: salvo.url, alt: file.name } : item,
              ),
            };
          });
          refresh();
          toast.push(destino === "logo" ? "Logo salva." : destino === "hero" ? "Fundo da hero salvo." : "Foto adicionada.");
        },
        onError: (error) => {
          toast.push(
            error instanceof HttpError
              ? `${error.message} A imagem já aparece no preview; o arquivo ainda não foi gravado no servidor.`
              : "A imagem já aparece no preview; o arquivo ainda não foi gravado no servidor.",
          );
        },
      },
    );
  };

  const onHero = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hero = ensureHero(page);
    salvarHero.mutate({
      titulo: hero.titulo,
      subtitulo: hero.subtitulo ?? "",
      texto: hero.texto ?? "",
      imagemPosicaoId: hero.imagemPosicaoId,
      topicos: hero.topicos.filter((item) => item.titulo.trim()).map((item) => ({ titulo: item.titulo, texto: item.texto ?? "" })),
    });
  };

  const onSobre = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    salvarIdentidade.mutate({ sobre: page.identidade.sobre ?? "" });
  };

  const onEndereco = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    salvarEndereco.mutate(page.endereco);
  };

  const onContato = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    salvarContato.mutate({
      email: page.identidade.email ?? "",
      telefone: page.identidade.telefone ?? "",
      redes: page.redes
        .filter((item) => item.tipoId && item.url.trim())
        .map((item) => ({ tipoId: item.tipoId, url: item.url.trim() })),
    });
  };

  const onDoacao = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    doacao.mutate({
      titulo: campanha.titulo,
      texto: campanha.texto || undefined,
      metaValor: campanha.metaValor ? Number(campanha.metaValor) : undefined,
      dataInicio: campanha.dataInicio || undefined,
      dataFim: campanha.dataFim || undefined,
    });
  };

  const toggleItem = (tipo: string, id: number, visivel: boolean) => {
    if (visibilidade.isPending) return;
    setDraft((atualDraft) => {
      if (!atualDraft) return atualDraft;
      if (tipo === "SERVICO") return { ...atualDraft, servicos: atualDraft.servicos.map((item) => (item.id === id ? { ...item, visivel } : item)) };
      if (tipo === "ESPECIALIDADE") {
        return { ...atualDraft, especialidades: atualDraft.especialidades.map((item) => (item.id === id ? { ...item, visivel } : item)) };
      }
      if (tipo === "EQUIPE") return { ...atualDraft, equipe: atualDraft.equipe.map((item) => (item.id === id ? { ...item, visivel } : item)) };
      if (tipo === "AVALIACAO") {
        return { ...atualDraft, avaliacoes: atualDraft.avaliacoes.map((item) => (item.id === id ? { ...item, visivel } : item)) };
      }
      if (tipo === "GALERIA") return { ...atualDraft, galeria: atualDraft.galeria.map((item) => (item.id === id ? { ...item, visivel } : item)) };
      if (tipo === "DOACAO") {
        return { ...atualDraft, doacoes: atualDraft.doacoes.map((item) => (item.id === id ? { ...item, visivelPagina: visivel } : item)) };
      }
      return atualDraft;
    });
    visibilidade.mutate({ tipo, id, visivel });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        hideArt
        eyebrow="Presença"
        title="Construtor da página"
        description="Edite à esquerda e veja a página pública à direita, em tempo real. A imagem no preview aparece na hora."
        actions={
          page.identidade.slug ? (
            <Button href={`/clinica/${page.identidade.slug}`} target="_blank" rel="noreferrer">
              Abrir página pública
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 items-start gap-4 pb-8 lg:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)]">
        <div className="order-2 grid min-w-0 content-start gap-4 lg:order-1 lg:pr-1">
          <Surface className="p-3">
            <p className="px-2 text-xs font-semibold tracking-wide text-muted uppercase">Seções</p>
            <ul className="mt-2">
              {page.secoes.map((secao, index) => (
                <li key={secao.tipo}>
                  <div className={`flex items-center gap-1 rounded-xl px-2 py-2 ${atual === secao.tipo ? "bg-brand-soft" : ""}`}>
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => abrirSecao(secao.tipo)}>
                      <p className="truncate text-sm font-medium">{LABELS[secao.tipo] ?? secao.tipo}</p>
                      <p className="text-[11px] text-muted">{secao.visivel ? "Visível" : "Oculta"}</p>
                    </button>
                    <button type="button" className="px-1 text-xs text-muted disabled:opacity-50" disabled={layout.isPending} onClick={() => mover(index, -1)} aria-label="Subir">
                      ↑
                    </button>
                    <button type="button" className="px-1 text-xs text-muted disabled:opacity-50" disabled={layout.isPending} onClick={() => mover(index, 1)} aria-label="Descer">
                      ↓
                    </button>
                    <button type="button" className="px-1 text-xs font-semibold text-brand disabled:opacity-50" disabled={layout.isPending} onClick={() => alternar(secao)}>
                      {layout.isPending ? "Salvando…" : secao.visivel ? "Ocultar" : "Exibir"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Surface>

          <EditorBlock
            tipo={atual}
            draft={page}
            setDraft={setDraft}
            campanha={campanha}
            setCampanha={setCampanha}
            onHero={onHero}
            onSobre={onSobre}
            onEndereco={onEndereco}
            onContato={onContato}
            onDoacao={onDoacao}
            onPick={onPick}
            onToggle={toggleItem}
            pending={
              salvarHero.isPending ||
              salvarIdentidade.isPending ||
              salvarEndereco.isPending ||
              salvarContato.isPending ||
              doacao.isPending ||
              visibilidade.isPending
            }
          />
        </div>

        <Surface className="order-1 flex min-h-[22rem] flex-col overflow-hidden p-0 lg:sticky lg:top-20 lg:order-2 lg:max-h-[calc(100svh-8rem)]">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span className="size-2 rounded-full bg-rose-300" />
            <span className="size-2 rounded-full bg-amber-300" />
            <span className="size-2 rounded-full bg-emerald-300" />
            <p className="min-w-0 flex-1 truncate rounded-full bg-[#f7f5fb] px-3 py-1 text-xs text-muted">
              /clinica/{page.identidade.slug || "…"} · preview ao vivo
            </p>
          </div>
          <div ref={previewRef} data-page-preview className="min-h-0 flex-1 overflow-auto bg-white">
            <ClinicaPublicaView
              data={editorToPublic({ ...previewDraft, hero: ensureHero(previewDraft) })}
              preview
              highlight={atual}
            />
          </div>
        </Surface>
      </div>
    </div>
  );
}

function EditorBlock({
  tipo,
  draft,
  setDraft,
  campanha,
  setCampanha,
  onHero,
  onSobre,
  onEndereco,
  onContato,
  onDoacao,
  onPick,
  onToggle,
  pending,
}: {
  tipo: string;
  draft: PageEditor;
  setDraft: (value: PageEditor | ((atual: PageEditor | null) => PageEditor | null)) => void;
  campanha: typeof CAMPANHA_VAZIA;
  setCampanha: (value: typeof CAMPANHA_VAZIA) => void;
  onHero: (event: FormEvent<HTMLFormElement>) => void;
  onSobre: (event: FormEvent<HTMLFormElement>) => void;
  onEndereco: (event: FormEvent<HTMLFormElement>) => void;
  onContato: (event: FormEvent<HTMLFormElement>) => void;
  onDoacao: (event: FormEvent<HTMLFormElement>) => void;
  onPick: (destino: "logo" | "hero" | "galeria", file: File, previewUrl: string) => void;
  onToggle: (tipo: string, id: number, visivel: boolean) => void;
  pending: boolean;
}) {
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsErro, setGpsErro] = useState("");
  const hero = ensureHero(draft);

  async function usarLocalizacaoAtual() {
    setGpsErro("");
    setGpsBusy(true);
    try {
      const pos = await readBrowserPosition();
      setDraft((atual) =>
        atual
          ? {
              ...atual,
              endereco: {
                ...atual.endereco,
                latitude: pos.latitude,
                longitude: pos.longitude,
              },
            }
          : atual,
      );
      try {
        const sugerido = await http<EnderecoSugerido>(`/api/geo/reverso?lat=${pos.latitude}&lng=${pos.longitude}`);
        setDraft((atual) =>
          atual
            ? {
                ...atual,
                endereco: {
                  ...atual.endereco,
                  latitude: pos.latitude,
                  longitude: pos.longitude,
                  logradouro: sugerido.logradouro ?? atual.endereco.logradouro,
                  numero: sugerido.numero ?? atual.endereco.numero,
                  bairro: sugerido.bairro ?? atual.endereco.bairro,
                  cidade: sugerido.cidade ?? atual.endereco.cidade,
                  uf: sugerido.uf ?? atual.endereco.uf,
                  cep: sugerido.cep ?? atual.endereco.cep,
                },
              }
            : atual,
        );
      } catch {
        /* coordenadas do aparelho já foram aplicadas */
      }
    } catch (error) {
      setGpsErro(error instanceof Error ? error.message : "Não foi possível obter a localização.");
    } finally {
      setGpsBusy(false);
    }
  }

  if (tipo === "HERO") {
    return (
      <form onSubmit={onHero}>
        <Surface className="grid gap-3">
          <h2 className="font-semibold">Hero</h2>
          <ImagePickField
            label="Imagem de fundo"
            destine="hero"
            currentUrl={hero.imagemFundoUrl}
            onPick={(file, url) => onPick("hero", file, url)}
          />
          <Field label="Posição da imagem">
            <Select
              value={hero.imagemPosicaoId ?? ""}
              onChange={(event) =>
                setDraft((atual) => (atual ? patchHero(atual, { imagemPosicaoId: event.target.value ? Number(event.target.value) : null }) : atual))
              }
            >
              <option value="">Centro</option>
              {draft.posicoes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Título">
            <Input
              value={hero.titulo}
              required
              onChange={(event) => setDraft((atual) => (atual ? patchHero(atual, { titulo: event.target.value }) : atual))}
            />
          </Field>
          <Field label="Subtítulo">
            <Input
              value={hero.subtitulo ?? ""}
              onChange={(event) => setDraft((atual) => (atual ? patchHero(atual, { subtitulo: event.target.value }) : atual))}
            />
          </Field>
          <Field label="Texto">
            <Textarea
              value={hero.texto ?? ""}
              onChange={(event) => setDraft((atual) => (atual ? patchHero(atual, { texto: event.target.value }) : atual))}
            />
          </Field>
          <div>
            <p className="text-sm font-medium">Tópicos da hero</p>
            <div className="mt-2 grid gap-2">
              {hero.topicos.map((topico, index) => (
                <div key={topico.id || index} className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={topico.titulo}
                    placeholder="Título"
                    onChange={(event) =>
                      setDraft((atual) => {
                        if (!atual) return atual;
                        const atualHero = ensureHero(atual);
                        return patchHero(atual, {
                          topicos: atualHero.topicos.map((item, i) => (i === index ? { ...item, titulo: event.target.value } : item)),
                        });
                      })
                    }
                  />
                  <Input
                    value={topico.texto ?? ""}
                    placeholder="Texto"
                    onChange={(event) =>
                      setDraft((atual) => {
                        if (!atual) return atual;
                        const atualHero = ensureHero(atual);
                        return patchHero(atual, {
                          topicos: atualHero.topicos.map((item, i) => (i === index ? { ...item, texto: event.target.value } : item)),
                        });
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              onClick={() =>
                setDraft((atual) => {
                  if (!atual) return atual;
                  const atualHero = ensureHero(atual);
                  return patchHero(atual, {
                    topicos: [...atualHero.topicos, { id: -Date.now(), titulo: "", texto: "", iconeUrl: null, ordem: atualHero.topicos.length + 1 }],
                  });
                })
              }
            >
              + Tópico
            </Button>
          </div>
          <Button type="submit" busy={pending} busyLabel="Salvando…">
            Salvar hero
          </Button>
        </Surface>
      </form>
    );
  }

  if (tipo === "SOBRE") {
    return (
      <form onSubmit={onSobre}>
        <Surface className="grid gap-3">
          <h2 className="font-semibold">Sobre</h2>
          <ImagePickField
            label="Logo da clínica"
            destine="logo"
            currentUrl={draft.identidade.logoUrl}
            onPick={(file, url) => onPick("logo", file, url)}
          />
          <Field label="Texto da clínica">
            <Textarea
              rows={6}
              value={draft.identidade.sobre ?? ""}
              onChange={(event) =>
                setDraft((atual) => (atual ? { ...atual, identidade: { ...atual.identidade, sobre: event.target.value } } : atual))
              }
            />
          </Field>
          <Button type="submit" busy={pending} busyLabel="Salvando…">
            Salvar sobre
          </Button>
        </Surface>
      </form>
    );
  }

  if (tipo === "SERVICOS") {
    return (
      <ListaVisivel
        titulo="Serviços na página"
        vazio="Cadastre serviços em Serviços e escolha quais aparecem aqui."
        itens={draft.servicos}
        pending={pending}
        onToggle={(item) => onToggle("SERVICO", item.id, !item.visivel)}
      />
    );
  }
  if (tipo === "ESPECIALIDADE") {
    return (
      <ListaVisivel
        titulo="Especialidades na página"
        vazio="Cadastre especialidades em Catálogos — elas já entram ativas na clínica."
        itens={draft.especialidades}
        pending={pending}
        onToggle={(item) => onToggle("ESPECIALIDADE", item.id, !item.visivel)}
      />
    );
  }
  if (tipo === "EQUIPE") {
    return (
      <ListaVisivel
        titulo="Equipe na página"
        vazio="Cadastre colaboradores em Equipe."
        hint="Use Exibir para publicar o colaborador na página. Também dá para fazer isso em Equipe e horários."
        itens={draft.equipe}
        pending={pending}
        onToggle={(item) => onToggle("EQUIPE", item.id, !item.visivel)}
      />
    );
  }
  if (tipo === "AVALIACOES") {
    return (
      <ListaVisivel
        titulo="Avaliações na página"
        vazio="Ainda não há depoimentos."
        hint="Só o tutor autoriza a publicação. A clínica só liga ou desliga a visibilidade das autorizadas."
        itens={draft.avaliacoes.map((item) => ({
          id: item.id,
          nome: `${item.tutor}${item.autorizado ? "" : " · sem autorização"}`,
          visivel: item.visivel,
          autorizado: item.autorizado,
        }))}
        pending={pending}
        onToggle={(item) => onToggle("AVALIACAO", item.id, !item.visivel)}
      />
    );
  }
  if (tipo === "GALERIA") {
    return (
      <Surface className="grid gap-4">
        <h2 className="font-semibold">Galeria</h2>
        <ImagePickField label="Nova foto da galeria" destine="galeria" onPick={(file, url) => onPick("galeria", file, url)} />
        {!draft.galeria.length ? (
          <p className="text-sm text-muted">Nenhuma foto ainda.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {draft.galeria.map((item) => (
              <li key={item.id} className="overflow-hidden rounded-2xl ring-1 ring-line">
                <img src={mediaUrl(item.url)} alt={item.alt ?? ""} className="aspect-square w-full object-cover" />
                <div className="px-2 py-2">
                  <p className="truncate text-[11px] text-muted">{item.alt || "Foto da galeria"}</p>
                  <button
                    type="button"
                    className="mt-1 text-xs font-semibold text-brand disabled:opacity-50"
                    disabled={pending}
                    onClick={() => onToggle("GALERIA", item.id, !item.visivel)}
                  >
                    {pending ? "Salvando…" : item.visivel ? "Ocultar" : "Exibir"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    );
  }
  if (tipo === "LOCALIZACAO") {
    const e = draft.endereco;
    return (
      <form onSubmit={onEndereco}>
        <Surface className="grid gap-3 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Localização</h2>
          <Field label="Logradouro">
            <Input
              value={e.logradouro ?? ""}
              onChange={(event) => setDraft((atual) => (atual ? { ...atual, endereco: { ...atual.endereco, logradouro: event.target.value } } : atual))}
            />
          </Field>
          <Field label="Número">
            <Input
              value={e.numero ?? ""}
              onChange={(event) => setDraft((atual) => (atual ? { ...atual, endereco: { ...atual.endereco, numero: event.target.value } } : atual))}
            />
          </Field>
          <Field label="Complemento">
            <Input
              value={e.complemento ?? ""}
              onChange={(event) => setDraft((atual) => (atual ? { ...atual, endereco: { ...atual.endereco, complemento: event.target.value } } : atual))}
            />
          </Field>
          <Field label="Bairro">
            <Input
              value={e.bairro ?? ""}
              onChange={(event) => setDraft((atual) => (atual ? { ...atual, endereco: { ...atual.endereco, bairro: event.target.value } } : atual))}
            />
          </Field>
          <Field label="Cidade">
            <Input
              value={e.cidade ?? ""}
              onChange={(event) => setDraft((atual) => (atual ? { ...atual, endereco: { ...atual.endereco, cidade: event.target.value } } : atual))}
            />
          </Field>
          <Field label="UF">
            <Input
              maxLength={2}
              value={e.uf ?? ""}
              onChange={(event) => setDraft((atual) => (atual ? { ...atual, endereco: { ...atual.endereco, uf: event.target.value } } : atual))}
            />
          </Field>
          <Field label="CEP">
            <Input
              value={e.cep ?? ""}
              onChange={(event) => setDraft((atual) => (atual ? { ...atual, endereco: { ...atual.endereco, cep: event.target.value } } : atual))}
            />
          </Field>
          <Field label="URL do Google Maps" hint="Cole o link ou o src de um iframe /embed.">
            <Input
              value={e.mapsUrl ?? ""}
              onChange={(event) => setDraft((atual) => (atual ? { ...atual, endereco: { ...atual.endereco, mapsUrl: event.target.value } } : atual))}
            />
          </Field>
          <Field label="Latitude" hint="Necessária para o tutor ver a distância em km.">
            <Input
              value={e.latitude ?? ""}
              onChange={(event) => setDraft((atual) => (atual ? { ...atual, endereco: { ...atual.endereco, latitude: event.target.value ? Number(event.target.value) : null } } : atual))}
            />
          </Field>
          <Field label="Longitude">
            <Input
              value={e.longitude ?? ""}
              onChange={(event) => setDraft((atual) => (atual ? { ...atual, endereco: { ...atual.endereco, longitude: event.target.value ? Number(event.target.value) : null } } : atual))}
            />
          </Field>
          {gpsErro ? <div className="sm:col-span-2"><ErrorState message={gpsErro} /></div> : null}
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              busy={gpsBusy}
              busyLabel="Lendo o GPS…"
              onClick={() => void usarLocalizacaoAtual()}
            >
              Usar localização deste aparelho
            </Button>
            <Button type="submit" busy={pending} busyLabel="Salvando…">
              Salvar localização
            </Button>
          </div>
        </Surface>
      </form>
    );
  }
  if (tipo === "CONTATO") {
    return (
      <form onSubmit={onContato}>
        <Surface className="grid gap-3">
          <h2 className="font-semibold">Contato</h2>
          <Field label="E-mail">
            <Input
              type="email"
              required
              value={draft.identidade.email ?? ""}
              onChange={(event) =>
                setDraft((atual) => (atual ? { ...atual, identidade: { ...atual.identidade, email: event.target.value } } : atual))
              }
            />
          </Field>
          <Field label="Telefone">
            <Input
              value={draft.identidade.telefone ?? ""}
              onChange={(event) =>
                setDraft((atual) => (atual ? { ...atual, identidade: { ...atual.identidade, telefone: event.target.value } } : atual))
              }
            />
          </Field>
          <p className="text-sm font-medium">Redes sociais</p>
          {draft.redes.map((rede, index) => (
            <div key={`${rede.tipoId}-${index}`} className="grid gap-2 sm:grid-cols-2">
              <Select
                value={rede.tipoId || ""}
                onChange={(event) =>
                  setDraft((atual) => {
                    if (!atual) return atual;
                    const tipoId = Number(event.target.value);
                    const nome = atual.tiposRede.find((item) => item.id === tipoId)?.nome ?? rede.nome;
                    return {
                      ...atual,
                      redes: atual.redes.map((item, i) => (i === index ? { ...item, tipoId, nome } : item)),
                    };
                  })
                }
              >
                <option value="">Tipo</option>
                {draft.tiposRede.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </Select>
              <Input
                value={rede.url}
                placeholder="https://"
                onChange={(event) =>
                  setDraft((atual) =>
                    atual
                      ? { ...atual, redes: atual.redes.map((item, i) => (i === index ? { ...item, url: event.target.value } : item)) }
                      : atual,
                  )
                }
              />
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={() => setDraft({ ...draft, redes: [...draft.redes, { tipoId: 0, nome: "", url: "" }] })}>
            + Rede
          </Button>
          <Button type="submit" busy={pending} busyLabel="Salvando…">
            Salvar contato
          </Button>
        </Surface>
      </form>
    );
  }
  if (tipo === "DOACOES") {
    return (
      <div className="grid gap-4">
        {!draft.permiteDoacoes ? (
          <Surface>
            <p className="font-semibold">Doações</p>
            <p className="mt-2 text-sm text-muted">O plano desta clínica não permite a seção de doações.</p>
          </Surface>
        ) : (
          <form onSubmit={onDoacao}>
            <Surface className="grid gap-3 sm:grid-cols-2">
              <h2 className="font-semibold sm:col-span-2">Nova campanha</h2>
              <div className="sm:col-span-2">
                <Field label="Título">
                  <Input required value={campanha.titulo} onChange={(event) => setCampanha({ ...campanha, titulo: event.target.value })} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Texto">
                  <Textarea value={campanha.texto} onChange={(event) => setCampanha({ ...campanha, texto: event.target.value })} />
                </Field>
              </div>
              <Field label="Meta (R$)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={campanha.metaValor}
                  onChange={(event) => setCampanha({ ...campanha, metaValor: event.target.value })}
                />
              </Field>
              <Field label="Início">
                <Input type="date" value={campanha.dataInicio} onChange={(event) => setCampanha({ ...campanha, dataInicio: event.target.value })} />
              </Field>
              <Field label="Fim">
                <Input type="date" value={campanha.dataFim} onChange={(event) => setCampanha({ ...campanha, dataFim: event.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <Button type="submit" busy={pending} busyLabel="Publicando…">
                  Publicar campanha
                </Button>
              </div>
            </Surface>
          </form>
        )}
        <ListaVisivel
          titulo="Campanhas"
          vazio="Nenhuma campanha cadastrada."
          itens={draft.doacoes.map((item) => ({ id: item.id, nome: item.titulo, visivel: item.visivelPagina }))}
          pending={pending}
          onToggle={(item) => onToggle("DOACAO", item.id, !item.visivel)}
        />
      </div>
    );
  }
  return null;
}

function ListaVisivel({
  titulo,
  vazio,
  hint,
  itens,
  pending,
  onToggle,
}: {
  titulo: string;
  vazio: string;
  hint?: string;
  itens: { id: number; nome: string; visivel: boolean; autorizado?: boolean | null }[];
  pending?: boolean;
  onToggle: (item: { id: number; nome: string; visivel: boolean }) => void;
}) {
  return (
    <Surface>
      <h2 className="font-semibold">{titulo}</h2>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {!itens.length ? (
        <p className="mt-3 text-sm text-muted">{vazio}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {itens.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <p className="text-sm font-medium">{item.nome}</p>
              <button
                type="button"
                className="text-sm font-semibold text-brand disabled:opacity-50"
                disabled={pending}
                onClick={() => onToggle(item)}
              >
                {pending ? "Salvando…" : item.visivel ? "Ocultar" : "Exibir"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
