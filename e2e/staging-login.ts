import { spawnSync } from "node:child_process";

const origin =
  process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "") ?? "https://jetbro-ii-web-production.up.railway.app";

function railway(command: string, env?: NodeJS.ProcessEnv) {
  return spawnSync(command, {
    encoding: "utf8",
    shell: true,
    windowsHide: true,
    env: env ? { ...process.env, ...env } : process.env,
  });
}

export async function requestStagingMagicLink(email: string) {
  const csrfRes = await fetch(`${origin}/api/auth/csrf`);
  const csrf = (await csrfRes.json()) as { csrfToken: string };
  const cookie = (csrfRes.headers.getSetCookie?.() ?? []).join("; ") || csrfRes.headers.get("set-cookie") || "";
  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email,
    callbackUrl: `${origin}/`,
    json: "true",
  });
  const sign = await fetch(`${origin}/api/auth/signin/email`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie },
    body,
    redirect: "manual",
  });
  if (sign.status >= 400) throw new Error(`staging sign-in failed: ${sign.status}`);
}

function parseJsonLine(stdout: string) {
  const line = stdout
    .trim()
    .split(/\r?\n/)
    .reverse()
    .find((entry) => entry.startsWith("{"));
  return line ? (JSON.parse(line) as { found?: boolean; url?: string }) : null;
}

export function currentMailId() {
  const result = railway(
    'railway logs --service "JetBro II Web" --latest --deployment --lines 40 --since 5m',
  );
  const matches = [...(result.stdout ?? "").matchAll(/magic-link delivered id=([0-9a-f-]+)/gi)];
  return matches.at(-1)?.[1] ?? null;
}

export async function waitForStagingMagicLink(previousId: string | null = null) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const id = currentMailId();
    if (id && id !== previousId) {
      const result = railway('railway run --service "JetBro II Web" -- node e2e/retrieve-magic-link.mjs', {
        RESEND_EMAIL_ID: id,
      });
      const payload = parseJsonLine(result.stdout ?? "");
      if (payload?.found && payload.url) return { url: payload.url, id };
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("staging magic link was not delivered");
}
