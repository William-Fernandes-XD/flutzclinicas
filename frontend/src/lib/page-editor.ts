import type { ClinicBrand } from "../types/api";
import type { PageAddress, PageEditor, PageGalleryItem, PageHero, PageSection } from "../services/api";

const TIPOS_SECAO = [
  "HERO",
  "SOBRE",
  "SERVICOS",
  "ESPECIALIDADE",
  "EQUIPE",
  "AVALIACOES",
  "GALERIA",
  "LOCALIZACAO",
  "CONTATO",
  "DOACOES",
] as const;

const EMPTY_ADDRESS: PageAddress = {
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
};

export function normalizePageEditor(raw: Partial<PageEditor> | null | undefined, clinic?: ClinicBrand | null): PageEditor {
  const identidade = raw?.identidade;
  return {
    secoes: secoesOficiais(raw?.secoes),
    identidade: {
      nome: identidade?.nome || clinic?.nome || "Clínica",
      slug: identidade?.slug || clinic?.slug || "",
      logoUrl: identidade?.logoUrl ?? clinic?.logoUrl ?? null,
      sobre: identidade?.sobre ?? clinic?.sobre ?? null,
      email: identidade?.email ?? clinic?.email ?? null,
      telefone: identidade?.telefone ?? clinic?.telefone ?? null,
    },
    endereco: { ...EMPTY_ADDRESS, ...raw?.endereco },
    hero: normalizeHero(raw?.hero),
    servicos: raw?.servicos ?? [],
    especialidades: raw?.especialidades ?? [],
    equipe: raw?.equipe ?? [],
    avaliacoes: raw?.avaliacoes ?? [],
    galeria: normalizeGaleria(raw?.galeria),
    doacoes: raw?.doacoes ?? [],
    redes: raw?.redes ?? [],
    posicoes: raw?.posicoes ?? [],
    tiposRede: raw?.tiposRede ?? [],
    permiteDoacoes: Boolean(raw?.permiteDoacoes),
  };
}

export function emptyHero(nome: string): PageHero {
  return {
    titulo: nome,
    subtitulo: null,
    texto: null,
    imagemFundoUrl: null,
    imagemPosicaoId: null,
    posicao: "centro",
    topicos: [],
  };
}

export function ensureHero(draft: PageEditor): PageHero {
  return draft.hero ?? emptyHero(draft.identidade.nome);
}

export function patchHero(draft: PageEditor, patch: Partial<PageHero>): PageEditor {
  const hero = { ...ensureHero(draft), ...patch };
  if (patch.imagemPosicaoId !== undefined) {
    const nome = draft.posicoes.find((item) => item.id === patch.imagemPosicaoId)?.nome;
    hero.posicao = nome ?? (patch.imagemPosicaoId == null ? "centro" : hero.posicao);
  }
  return { ...draft, hero };
}

function secoesOficiais(secoes: PageSection[] | undefined): PageSection[] {
  if (secoes?.length) return secoes;
  return TIPOS_SECAO.map((tipo, index) => ({ tipo, ordem: index + 1, visivel: tipo !== "DOACOES" }));
}

function normalizeHero(hero: PageHero | null | undefined): PageHero | null {
  if (!hero) return null;
  return { ...hero, topicos: hero.topicos ?? [] };
}

function normalizeGaleria(items: PageEditor["galeria"] | string[] | undefined): PageGalleryItem[] {
  if (!items) return [];
  return items.map((item, index) => {
    if (typeof item === "string") {
      return { id: index + 1, url: item, alt: null, ordem: index + 1, visivel: true };
    }
    return item;
  });
}
