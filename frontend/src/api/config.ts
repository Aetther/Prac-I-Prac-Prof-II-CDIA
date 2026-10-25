export function getApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
  // Normalize without trailing slash
  return baseUrl.replace(/\/+$/, "");
}

export function buildUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
