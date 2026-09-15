const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function hostnameOf(value: string): string | null {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isRailwayInternalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "railway.internal" || host.endsWith(".railway.internal");
}

export function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname.toLowerCase());
}

/** Origins that must never appear in production redirects or invitation links. */
export function isBlockedOrigin(value: string, nodeEnv = process.env.NODE_ENV): boolean {
  const host = hostnameOf(value);
  if (!host) return true;
  if (isRailwayInternalHost(host)) return true;
  if (nodeEnv === "production" && isLocalHost(host)) return true;
  return false;
}

export function publicOrigin(requestOrigin?: string | null, nodeEnv = process.env.NODE_ENV): string {
  const env = process.env.AUTH_URL?.replace(/\/$/, "") ?? "";
  if (env && !isBlockedOrigin(env, nodeEnv)) {
    return env;
  }
  if (requestOrigin && !isBlockedOrigin(requestOrigin, nodeEnv)) {
    return requestOrigin.replace(/\/$/, "");
  }
  if (nodeEnv !== "production") {
    return (env || requestOrigin || "http://localhost:3000").replace(/\/$/, "");
  }
  if (env) return env;
  throw new Error("AUTH_URL must be a public origin in production.");
}

function asAppPath(pathWithSearch: string): string {
  if (!pathWithSearch.startsWith("/") || pathWithSearch.startsWith("//")) return "/";
  if (pathWithSearch === "/sign-in" || pathWithSearch.startsWith("/sign-in?")) return "/";
  return pathWithSearch || "/";
}

/**
 * Invitation callback URLs stay path-based (`/join/{token}`).
 * Foreign or blocked origins are reduced to a same-app path.
 */
export function safeCallbackPath(callbackUrl?: string | null): string {
  if (!callbackUrl) return "/";
  const trimmed = callbackUrl.trim();
  if (!trimmed) return "/";
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return asAppPath(trimmed);
  }
  try {
    const url = new URL(trimmed);
    const path = `${url.pathname}${url.search}${url.hash}` || "/";
    if (isRailwayInternalHost(url.hostname) || isLocalHost(url.hostname)) {
      return asAppPath(path);
    }
    const auth = process.env.AUTH_URL ? new URL(process.env.AUTH_URL).origin : null;
    if (auth && url.origin === auth) {
      return asAppPath(path);
    }
    if (url.pathname.startsWith("/join/") || url.pathname.startsWith("/tables/")) {
      return asAppPath(path);
    }
    return "/";
  } catch {
    return "/";
  }
}

export function resolveAuthRedirect(url: string, baseUrl: string, nodeEnv = process.env.NODE_ENV): string {
  const origin = publicOrigin(isBlockedOrigin(baseUrl, nodeEnv) ? undefined : baseUrl, nodeEnv);
  return `${origin}${safeCallbackPath(url)}`;
}

export function rewriteMagicLinkUrl(url: string, nodeEnv = process.env.NODE_ENV): string {
  try {
    const parsed = new URL(url);
    if (!isBlockedOrigin(parsed.origin, nodeEnv)) {
      return url;
    }
    const origin = publicOrigin(undefined, nodeEnv);
    return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

export function parseJoinDestination(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fromUrl = trimmed.match(/\/join\/([A-Za-z0-9_-]+)/);
  if (fromUrl) return `/join/${fromUrl[1]}`;
  if (/^[A-Za-z0-9_-]{8,}$/.test(trimmed)) return `/join/${trimmed}`;
  return null;
}

export function defaultTableName(displayName: string): string {
  const first = displayName.split("@")[0]?.trim() || "Player";
  return `${first}'s table`;
}

export function firstName(displayName: string): string {
  return displayName.split("@")[0]?.trim() || "Player";
}
