"use client";

type Props = {
  html: string;
  css: string;
  js: string;
};

export default function Preview({ html, css, js }: Props) {
  const srcDoc = `
<!DOCTYPE html>
<html>
  <head>
    <style>
      body { margin: 0; padding: 16px; font-family: sans-serif; }
      ${css}
    </style>
  </head>
  <body>
    ${html}
    <script>${js}<\/script>
  </body>
</html>
`;

  return (
    <div className="preview-panel">
      <div className="preview-header">
        <span>Preview</span>
      </div>

      <iframe
        className="preview-iframe"
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        title="preview"
      />
    </div>
  );
}
