import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Button } from "./ui/Button";

const STORAGE_KEY = "cookie_consent";
const ACCEPTED = "accepted";

function hasConsent(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === ACCEPTED;
  } catch {
    return false;
  }
}

export function CookieBanner() {
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(() => !hasConsent());

  function accept(): void {
    try {
      localStorage.setItem(STORAGE_KEY, ACCEPTED);
    } catch {
      /* preferência local; o banner some nesta sessão mesmo se o storage falhar */
    }
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          role="dialog"
          aria-labelledby="cookie-banner-title"
          aria-describedby="cookie-banner-description"
          aria-live="polite"
          className="fixed inset-x-0 bottom-0 z-50 w-full min-w-0 p-4 sm:p-6"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-4 rounded-2xl border border-line bg-white p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="min-w-0 max-w-2xl">
              <p id="cookie-banner-title" className="font-semibold text-ink dark:text-white">
                Utilizamos cookies
              </p>
              <p
                id="cookie-banner-description"
                className="mt-1 text-sm leading-relaxed text-muted dark:text-zinc-400"
              >
                Usamos cookies estritamente necessários para o funcionamento da plataforma.
              </p>
            </div>
            <Button onClick={accept} className="w-full shrink-0 sm:w-auto">
              Entendi
            </Button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
