/**
 * Cloudflare Turnstile widget for bot protection.
 * Uses explicit rendering (recommended for SPAs): script loads with ?render=explicit,
 * then turnstile.render() is called when the container is mounted.
 * When siteKey is empty, renders nothing (verification skipped).
 * @see https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
 */
import { useEffect, useRef, useState } from "react";

const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        }
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

type Props = {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  theme?: "light" | "dark" | "auto";
  /** Scale factor for widget size (e.g. 0.7 = 30% smaller). Default 1. */
  scale?: number;
};

export function TurnstileWidget({ siteKey, onVerify, onExpire, theme = "auto", scale = 1 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!siteKey.trim()) return;

    const existing = document.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`);
    if (existing) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [siteKey]);

  useEffect(() => {
    if (!siteKey.trim() || !scriptLoaded || !containerRef.current || !window.turnstile) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme,
      callback: (token) => onVerifyRef.current(token),
      "expired-callback": () => onExpireRef.current?.(),
    });

    return () => {
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, scriptLoaded, theme]);

  if (!siteKey.trim()) return null;

  return (
    <div className="flex justify-center" style={scale !== 1 ? { transform: `scale(${scale})`, transformOrigin: "center center" } : undefined}>
      <div ref={containerRef} id="turnstile-container" aria-label="Cloudflare Turnstile verification" />
    </div>
  );
}
