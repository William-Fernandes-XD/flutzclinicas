type MercadoPagoLogoProps = {
  className?: string;
  /** Só o iso (handshake no oval). */
  iconOnly?: boolean;
};

/** Logo Mercado Pago — asset oficial em /brands. */
export function MercadoPagoLogo({ className = "", iconOnly = false }: MercadoPagoLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`.trim()} aria-label="Mercado Pago">
      <img
        src="/brands/mercado-pago-handshake.png"
        alt=""
        width={44}
        height={28}
        className="h-7 w-auto shrink-0 object-contain sm:h-8"
        decoding="async"
      />
      {iconOnly ? null : (
        <span className="text-[1.05rem] font-semibold tracking-tight text-[#009EE3] sm:text-lg dark:text-[#4DB8EB]">
          mercado pago
        </span>
      )}
    </span>
  );
}

export function MercadoPagoMark({ className = "" }: { className?: string }) {
  return <MercadoPagoLogo iconOnly className={className} />;
}

export function MercadoPagoWordmark({ className = "" }: { className?: string }) {
  return <MercadoPagoLogo className={className} />;
}
