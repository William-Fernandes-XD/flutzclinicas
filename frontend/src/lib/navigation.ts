import type { NavigateFunction } from "react-router-dom";

export function canGoBackSafely(): boolean {
  if (window.history.length <= 1 || !document.referrer) {
    return false;
  }

  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function goBackOrHome(navigate: NavigateFunction): void {
  if (canGoBackSafely()) {
    navigate(-1);
    return;
  }

  navigate("/");
}
