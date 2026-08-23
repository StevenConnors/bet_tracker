export function safeNext(value: unknown, fallback = "/") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "http://local");
    return url.origin === "http://local" ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch { return fallback; }
}
