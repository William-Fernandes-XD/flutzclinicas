export type Perfil = {
  tipo: string;
  atorId: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  fotoUrl: string | null;
  permitirNotificacoes: boolean | null;
  nomeClinica: string | null;
  emailClinica: string | null;
  telefoneClinica: string | null;
  cidade: string | null;
  uf: string | null;
  logoUrl: string | null;
};
