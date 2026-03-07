import { Resend } from "resend";

let resendClient: Resend | null = null;

export function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || "alerts@my-allergy.app";
}

interface PaperForEmail {
  pmid: string;
  title: string;
  authors: string;
  journalName: string;
}

export function buildJournalAlertHtml(
  journalName: string,
  papers: PaperForEmail[],
  baseUrl: string,
): string {
  const paperRows = papers
    .map(
      (p) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb">
        <a href="${baseUrl}/paper/${p.pmid}" style="color:#1d4ed8;text-decoration:none;font-weight:600;font-size:14px">${p.title}</a>
        <div style="color:#6b7280;font-size:13px;margin-top:4px">${p.authors}</div>
      </td>
    </tr>`,
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
      <div style="background:#1e40af;padding:20px 24px">
        <h1 style="margin:0;color:#fff;font-size:18px">My Allergy</h1>
        <p style="margin:4px 0 0;color:#bfdbfe;font-size:14px">New papers in ${journalName}</p>
      </div>
      <table style="width:100%;border-collapse:collapse">
        ${paperRows}
      </table>
      <div style="padding:16px 24px;text-align:center">
        <a href="${baseUrl}" style="color:#6b7280;font-size:12px;text-decoration:none">My Allergy Portal</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function buildKeywordAlertHtml(
  keyword: string,
  papers: PaperForEmail[],
  baseUrl: string,
): string {
  const paperRows = papers
    .map(
      (p) => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb">
        <div style="margin-bottom:4px">
          <span style="display:inline-block;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600">${p.journalName}</span>
        </div>
        <a href="${baseUrl}/paper/${p.pmid}" style="color:#1d4ed8;text-decoration:none;font-weight:600;font-size:14px">${p.title}</a>
        <div style="color:#6b7280;font-size:13px;margin-top:4px">${p.authors}</div>
      </td>
    </tr>`,
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
      <div style="background:#7c3aed;padding:20px 24px">
        <h1 style="margin:0;color:#fff;font-size:18px">My Allergy</h1>
        <p style="margin:4px 0 0;color:#ddd6fe;font-size:14px">Keyword alert: &ldquo;${keyword}&rdquo;</p>
      </div>
      <table style="width:100%;border-collapse:collapse">
        ${paperRows}
      </table>
      <div style="padding:16px 24px;text-align:center">
        <a href="${baseUrl}" style="color:#6b7280;font-size:12px;text-decoration:none">My Allergy Portal</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}
