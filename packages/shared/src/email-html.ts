const HTML_ESCAPE_PATTERN = /[&<>"']/g;

const HTML_ESCAPE_REPLACEMENTS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(HTML_ESCAPE_PATTERN, (character) => HTML_ESCAPE_REPLACEMENTS[character] ?? character);
}

export function encodeEmailHref(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

export function renderEmailLink(url: string, label: string): string {
  const safeHref = encodeEmailHref(url);
  const safeLabel = escapeHtml(label);

  if (!safeHref) {
    return safeLabel;
  }

  return `<a href="${escapeHtml(safeHref)}">${safeLabel}</a>`;
}
