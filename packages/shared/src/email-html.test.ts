import { describe, expect, it } from "vitest";
import { encodeEmailHref, escapeHtml, renderEmailLink } from "./email-html";

describe("escapeHtml", () => {
  it("escapes characters that can alter HTML markup", () => {
    expect(escapeHtml(`Tom & Jerry <script>alert("x")</script>`)).toBe(
      "Tom &amp; Jerry &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });
});

describe("encodeEmailHref", () => {
  it("accepts http and https URLs", () => {
    expect(encodeEmailHref("https://www.facebook.com/marketplace/item/123")).toBe(
      "https://www.facebook.com/marketplace/item/123",
    );
  });

  it("rejects unsafe URL schemes", () => {
    expect(encodeEmailHref('javascript:alert("x")')).toBeNull();
    expect(encodeEmailHref("data:text/html,<script>alert(1)</script>")).toBeNull();
  });
});

describe("renderEmailLink", () => {
  it("renders a safe anchor tag", () => {
    expect(renderEmailLink("https://example.com/item/1", "Safe title")).toBe(
      '<a href="https://example.com/item/1">Safe title</a>',
    );
  });

  it("escapes malicious titles and drops unsafe hrefs", () => {
    expect(renderEmailLink('javascript:alert("x")', '<img src=x onerror=alert(1)>')).toBe(
      "&lt;img src=x onerror=alert(1)&gt;",
    );
  });
});
