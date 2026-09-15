function readEnv(key: keyof ImportMetaEnv, fallback: string): string {
  const value = import.meta.env[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

/** Valores públicos de apresentação. Preço oficial da contratação vem do backend. */
export const env = {
  apiUrl: readEnv("VITE_API_URL", ""),
  siteUrl: readEnv("VITE_SITE_URL", ""),
  appName: readEnv("VITE_APP_NAME", "Flutz"),
  companyName: readEnv("VITE_COMPANY_NAME", "UpVibe"),
  companyUrl: readEnv("VITE_COMPANY_URL", "https://www.upvibe.blog.br/"),
  contactEmail: readEnv("VITE_CONTACT_EMAIL", "contato@flutzclinicas.com.br"),
  dpoNome: readEnv("VITE_DPO_NOME", "UpVibe"),
  dpoEmail: readEnv("VITE_DPO_EMAIL", "privacy@flutzclinicas.com.br"),
  contactWhatsapp: readEnv("VITE_CONTACT_WHATSAPP", "62981451856"),
  instagramUrl: readEnv("VITE_INSTAGRAM_URL", "https://www.instagram.com/flutzclinicas/"),
  planos: {
    flutz: readEnv("VITE_PLANO_FLUTZ", "R$ 149,90/mês"),
  },
} as const;
