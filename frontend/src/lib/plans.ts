import { env } from "./env";

export type PlanId = "flutz";

export type Plan = {
  id: PlanId;
  name: string;
  description: string;
  price: string;
  highlighted: boolean;
  features: string[];
};

export const PLAN_IDS: readonly PlanId[] = ["flutz"];

export function isPlanId(value: string | null): value is PlanId {
  return value === "flutz";
}

export function getPlans(): Plan[] {
  return [
    {
      id: "flutz",
      name: "Flutz",
      description: "Gestão da clínica e acesso dos funcionários cadastrados — mensalidade única.",
      price: env.planos.flutz,
      highlighted: true,
      features: [
        "Gestão da clínica (empresa)",
        "Tutores, pets e equipe",
        "Agenda, atendimentos e vacinação",
        "Chat, página pública e avaliações",
        "Financeiro e recebimentos",
        "Acesso dos funcionários cadastrados",
      ],
    },
  ];
}

export function getPlanById(id: PlanId): Plan {
  return getPlans().find((plan) => plan.id === id) ?? getPlans()[0];
}

export type OfficialPlan = {
  codigo: string;
  nome: string;
  descricao: string;
  valorMensal: number | string;
  moeda: string;
};

export function mergeOfficialPrices(official: OfficialPlan[]): Plan[] {
  const byCode = new Map(official.map((row) => [row.codigo.toLowerCase(), row]));
  return getPlans().map((plan) => {
    const row = byCode.get(plan.id) ?? byCode.values().next().value;
    if (!row) return plan;
    return {
      ...plan,
      name: row.nome || plan.name,
      description: row.descricao || plan.description,
      price: formatMonthlyPrice(row.valorMensal, row.moeda),
    };
  });
}

function formatMonthlyPrice(value: number | string, currency: string): string {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return `${new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
  }).format(amount)}/mês`;
}
