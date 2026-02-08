import './BotLink.css';

interface BotLinkProps {
  botHostname: string;
  disabled?: boolean;
  token?: string;
}

export function BotLink({ botHostname, disabled, token }: BotLinkProps) {
  // Build subdomain URL: botHostname.currentDomain:currentPort
  const { hostname, port: dashPort, protocol } = window.location;
  const baseUrl = `${protocol}//${botHostname}.${hostname}${dashPort ? `:${dashPort}` : ''}/`;

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
