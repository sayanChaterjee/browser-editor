/**
 * Builds the document shown in a preview iframe from a project's HTML, CSS and JS.
 *
 * The user's markup is often mid-edit (an unfinished `<p` or `<!--`), so nothing of ours is
 * placed after it: anything there could be swallowed by the broken tag and shown as text.
 * Our styles and scripts go at the very start of <head>, and the user's JavaScript is
 * embedded as an escaped string that runs once the page has parsed.
 */

const BASE_STYLES = `body { margin: 0; padding: 16px; font-family: sans-serif; background-color: white; color: black; }`;

// U+2028/U+2029 end a line in older JS parsers; built with fromCharCode so the source stays ASCII
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

/** A JS string literal that is safe inside <script> (no "</script>" or line separators). */
const scriptString = (value: string) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .split(LINE_SEPARATOR).join("\\u2028")
    .split(PARAGRAPH_SEPARATOR).join("\\u2029");

/** Runs the user's code after parsing, so it can find its elements; errors go to console.error. */
function userCodeRunner(js: string): string {
  if (!js.trim()) return "";
  return `<script>
(function () {
  var code = ${scriptString(js)};
  function run() {
    var script = document.createElement("script");
    script.textContent = "try {\\n" + code + "\\n} catch (err) { console.error(\\"Execution Error:\\", err); }";
    (document.body || document.documentElement).appendChild(script);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
</script>`;
}

// Whole tag names only: "<header>" is not "<head>"
const HEAD_OPEN = /<head(\s[^>]*)?>/i;
const HTML_OPEN = /<html(\s[^>]*)?>/i;
const BODY_OPEN = /<body(\s[^>]*)?>/i;

export function buildPreviewDocument({
  html,
  css,
  js,
  systemScript = "",
}: {
  html: string;
  css: string;
  js: string;
  /** Extra <script> for the host (console forwarding, link blocking), run before the user's code. */
  systemScript?: string;
}): string {
  // "</style" inside the CSS would end our <style> early
  const safeCss = css.replace(/<\/style/gi, "<\\/style");
  const ours =
    `<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">` +
    `<style>${BASE_STYLES}\n${safeCss}</style>${systemScript}${userCodeRunner(js)}`;

  if (HEAD_OPEN.test(html)) return html.replace(HEAD_OPEN, (tag) => tag + ours);
  if (HTML_OPEN.test(html)) return html.replace(HTML_OPEN, (tag) => `${tag}<head>${ours}</head>`);
  if (BODY_OPEN.test(html)) return `<!DOCTYPE html><html><head>${ours}</head>${html}</html>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>${ours}</head>
<body>
${html}
</body>
</html>`;
}
