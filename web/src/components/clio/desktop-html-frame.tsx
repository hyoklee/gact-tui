import { useEffect, useRef, useState } from 'react';
import { useConnectionSettings } from '@/providers/connection-provider';
import { ResourceUnavailable } from './resource-states';

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
  const frame = useRef<HTMLIFrameElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setFailed(true), 10_000);
    const ready = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.data?.type !== 'clio.html-preview.ready'
      ) return;
      window.clearTimeout(timer);
    };
    window.addEventListener('message', ready);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('message', ready);
    };
  }, []);
  if (failed) return (
    <ResourceUnavailable
      label="Interactive preview did not respond"
      detail="Use Restart to try again, or open the file in your browser. Update the connected CLIO if it does not support interactive previews."
    />
  );
  return (
    <iframe
      ref={frame}
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
