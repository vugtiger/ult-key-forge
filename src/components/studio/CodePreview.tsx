import { useEffect, useRef } from "react";

interface PreviewProps {
  language: string;
  code: string;
}

export const CodePreview = ({ language, code }: PreviewProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current) return;
    const lang = language.toLowerCase();
    let doc = "";

    if (lang === "html") {
      doc = code;
    } else if (lang === "css") {
      doc = `<!DOCTYPE html><html><head><style>${code}</style></head><body><div class="demo">Sample content<button>Button</button><p>Paragraph</p></div></body></html>`;
    } else if (lang === "javascript" || lang === "js") {
      doc = `<!DOCTYPE html><html><head><style>body{font-family:system-ui;padding:1rem;background:#0f1828;color:#e2e8f0}#out{white-space:pre-wrap;font-family:monospace;background:#1a2332;padding:0.75rem;border-radius:6px;border:1px solid #2d3a52}</style></head><body><div id="out"></div><script>
        const out = document.getElementById('out');
        const log = (...a) => { out.textContent += a.map(x => typeof x==='object'?JSON.stringify(x,null,2):String(x)).join(' ') + '\\n'; };
        const orig = console.log; console.log = (...a) => { log(...a); orig(...a); };
        try { ${code} } catch(e) { out.textContent += '[Error] ' + e.message; }
      </script></body></html>`;
    } else {
      doc = `<!DOCTYPE html><html><body style="font-family:system-ui;padding:1rem;background:#0f1828;color:#94a3b8;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center"><div><div style="font-size:14px;margin-bottom:8px">Live preview not available for ${language}</div><div style="font-size:12px;opacity:0.7">Lua UI scripts auto-render in the UI Designer tab</div></div></body></html>`;
    }

    iframeRef.current.srcdoc = doc;
  }, [language, code]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts"
      className="w-full h-full border-0 bg-white"
      title="Code preview"
    />
  );
};
