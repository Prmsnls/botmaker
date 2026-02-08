/**
 * Subdomain extraction utility for bot routing.
 *
 * Given baseDomain = "mydomain.com":
 *   "mybot.mydomain.com"     -> "mybot"
 *   "mybot.mydomain.com:443" -> "mybot"
 *   "mydomain.com"           -> null  (bare domain)
 *   "foo.bar.mydomain.com"   -> null  (multi-level subdomain)
 */

const HOSTNAME_RE = /^[a-z0-9-]{1,64}$/;

export function extractBotHostname(
  host: string | undefined,
  baseDomain: string,
): string | null {
  if (!host) return null;

  // Strip port if present
  const hostOnly = host.split(':')[0].toLowerCase();
  const baseLower = baseDomain.toLowerCase();

  const suffix = '.' + baseLower;
  if (!hostOnly.endsWith(suffix)) return null;

  const subdomain = hostOnly.slice(0, -suffix.length);

  // Reject bare domain, multi-level subdomains, or invalid hostnames
  if (!subdomain || subdomain.includes('.') || !HOSTNAME_RE.test(subdomain)) {
    return null;
  }

  return subdomain;
}
