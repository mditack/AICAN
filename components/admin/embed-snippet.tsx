'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Eye, EyeSlash } from '@phosphor-icons/react';

interface EmbedSnippetProps {
  scenarioId: string;
}

function buildSnippet(url: string) {
  return `<iframe\n  src="${url}"\n  allow="microphone"\n  style="width:100%;height:640px;border:0;border-radius:12px"\n></iframe>`;
}

// Extract the src attribute value from the snippet so the preview always
// reflects what the admin actually typed, not a stale computed value.
function extractSrc(text: string): string {
  const m = text.match(/src="([^"]+)"/);
  return m ? m[1] : '';
}

// Extract a CSS style attribute value so the preview iframe inherits any
// height or styling the admin edits.
function extractStyle(text: string): string {
  const m = text.match(/style="([^"]+)"/);
  return m ? m[1] : '';
}

export function EmbedSnippet({ scenarioId }: EmbedSnippetProps) {
  const [snippetText, setSnippetText] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  // Track whether the snippet has been manually edited so we don't clobber
  // the admin's changes when the origin resolves on first render.
  const initializedRef = useRef(false);

  useEffect(() => {
    const o = window.location.origin;
    if (!initializedRef.current) {
      setSnippetText(buildSnippet(`${o}/?scenario=${scenarioId}`));
      initializedRef.current = true;
    }
  }, [scenarioId]);

  const previewSrc = extractSrc(snippetText);
  const previewStyle = extractStyle(snippetText);

  // Keep height in sync with the preview iframe — parse it from the style
  // string so editing height:640px → height:400px actually resizes the preview.
  const heightMatch = previewStyle.match(/height:\s*(\d+(?:\.\d+)?(?:px|%|vh|em|rem)?)/);
  const previewHeight = heightMatch ? heightMatch[1] : '640px';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippetText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Not in a secure context; text remains selectable for manual copy.
    }
  };

  const lineCount = (snippetText.match(/\n/g)?.length ?? 0) + 1;

  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <label className="text-foreground text-sm font-medium">Embed Code</label>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="border-border text-foreground hover:bg-accent inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
        >
          {showPreview ? (
            <EyeSlash className="size-3.5" weight="bold" />
          ) : (
            <Eye className="size-3.5" weight="bold" />
          )}
          {showPreview ? 'Sembunyikan' : 'Pratinjau'}
        </button>
      </div>
      <p className="text-muted-foreground mb-3 text-sm">
        Tempel kode ini ke blok <span className="font-medium">Custom HTML</span> di post WordPress /
        LearnDash. Edit langsung untuk menyesuaikan ukuran atau tampilan — pratinjau akan mengikuti.
      </p>

      <div className="relative">
        <textarea
          value={snippetText}
          onChange={(e) => setSnippetText(e.target.value)}
          rows={lineCount}
          spellCheck={false}
          className="border-input bg-muted/40 text-foreground focus:border-ring focus:ring-ring/20 w-full resize-none rounded-lg border px-3 py-3 pr-16 font-mono text-xs leading-relaxed focus:ring-2 focus:outline-none"
        />
        <button
          type="button"
          onClick={copy}
          aria-label="Salin embed code"
          className="border-border bg-card text-foreground hover:bg-accent absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors"
        >
          {copied ? (
            <Check className="size-3.5 text-green-600" weight="bold" />
          ) : (
            <Copy className="size-3.5" weight="bold" />
          )}
          {copied ? 'Tersalin' : 'Salin'}
        </button>
      </div>

      {showPreview && previewSrc && (
        <div className="mt-4">
          <p className="text-muted-foreground mb-2 text-xs">
            Pratinjau inline — perubahan pada kode di atas langsung terlihat di sini
          </p>
          <iframe
            key={previewSrc}
            src={previewSrc}
            allow="microphone"
            title="Pratinjau embed skenario"
            className="border-border w-full rounded-xl border"
            style={{ height: previewHeight }}
          />
        </div>
      )}
    </div>
  );
}
