import './BotLink.css';

interface BotLinkProps {
  port: number;
  hostname?: string;
  disabled?: boolean;
  token?: string;
}

/**
 * Get the LAN IP from current page URL.
 * Falls back to provided hostname or window.location.hostname.
 */
function getLanHost(fallback?: string): string {
  const host = window.location.hostname;
  // If we're on a LAN IP, use it
  if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(host)) {
    return host;
  }
  // If we have a fallback, use it
  if (fallback) {
    return fallback;
  }
  // Otherwise use whatever hostname we're on
  return host;
}

export function BotLink({ port, hostname, disabled, token }: BotLinkProps) {
  const host = getLanHost(hostname);

  // Use port-based URL (works without reverse proxy setup)
  const baseUrl = `http://${host}:${port}/`;

  const url = token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl;

  if (disabled) {
    return (
      <div className="bot-link">
        <div className="bot-link-label">Control Panel</div>
        <div className="bot-link-url bot-link-url--disabled">
          <span className="bot-link-spinner" />
          <span className="bot-link-text">Starting...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bot-link">
      <div className="bot-link-label">Control Panel</div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="bot-link-url"
      >
        <span className="bot-link-icon">↗</span>
        <span className="bot-link-text">{url}</span>
      </a>
    </div>
  );
}
