import { Mail } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { env } from "../../lib/env";
import { BrandLogo } from "../BrandLogo";
import { WhatsAppIcon, toWhatsAppUrl } from "../icons/WhatsAppIcon";
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

function formatBrMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  return raw;
}

function toInstagramHandle(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\//g, "");
    return path ? `@${path}` : url;
  } catch {
    return url;
  }
}
