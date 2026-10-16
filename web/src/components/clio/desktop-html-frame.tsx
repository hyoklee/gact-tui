import { useRef } from 'react';
import { useConnectionSettings } from '@/providers/connection-provider';

/** A network document has its own policy; srcdoc would inherit Desktop's CSP. */
export function DesktopHtmlFrame({ name, html }: { name: string; html: string }) {
  const { settings } = useConnectionSettings();
  const url = `${settings.endpoint.replace(/\/+$/u, '')}/v1/html-renderer`;
  return <HtmlRendererFrame name={name} html={html} url={url} />;
}

export function HtmlRendererFrame({
  name,
  html,
  url,
}: {
  name: string;
  html: string;
  url: string;
}) {
  const delivered = useRef(false);
  return (
    <iframe
      className="min-h-0 w-full flex-1 border-0 bg-white"
      title={`HTML preview of ${name}`}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      src={url}
      onLoad={(event) => {
        if (delivered.current) return;
        delivered.current = true;
        event.currentTarget.contentWindow?.postMessage({ type: 'clio.html-preview', html }, '*');
      }}
    />
  );
}
