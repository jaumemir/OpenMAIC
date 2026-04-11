/**
 * acs.ts — Servei d'enviament d'email via Azure Communication Services.
 *
 * Autenticació: HMAC-SHA256 (REST API, sense SDK).
 * Patró idèntic a miniLMSCat (apps/api/src/services/email.ts).
 *
 * Variables d'entorn necessàries:
 *   ACS_ENDPOINT           — https://xxxx.communication.azure.com
 *   ACS_ACCESS_KEY         — clau base64 del recurs ACS
 *   ACS_SENDER_ADDRESS     — adreça "from" verificada a ACS
 *   ACS_SENDER_DISPLAY_NAME — nom visible al camp "from"
 */

import crypto from 'crypto';
import { translate, defaultLocale } from '@/lib/i18n';

// ── Tipus ──────────────────────────────────────────────────────────────────

interface AcsEmailRecipient {
  address: string;
  displayName?: string;
}

interface AcsEmailPayload {
  senderAddress: string;
  recipients: { to: AcsEmailRecipient[] };
  content: {
    subject: string;
    html: string;
    plainText?: string;
  };
}

// ── Helpers HMAC ───────────────────────────────────────────────────────────

function buildAcsHeaders(
  endpoint: string,
  accessKey: string,
  bodyString: string,
): Record<string, string> {
  const url = new URL('/emails:send?api-version=2023-03-31', endpoint);
  const host = url.hostname;
  const date = new Date().toUTCString();

  // SHA-256 del body (base64)
  const contentHash = crypto.createHash('sha256').update(bodyString, 'utf8').digest('base64');

  // String a signar: METHOD\npath?query\ndate;host;contentHash
  const stringToSign = `POST\n${url.pathname}${url.search}\n${date};${host};${contentHash}`;

  // Clau ACS decodificada de base64
  const keyBuffer = Buffer.from(accessKey, 'base64');
  const signature = crypto
    .createHmac('sha256', keyBuffer)
    .update(stringToSign, 'utf8')
    .digest('base64');

  return {
    'Content-Type': 'application/json',
    'x-ms-date': date,
    'x-ms-content-sha256': contentHash,
    Authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
    'repeatability-request-id': crypto.randomUUID(),
    'repeatability-first-sent': date,
  };
}

// ── Funció principal d'enviament ───────────────────────────────────────────

export async function sendEmail(payload: AcsEmailPayload): Promise<void> {
  const endpoint = process.env.ACS_ENDPOINT;
  const accessKey = process.env.ACS_ACCESS_KEY;

  if (!endpoint || !accessKey) {
    throw new Error("ACS_ENDPOINT i ACS_ACCESS_KEY han d'estar configurats per enviar emails.");
  }

  const url = `${endpoint}/emails:send?api-version=2023-03-31`;
  const body = JSON.stringify(payload);
  const headers = buildAcsHeaders(endpoint, accessKey, body);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  // ACS retorna 202 Accepted en èxit
  if (response.status !== 202) {
    const text = await response.text().catch(() => '(sense cos)');
    throw new Error(`ACS retornat ${response.status}: ${text}`);
  }
}

// ── Template: email d'invitació ────────────────────────────────────────────

export interface InvitationEmailParams {
  to: string;
  displayName: string;
  inviterName: string;
  acceptUrl: string;
  expiresInHours: number;
  locale?: string;
}

export async function sendInvitationEmail(params: InvitationEmailParams): Promise<void> {
  const senderAddress = process.env.ACS_SENDER_ADDRESS;
  const senderDisplayName = process.env.ACS_SENDER_DISPLAY_NAME ?? 'OpenMAIC';

  if (!senderAddress) {
    throw new Error("ACS_SENDER_ADDRESS ha d'estar configurat.");
  }

  const locale = params.locale ?? defaultLocale;
  const t = (key: string, opts?: Record<string, string>) => translate(locale, key, opts);

  const subject = t('email.invitation.subject', { inviterName: params.inviterName });

  const templateVars = {
    displayName: params.displayName,
    inviterName: params.inviterName,
    acceptUrl: params.acceptUrl,
    expiresInHours: params.expiresInHours,
  };

  const html = buildInvitationHtml(templateVars, t, locale);
  const plainText = buildInvitationPlainText(templateVars, t);

  await sendEmail({
    senderAddress,
    recipients: {
      to: [{ address: params.to, displayName: params.displayName }],
    },
    content: {
      subject,
      html,
      plainText,
    },
  });
}

// ── HTML del template d'invitació ──────────────────────────────────────────

interface TemplateVars {
  displayName: string;
  inviterName: string;
  acceptUrl: string;
  expiresInHours: number;
}

type TFn = (key: string, opts?: Record<string, string>) => string;

function buildInvitationHtml(vars: TemplateVars, t: TFn, locale: string): string {
  const htmlLang = locale === 'zh-CN' ? 'zh-CN' : locale.startsWith('en') ? 'en' : 'ca';
  const hours = String(vars.expiresInHours);
  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenMAIC</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:#18181b;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">OpenMAIC</h1>
              <p style="margin:8px 0 0;color:#a1a1aa;font-size:13px;">${t('email.invitation.subtitle')}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;font-weight:600;">${t('email.invitation.greeting', { displayName: escapeHtml(vars.displayName) })}</h2>
              <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
                ${t('email.invitation.body1', { inviterName: escapeHtml(vars.inviterName) })}
              </p>
              <p style="margin:0 0 32px;color:#52525b;font-size:15px;line-height:1.6;">
                ${t('email.invitation.body2')}
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${vars.acceptUrl}"
                       style="display:inline-block;background-color:#18181b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:6px;letter-spacing:0.2px;">
                      ${t('email.invitation.cta')}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- TTL notice -->
              <p style="margin:32px 0 0;color:#a1a1aa;font-size:13px;text-align:center;">
                ${t('email.invitation.ttlNotice', { hours })}
              </p>
            </td>
          </tr>

          <!-- Fallback URL -->
          <tr>
            <td style="padding:0 40px 32px;">
              <div style="background-color:#f4f4f5;border-radius:6px;padding:16px;">
                <p style="margin:0 0 8px;color:#71717a;font-size:12px;">${t('email.common.urlFallbackLabel')}</p>
                <p style="margin:0;font-size:12px;word-break:break-all;">
                  <a href="${vars.acceptUrl}" style="color:#18181b;">${vars.acceptUrl}</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f4f4f5;text-align:center;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;">${t('email.invitation.ignore')}</p>
              <p style="margin:8px 0 0;color:#a1a1aa;font-size:12px;">${t('email.common.footer')}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildInvitationPlainText(vars: TemplateVars, t: TFn): string {
  const hours = String(vars.expiresInHours);
  return `${t('email.invitation.greeting', { displayName: vars.displayName })}

${t('email.invitation.plainBody', { inviterName: vars.inviterName })}

${t('email.invitation.plainCta')}
${vars.acceptUrl}

${t('email.invitation.ttlNotice', { hours })}

${t('email.invitation.ignore')}

${t('email.common.footer')}
`;
}

// Escapa caràcters HTML perillosos (evita XSS al template d'email)
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Email de recuperació de contrasenya ────────────────────────────────────

export interface PasswordResetEmailParams {
  to: string;
  firstName: string;
  resetUrl: string;
  expiresInHours: number;
  locale?: string;
}

export async function sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<void> {
  const senderAddress = process.env.ACS_SENDER_ADDRESS;

  if (!senderAddress) {
    throw new Error("ACS_SENDER_ADDRESS ha d'estar configurat.");
  }

  const locale = params.locale ?? defaultLocale;
  const t = (key: string, opts?: Record<string, string>) => translate(locale, key, opts);
  const htmlLang = locale === 'zh-CN' ? 'zh-CN' : locale.startsWith('en') ? 'en' : 'ca';
  const hours = String(params.expiresInHours);
  const firstName = escapeHtml(params.firstName);
  const resetUrl = escapeHtml(params.resetUrl);

  const html = `<!DOCTYPE html>
<html lang="${htmlLang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f9f9f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #f4f4f5;">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#18181b;">OpenMAIC</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px 24px;">
              <p style="margin:0 0 16px;font-size:16px;color:#18181b;">${t('email.passwordReset.greeting', { firstName })}</p>
              <p style="margin:0 0 24px;font-size:14px;color:#71717a;line-height:1.6;">
                ${t('email.passwordReset.body')}
              </p>
              <p style="margin:0 0 32px;text-align:center;">
                <a href="${resetUrl}"
                   style="display:inline-block;background-color:#18181b;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:500;">
                  ${t('email.passwordReset.cta')}
                </a>
              </p>
              <p style="margin:0;font-size:13px;color:#a1a1aa;">
                ${t('email.passwordReset.ttlNotice', { hours })}
              </p>
            </td>
          </tr>

          <!-- Fallback URL -->
          <tr>
            <td style="padding:0 40px 32px;">
              <div style="background-color:#f4f4f5;border-radius:6px;padding:16px;">
                <p style="margin:0 0 8px;color:#71717a;font-size:12px;">${t('email.common.urlFallbackLabel')}</p>
                <p style="margin:0;font-size:12px;word-break:break-all;">
                  <a href="${resetUrl}" style="color:#18181b;">${resetUrl}</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f4f4f5;text-align:center;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;">${t('email.passwordReset.ignore')}</p>
              <p style="margin:8px 0 0;color:#a1a1aa;font-size:12px;">${t('email.common.footer')}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const plainText = `${t('email.passwordReset.greeting', { firstName: params.firstName })}

${t('email.passwordReset.body')}

${t('email.passwordReset.plainCta')}
${params.resetUrl}

${t('email.passwordReset.ttlNotice', { hours })}

${t('email.passwordReset.ignore')}

${t('email.common.footer')}
`;

  await sendEmail({
    senderAddress,
    recipients: {
      to: [{ address: params.to, displayName: params.firstName }],
    },
    content: {
      subject: t('email.passwordReset.subject'),
      html,
      plainText,
    },
  });
}
