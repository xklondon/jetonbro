import { fail } from './errors.js';

export const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
export const DEFAULT_RESEND_FROM = 'JetonBro <beth.t@example.com>';

export interface MagicLinkMailer {
  send(input: { to: string; verifyPageUrl: string }): Promise<void>;
}

export interface ResendMailerOptions {
  apiKey: string;
  from?: string;
  fetchImpl?: typeof fetch;
}

export function mailerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): MagicLinkMailer | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return createResendMailer({
    apiKey,
    from: env.RESEND_FROM_EMAIL?.trim() || DEFAULT_RESEND_FROM,
    fetchImpl,
  });
}

export function createResendMailer(options: ResendMailerOptions): MagicLinkMailer {
  const from = options.from?.trim() || DEFAULT_RESEND_FROM;
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async send(input) {
      const res = await fetchImpl(RESEND_EMAILS_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: 'Your JetonBro sign-in link',
          html: magicLinkHtml(input.verifyPageUrl),
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        fail('MAIL_SEND_FAILED', detail || 'Resend rejected the magic-link email', 502);
      }
    },
  };
}

export function magicLinkHtml(verifyPageUrl: string): string {
  const safe = escapeHtml(verifyPageUrl);
  return `<p>Sign in to JetonBro:</p><p><a href="${safe}">${safe}</a></p><p>This link only signs you in after you confirm on the page. A mail scanner opening it does not create an account.</p>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
