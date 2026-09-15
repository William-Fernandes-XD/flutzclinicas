/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SITE_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_COMPANY_NAME: string;
  readonly VITE_COMPANY_URL: string;
  readonly VITE_CONTACT_EMAIL: string;
  readonly VITE_DPO_NOME: string;
  readonly VITE_DPO_EMAIL: string;
  readonly VITE_CONTACT_WHATSAPP: string;
  readonly VITE_INSTAGRAM_URL: string;
  readonly VITE_PLANO_FLUTZ: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  MercadoPago?: new (publicKey: string, options?: { locale?: string }) => {
    bricks: () => {
      create: (type: string, containerId: string, options: Record<string, unknown>) => Promise<{ unmount?: () => Promise<void> }>;
    };
  };
}
