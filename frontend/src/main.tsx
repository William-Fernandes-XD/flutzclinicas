import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "./providers/AuthProvider.tsx";
import { ClinicProvider } from "./providers/ClinicContext.tsx";
import { ThemeProvider } from "./providers/ThemeProvider.tsx";
import { ToastProvider } from "./providers/ToastProvider.tsx";

// Phase 1 uses Motion only (no GSAP, Anime.js or Vivus) for subtle,
// reduced-motion-aware transitions on the commercial site.

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <ClinicProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </ClinicProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
