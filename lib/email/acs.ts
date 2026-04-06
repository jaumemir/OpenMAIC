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
  const contentHash = crypto
    .createHash('sha256')
    .update(bodyString, 'utf8')
    .digest('base64');

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
    throw new Error(
      "ACS_ENDPOINT i ACS_ACCESS_KEY han d'estar configurats per enviar emails.",
    );
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
}

export async function sendInvitationEmail(params: InvitationEmailParams): Promise<void> {
  const senderAddress = process.env.ACS_SENDER_ADDRESS;
  const senderDisplayName = process.env.ACS_SENDER_DISPLAY_NAME ?? 'OpenMAIC';

  if (!senderAddress) {
    throw new Error("ACS_SENDER_ADDRESS ha d'estar configurat.");
  }

  const subject = `${params.inviterName} t'ha convidat a OpenMAIC`;

  const html = buildInvitationHtml({
    displayName: params.displayName,
    inviterName: params.inviterName,
    acceptUrl: params.acceptUrl,
    expiresInHours: params.expiresInHours,
  });

  const plainText = buildInvitationPlainText({
    displayName: params.displayName,
    inviterName: params.inviterName,
    acceptUrl: params.acceptUrl,
    expiresInHours: params.expiresInHours,
  });

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

function buildInvitationHtml(vars: TemplateVars): string {
  return `<!DOCTYPE html>
<html lang="ca">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitació a OpenMAIC</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Capçalera -->
          <tr>
            <td style="background-color:#18181b;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">OpenMAIC</h1>
              <p style="margin:8px 0 0;color:#a1a1aa;font-size:13px;">Aula Interactiva amb IA</p>
            </td>
          </tr>

          <!-- Cos -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h2 style="margin:0 0 16px;color:#18181b;font-size:20px;font-weight:600;">Hola, ${escapeHtml(vars.displayName)}!</h2>
              <p style="margin:0 0 24px;color:#52525b;font-size:15px;line-height:1.6;">
                <strong>${escapeHtml(vars.inviterName)}</strong> t'ha convidat a unir-te a <strong>OpenMAIC</strong>,
                la plataforma d'aules interactives amb intel·ligència artificial.
              </p>
              <p style="margin:0 0 32px;color:#52525b;font-size:15px;line-height:1.6;">
                Clica el botó a continuació per completar el teu registre i activar el compte.
              </p>

              <!-- Botó CTA -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${vars.acceptUrl}"
                       style="display:inline-block;background-color:#18181b;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:6px;letter-spacing:0.2px;">
                      Acceptar invitació
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Avís TTL -->
              <p style="margin:32px 0 0;color:#a1a1aa;font-size:13px;text-align:center;">
                Aquest enllaç és vàlid durant ${vars.expiresInHours} hores.
              </p>
            </td>
          </tr>

          <!-- URL alternativa -->
          <tr>
            <td style="padding:0 40px 32px;">
              <div style="background-color:#f4f4f5;border-radius:6px;padding:16px;">
                <p style="margin:0 0 8px;color:#71717a;font-size:12px;">Si el botó no funciona, copia aquest URL al teu navegador:</p>
                <p style="margin:0;font-size:12px;word-break:break-all;">
                  <a href="${vars.acceptUrl}" style="color:#18181b;">${vars.acceptUrl}</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Peu -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f4f4f5;text-align:center;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;">
                Si no esperaves aquesta invitació, pots ignorar aquest missatge.
              </p>
              <p style="margin:8px 0 0;color:#a1a1aa;font-size:12px;">
                OpenMAIC — Plataforma open source sota llicència AGPL-3.0
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildInvitationPlainText(vars: TemplateVars): string {
  return `Hola, ${vars.displayName}!

${vars.inviterName} t'ha convidat a unir-te a OpenMAIC, la plataforma d'aules interactives amb IA.

Per completar el teu registre, accedeix a:
${vars.acceptUrl}

Aquest enllaç és vàlid durant ${vars.expiresInHours} hores.

Si no esperaves aquesta invitació, pots ignorar aquest missatge.

OpenMAIC — Plataforma open source sota llicència AGPL-3.0
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
