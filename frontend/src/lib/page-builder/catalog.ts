/**
 * Catálogo do Page Builder — seções oficiais e blocos prontos.
 * A persistência ainda usa o modelo relacional (pagina_secao + tabelas operacionais).
 * Este módulo prepara a UI de 3 áreas (biblioteca / canvas / propriedades).
 */

export type PageSectionTipo =
  | "HEADER"
  | "HERO"
  | "SOBRE"
  | "SERVICOS"
  | "ESPECIALIDADE"
  | "EQUIPE"
  | "DIFERENCIAIS"
  | "GALERIA"
  | "AVALIACOES"
  | "UNIDADES"
  | "FAQ"
  | "CTA"
  | "LOCALIZACAO"
  | "CONTATO"
  | "DOACOES"
  | "FOOTER";

/** Tipos já suportados pelo backend atual (CHECK + UNIQUE por clínica). */
export const SECTION_TIPOS_BACKEND = [
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
] as const satisfies readonly PageSectionTipo[];

export type SectionCatalogItem = {
  tipo: PageSectionTipo;
  label: string;
  descricao: string;
  categoria: "estrutura" | "conteudo" | "blocos";
  /** false = planejado; ainda não persiste no backend */
  disponivel: boolean;
};

export const SECTION_CATALOG: SectionCatalogItem[] = [
  { tipo: "HEADER", label: "Cabeçalho", descricao: "Logo, menu e CTA", categoria: "estrutura", disponivel: false },
  { tipo: "HERO", label: "Hero", descricao: "Título, texto, imagem e botões", categoria: "blocos", disponivel: true },
  { tipo: "SOBRE", label: "Sobre a clínica", descricao: "História e números", categoria: "blocos", disponivel: true },
  { tipo: "SERVICOS", label: "Nossos serviços", descricao: "Lista a partir do cadastro Flutz", categoria: "blocos", disponivel: true },
  { tipo: "ESPECIALIDADE", label: "Especialidades", descricao: "Áreas de atuação", categoria: "blocos", disponivel: true },
  { tipo: "EQUIPE", label: "Nossa equipe", descricao: "Profissionais autorizados", categoria: "blocos", disponivel: true },
  { tipo: "DIFERENCIAIS", label: "Diferenciais", descricao: "Por que escolher a clínica", categoria: "blocos", disponivel: false },
  { tipo: "GALERIA", label: "Galeria", descricao: "Fotos da estrutura", categoria: "blocos", disponivel: true },
  { tipo: "AVALIACOES", label: "Depoimentos", descricao: "Avaliações de tutores", categoria: "blocos", disponivel: true },
  { tipo: "UNIDADES", label: "Unidades", descricao: "Múltiplos endereços", categoria: "blocos", disponivel: false },
  { tipo: "FAQ", label: "FAQ", descricao: "Perguntas frequentes", categoria: "blocos", disponivel: false },
  { tipo: "CTA", label: "Chamada para ação", descricao: "Bloco final de conversão", categoria: "blocos", disponivel: false },
  { tipo: "LOCALIZACAO", label: "Localização", descricao: "Mapa e endereço", categoria: "blocos", disponivel: true },
  { tipo: "CONTATO", label: "Contato", descricao: "Telefone, e-mail e WhatsApp", categoria: "blocos", disponivel: true },
  { tipo: "DOACOES", label: "Campanhas", descricao: "Doações e arrecadações", categoria: "blocos", disponivel: true },
  { tipo: "FOOTER", label: "Rodapé", descricao: "Links, contato e redes", categoria: "estrutura", disponivel: false },
];

export const COLOR_PRESETS = [
  { id: "flutz", label: "Flutz", primary: "#7828C8", background: "#FFFFFF", text: "#2D3748" },
  { id: "clinico", label: "Clínico", primary: "#527A68", background: "#F7F8F7", text: "#1D2939" },
  { id: "corporativo", label: "Corporativo", primary: "#3D5A6C", background: "#F5F7F8", text: "#1D2939" },
  { id: "elegante", label: "Elegante", primary: "#5C5A58", background: "#F8F7F5", text: "#1C1917" },
  { id: "minimalista", label: "Minimalista", primary: "#344054", background: "#FCFCFD", text: "#101828" },
  { id: "pet-care", label: "Pet Care", primary: "#4F7C8A", background: "#F4F8F9", text: "#1D2939" },
] as const;

export type HeroVariant = "text-left" | "full-bleed" | "centered" | "text-right";

export const HERO_VARIANTS: { id: HeroVariant; label: string }[] = [
  { id: "text-left", label: "Texto à esquerda + imagem" },
  { id: "full-bleed", label: "Imagem de fundo + conteúdo central" },
  { id: "centered", label: "Texto central + imagem inferior" },
  { id: "text-right", label: "Imagem à esquerda + texto à direita" },
];
