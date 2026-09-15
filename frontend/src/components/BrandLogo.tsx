import logoFull from "../assets/logo-flutz-sm.png";
import logoMark from "../assets/logo-mark.png";
import { env } from "../lib/env";

type BrandLogoProps = {
  compact?: boolean;
  className?: string;
};

export function BrandLogo({ compact = false, className = "" }: BrandLogoProps) {
  if (compact) {
    return (
      <span className={`flex min-w-0 items-center gap-2 ${className}`.trim()}>
        <img
          src={logoMark}
          alt=""
          width={32}
          height={32}
          className="brand-logo-mark shrink-0"
        />
        <span className="truncate text-base font-bold tracking-tight text-current sm:text-lg">
          {env.appName}
        </span>
      </span>
    );
  }

  return (
    <img
      src={logoFull}
      alt={`${env.appName} — Gestão completa para sua clínica veterinária`}
      width={160}
      height={44}
      className={`brand-logo-full ${className}`.trim()}
    />
  );
}
