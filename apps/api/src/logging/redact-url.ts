/**
 * Public QR-menu URLs carry the table token in the PATH (`/public/menu/<token>/...`, `/m/<token>`). A token is a
 * bearer capability for that table, so it must never reach the logs. Replaces it with its first 4 characters.
 */
const TOKEN_IN_PATH = /(\/public\/menu\/)([A-Za-z0-9_-]{8,64})/;

export function redactUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  return url.replace(TOKEN_IN_PATH, (_m, prefix: string, token: string) => `${prefix}${token.slice(0, 4)}…`);
}
