import { resolveSpeciesIconId } from "./species-icons";

export type CatalogTipoPreset =
  | "especies"
  | "racas"
  | "vacinas"
  | "doencas"
  | "especialidades"
  | "tipos-servico";

export type CatalogPreset = {
  nome: string;
  /** Código de ícone (espécie ou tipo de serviço) */
  icone?: string;
  /** Nomes equivalentes já existentes (plataforma ou clínica) */
  aliases?: string[];
};

function n(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const CATALOG_PRESETS: Record<CatalogTipoPreset, CatalogPreset[]> = {
  especies: [
    { nome: "Cachorro", icone: "cao", aliases: ["cao", "cão", "canino"] },
    { nome: "Gato", icone: "gato", aliases: ["felino"] },
    { nome: "Ave", icone: "ave", aliases: ["passaro", "pássaro"] },
    { nome: "Peixe", icone: "peixe" },
    { nome: "Coelho", icone: "coelho" },
    { nome: "Tartaruga", icone: "tartaruga" },
    { nome: "Hamster", icone: "hamster" },
    { nome: "Cavalo", icone: "cavalo", aliases: ["equino"] },
    { nome: "Porco", icone: "porco", aliases: ["suíno", "suino"] },
    { nome: "Réptil", icone: "lagarto", aliases: ["lagarto", "iguana"] },
    { nome: "Furão", icone: "furão", aliases: ["furao"] },
    { nome: "Outro", icone: "outro", aliases: ["outros", "diversos"] },
  ],
  racas: [],
  vacinas: [
    { nome: "V8" },
    { nome: "V10" },
    { nome: "Antirrábica" },
    { nome: "Gripe canina (CI)" },
    { nome: "Giárdia" },
    { nome: "Leishmaniose" },
    { nome: "V3 felina" },
    { nome: "V4 felina" },
    { nome: "V5 felina" },
    { nome: "Leucemia felina (FeLV)" },
    { nome: "FIV" },
    { nome: "Traqueobronquite" },
    { nome: "Tosse dos canis" },
    { nome: "Dermatofitose" },
  ],
  doencas: [
    { nome: "Cinomose" },
    { nome: "Parvovirose" },
    { nome: "Raiva" },
    { nome: "Leptospirose" },
    { nome: "Hepatite infecciosa canina" },
    { nome: "Giardíase" },
    { nome: "Leishmaniose" },
    { nome: "Otite" },
    { nome: "Dermatite" },
    { nome: "Doença periodontal" },
    { nome: "Panleucopenia felina" },
    { nome: "Rinotraqueíte felina" },
    { nome: "Calicivirose" },
    { nome: "Leucemia felina (FeLV)" },
    { nome: "FIV" },
    { nome: "Piometra" },
    { nome: "Insuficiência renal" },
    { nome: "Diabetes" },
  ],
  especialidades: [
    { nome: "Clínica geral" },
    { nome: "Cirurgia" },
    { nome: "Dermatologia" },
    { nome: "Oftalmologia" },
    { nome: "Ortopedia" },
    { nome: "Cardiologia" },
    { nome: "Odontologia" },
    { nome: "Anestesiologia" },
    { nome: "Diagnóstico por imagem" },
    { nome: "Animais silvestres" },
    { nome: "Emergência e UTI" },
    { nome: "Nutrição" },
    { nome: "Acupuntura" },
    { nome: "Fisioterapia" },
    { nome: "Oncologia" },
  ],
  "tipos-servico": [
    { nome: "Consulta", icone: "consulta" },
    { nome: "Retorno", icone: "retorno" },
    { nome: "Vacinação", icone: "vacinacao" },
    { nome: "Cirurgia", icone: "cirurgia" },
    { nome: "Emergência", icone: "emergencia" },
    { nome: "Exame", icone: "exame" },
    { nome: "Banho e tosa", icone: "banho" },
    { nome: "Internação", icone: "internacao" },
    { nome: "Ultrassom", icone: "ultrassom" },
    { nome: "Raio-X", icone: "raiox" },
    { nome: "Castração", icone: "castracao" },
    { nome: "Check-up", icone: "checkup" },
    { nome: "Microchipagem", icone: "microchip" },
    { nome: "Coleta de exames", icone: "exame" },
    { nome: "Curativo", icone: "curativo" },
    { nome: "Aplicação de medicamento", icone: "medicacao" },
  ],
};

/** Sugestões de raça por espécie (ícone ou nome). */
export const RACA_PRESETS_POR_ESPECIE: Record<string, string[]> = {
  cao: ["SRD", "Labrador", "Poodle", "Bulldog", "Yorkshire", "Shih Tzu", "Golden Retriever", "Pastor Alemão", "Pinscher", "Beagle"],
  gato: ["SRD", "Siamês", "Persa", "Maine Coon", "Ragdoll", "Sphynx", "British Shorthair", "Angorá"],
  ave: ["Calopsita", "Periquito", "Papagaio", "Canário", "Agapornis", "Cacatua"],
  peixe: ["Betta", "Kinguios", "Tetra", "Acará", "Plati"],
  coelho: ["SRD", "Mini Lion", "Netherland Dwarf", "Angorá"],
  tartaruga: ["Tigre-d'água", "Jabuti", "Hermann"],
  hamster: ["Sírio", "Anão russo", "Roborovski"],
  cavalo: ["Quarto de Milha", "Mangalarga", "Crioulo", "SRD"],
  porco: ["Mini pig", "SRD"],
  lagarto: ["Iguana", "Gecko", "Dragão-barbudo"],
  furão: ["Doméstico"],
  outro: ["SRD"],
};

/**
 * Sugestões de nome de serviço oferecido, indexadas pelo tipo de serviço.
 * Chaves normalizadas (sem acento).
 */
export const SERVICO_PRESETS_POR_TIPO: Record<string, string[]> = {
  consulta: [
    "Consulta clínica geral",
    "Consulta felina",
    "Consulta geriátrica",
    "Consulta de filhote",
    "Consulta dermatológica",
    "Consulta ortopédica",
  ],
  retorno: ["Retorno clínico", "Retorno pós-cirúrgico", "Retorno de exames"],
  vacinacao: [
    "Vacinação V10",
    "Vacinação V8",
    "Vacinação antirrábica",
    "Vacinação felina V4/V5",
    "Reforço vacinal",
  ],
  cirurgia: [
    "Castração macho",
    "Castração fêmea",
    "Cirurgia de emergência",
    "Remoção de nódulo",
    "Cirurgia ortopédica",
  ],
  emergencia: ["Pronto atendimento", "Emergência 24h", "Estabilização"],
  exame: ["Hemograma", "Bioquímico", "Coleta de sangue", "Exame de fezes", "Exame de urina"],
  "banho e tosa": ["Banho", "Tosa higiênica", "Tosa completa", "Hidratação"],
  internacao: ["Internação diária", "Internação UTI", "Observação"],
  ultrassom: ["Ultrassom abdominal", "Ultrassom gestacional"],
  "raio-x": ["Raio-X simples", "Raio-X contrastado"],
  "raio x": ["Raio-X simples", "Raio-X contrastado"],
  castracao: ["Castração macho", "Castração fêmea", "Ovario-histerectomia"],
  "check-up": ["Check-up anual", "Check-up geriátrico", "Check-up pré-operatório"],
  microchipagem: ["Implante de microchip"],
  "coleta de exames": ["Coleta de sangue", "Coleta domiciliar"],
  curativo: ["Curativo simples", "Troca de bandagem"],
  "aplicacao de medicamento": ["Aplicação de medicação", "Medicação injetável"],
};

export function presetJaExiste(preset: CatalogPreset, existentes: { nome: string }[]): boolean {
  const keys = new Set([n(preset.nome), ...(preset.aliases ?? []).map(n)]);
  return existentes.some((item) => {
    const nome = n(item.nome.includes(" · ") ? item.nome.split(" · ").slice(-1)[0] : item.nome);
    return keys.has(nome);
  });
}

export function nomeJaExiste(nome: string, existentes: { nome: string }[]): boolean {
  const key = n(nome);
  return existentes.some((item) => {
    const atual = n(item.nome.includes(" · ") ? item.nome.split(" · ").slice(-1)[0] : item.nome);
    return atual === key;
  });
}

export function presetsDisponiveis(
  tipo: string,
  existentes: { nome: string }[],
): CatalogPreset[] {
  if (!(tipo in CATALOG_PRESETS)) return [];
  return CATALOG_PRESETS[tipo as CatalogTipoPreset].filter((p) => !presetJaExiste(p, existentes));
}

export function racasSugeridas(
  especieNome: string | null | undefined,
  existentes: { nome: string }[],
): string[] {
  const icon = resolveSpeciesIconId(null, especieNome);
  const lista = RACA_PRESETS_POR_ESPECIE[icon] ?? RACA_PRESETS_POR_ESPECIE.outro;
  return lista.filter((nome) => !nomeJaExiste(nome, existentes));
}

export function servicosSugeridosPorTipo(
  tipoNome: string | null | undefined,
  existentes: { nome: string }[],
): string[] {
  if (!tipoNome) return [];
  const key = n(tipoNome);
  const lista =
    SERVICO_PRESETS_POR_TIPO[key] ??
    Object.entries(SERVICO_PRESETS_POR_TIPO).find(([k]) => key.includes(k) || k.includes(key))?.[1] ??
    [];
  return lista.filter((nome) => !nomeJaExiste(nome, existentes));
}
