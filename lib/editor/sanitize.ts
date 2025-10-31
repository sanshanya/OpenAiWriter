const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

const RELATIVE_PREFIXES = ["/", "#"];

const SPECIAL_PREFIXES = ["mailto:", "tel:"];

export function sanitizeHref(input: unknown): string | null {
  if (typeof input !== "string") return null;

  const candidate = input.trim();
  if (!candidate) return null;

  if (RELATIVE_PREFIXES.some((prefix) => candidate.startsWith(prefix))) {
    return candidate;
  }

  const lowerCandidate = candidate.toLowerCase();
  for (const prefix of SPECIAL_PREFIXES) {
    if (lowerCandidate.startsWith(prefix)) {
      return candidate;
    }
  }

  const hasScheme = /^[a-z][a-z0-9+\-.]*:/i.test(candidate);
  const normalized = hasScheme ? candidate : `https://${candidate}`;

  try {
    const url = new URL(normalized);
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

