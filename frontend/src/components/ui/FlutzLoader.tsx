import logoFull from "../../assets/logo-flutz.png";

type FlutzLoaderProps = {
  label?: string;
  /** Tela cheia (boot/sessão). Sem fade — some ao desmontar. */
  fullScreen?: boolean;
};

/**
 * Splash Flutz: logo grande + barra roxa animada.
 * Remova do React tree ao terminar o load (desaparece na hora).
 */
export function FlutzLoader({ label = "Carregando…", fullScreen = false }: FlutzLoaderProps) {
  return (
    <div
      className={
        fullScreen
          ? "fixed inset-0 z-[200] flex min-h-svh w-full flex-col items-center justify-center bg-[#fbf7ff] dark:bg-[#0f1115]"
          : "flex min-h-[14rem] w-full flex-col items-center justify-center py-10"
      }
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flutz-loader-glow pointer-events-none absolute inset-0 overflow-hidden" aria-hidden />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center px-6">
        <img
          src={logoFull}
          alt="Flutz"
          width={320}
          height={88}
          className="flutz-loader-logo select-none"
          draggable={false}
        />

        <div className="flutz-loader-track mt-10 w-full max-w-[14rem]">
          <div className="flutz-loader-bar" />
        </div>

        {label ? (
          <p className="mt-5 text-center text-sm font-medium tracking-wide text-[#6b5a86] dark:text-zinc-400">
            {label}
          </p>
        ) : null}
      </div>
    </div>
  );
}
