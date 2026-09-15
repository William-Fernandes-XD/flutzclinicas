export type ClinicBrand = {
  id: number;
  nome: string;
  slug: string;
  logoUrl: string | null;
  cidade: string | null;
  uf: string | null;
  sobre: string | null;
  email: string | null;
  telefone: string | null;
};

export type Point = { rotulo: string; valor: number };

export type CatalogItem = {
  id: number;
  nome: string;
  daClinica?: boolean;
  icone?: string | null;
  ativo?: boolean | null;
};
