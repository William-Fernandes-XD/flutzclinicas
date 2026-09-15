const VERSION = "v1";

function key(name: string, userId: number): string {
  return `flutz:${VERSION}:u${userId}:${name}`;
}

export function readLastClinic(userId: number): number | null {
  try {
    const raw = localStorage.getItem(key("lastClinic", userId));
    if (!raw) return null;
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

export function writeLastClinic(userId: number, clinicId: number): void {
  try {
    localStorage.setItem(key("lastClinic", userId), String(clinicId));
  } catch {
    /* preferência indisponível */
  }
}

export function clearLastClinic(userId: number): void {
  try {
    localStorage.removeItem(key("lastClinic", userId));
  } catch {
    /* ignore */
  }
}
