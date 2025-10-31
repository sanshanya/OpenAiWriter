const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

const DOMAIN_RE =
  /^(?:[\p{L}\p{N}-]+\.)+[\p{L}]{2,}(?::\d{1,5})?(?:\/[\S]*)?$/u;

export function isLikelyUrl(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;

  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return true;
  if (/^[/#]/.test(trimmed)) return true;
  if (/\s/.test(trimmed)) return false;
  return DOMAIN_RE.test(trimmed);
}

export function sanitizeHref(raw: unknown): string | null {
  if (!isLikelyUrl(raw)) return null;
  const trimmed = (raw as string).trim();

  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (!ALLOWED_PROTOCOLS.has(url.protocol.toLowerCase())) return null;
      return url.href;
    } catch {
      return null;
    }
  }

  if (/^[/#]/.test(trimmed)) return trimmed;

  try {
    const url = new URL(`https://${trimmed}`);
    if (!ALLOWED_PROTOCOLS.has(url.protocol.toLowerCase())) return null;
    return url.href;
  } catch {
    return null;
  }
}
