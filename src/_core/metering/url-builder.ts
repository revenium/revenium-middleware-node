export function buildReveniumUrl(baseUrl: string, endpoint: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");

  if (/\/meter\/v2$/i.test(normalizedBase)) {
    return `${normalizedBase}${endpoint}`;
  }

  if (/\/meter$/i.test(normalizedBase)) {
    return `${normalizedBase}/v2${endpoint}`;
  }

  if (/\/v2$/i.test(normalizedBase)) {
    return `${normalizedBase}${endpoint}`;
  }

  return `${normalizedBase}/meter/v2${endpoint}`;
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
