import { Mail } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { env } from "../../lib/env";
import { BrandLogo } from "../BrandLogo";
import { PageContainer } from "./PageContainer";

const NAV = [
  { href: "/#para-voce", label: "Para você" },
  { href: "/#recursos", label: "Recursos" },
  { href: "/#beneficios", label: "Benefícios" },
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#faq", label: "FAQ" },
  { to: "/privacidade", label: "Privacidade" },
  { to: "/termos", label: "Termos" },
  { to: "/login", label: "Entrar" },
] as const;

type FooterProps = {
  productName?: string;
  year?: number;
  companyName?: string;
  companyUrl?: string;
};

export function Footer({
  productName = env.appName,
  year = 2026,
  companyName = env.companyName,
  companyUrl = env.companyUrl,
}: FooterProps) {
  const whatsappHref = toWhatsAppUrl(env.contactWhatsapp);
  const whatsappLabel = formatBrMobile(env.contactWhatsapp);
  const instagramHandle = toInstagramHandle(env.instagramUrl);

  return (
    <footer className="w-full min-w-0 bg-[#0b0712] text-white">
      <PageContainer className="grid grid-cols-1 gap-10 py-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-16 lg:py-16">
        <div className="min-w-0">
          <Link to="/" className="inline-flex text-white">
            <BrandLogo compact />
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-400">
            Gestão para clínicas veterinárias — e um caminho para o tutor encontrar a clínica.
          </p>
        </div>

        <nav className="min-w-0" aria-label="Rodapé">
          <ul className="flex flex-col gap-3">
            {NAV.map((item) => (
              <li key={item.label}>
                {"to" in item ? (
                  <Link to={item.to} className="text-sm font-medium text-white transition-colors hover:text-purple-300">
                    {item.label}
                  </Link>
                ) : (
                  <a href={item.href} className="text-sm font-medium text-white transition-colors hover:text-purple-300">
                    {item.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 sm:col-span-2 lg:col-span-1">
          <p className="text-base font-semibold text-white">Fale com a gente</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
            E-mail, WhatsApp e Instagram — o jeito mais rápido de falar com o Flutz.
          </p>
          <ul className="mt-6 flex flex-col gap-5">
            <ContactRow
              icon={<Mail className="size-4" />}
              label="E-mail"
              value={env.contactEmail}
              href={`mailto:${env.contactEmail}`}
            />
            <ContactRow
              icon={<WhatsAppIcon />}
              label="WhatsApp"
              value={whatsappLabel}
              href={whatsappHref}
            />
            <ContactRow
              icon={<InstagramIcon />}
              label="Instagram"
              value={instagramHandle}
              href={env.instagramUrl}
            />
          </ul>
        </div>
      </PageContainer>

      <div className="border-t border-white/10">
        <PageContainer className="flex flex-col gap-2 py-5 text-sm text-zinc-500 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="min-w-0 break-words">
            © {year} {productName}. Todos os direitos reservados.
          </p>
          <p className="min-w-0 break-words">
            Desenvolvido por{" "}
            <a
              href={companyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium break-all text-purple-300 hover:underline"
            >
              {companyName}
            </a>
          </p>
        </PageContainer>
      </div>
    </footer>
  );
}

function ContactRow({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href: string;
}) {
  const external = href.startsWith("http");

  return (
    <li className="flex min-w-0 items-start gap-3">
      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/20 text-purple-300">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{label}</p>
        <a
          href={href}
          className="mt-0.5 block text-sm break-all text-zinc-400 transition-colors hover:text-purple-300"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {value}
        </a>
      </div>
    </li>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
      <path d="M8 2h8a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6V8a6 6 0 0 1 6-6Zm0 2a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4H8Zm9.5 1.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
      <path d="M20.52 3.48A11.78 11.78 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.96L0 24l6.3-1.65a11.86 11.86 0 0 0 5.76 1.47h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.16-3.45-8.44ZM12.07 21.15h-.01a9.86 9.86 0 0 1-5.02-1.38l-.36-.21-3.74.98 1-3.64-.24-.37a9.82 9.82 0 0 1-1.5-5.24c0-5.43 4.42-9.85 9.86-9.85 2.63 0 5.1 1.03 6.96 2.89a9.79 9.79 0 0 1 2.88 6.96c0 5.43-4.42 9.86-9.83 9.86Zm5.4-7.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47a8.9 8.9 0 0 1-1.65-2.05c-.17-.3 0-.46.13-.6.13-.13.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35Z" />
    </svg>
  );
}

function formatBrMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  return raw;
}

function toWhatsAppUrl(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

function toInstagramHandle(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\//g, "");
    return path ? `@${path}` : url;
  } catch {
    return url;
  }
}
