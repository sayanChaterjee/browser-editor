export const INITIAL_README = `# HTML, CSS, and JS Fundamentals

## HTML (HyperText Markup Language)
- \`<html>\`: Root element.
- \`<head>\`: Metadata, title, links to CSS.
- \`<body>\`: Visible content.
- \`<h1>\`-\`<h6>\`: Headings.
- \`<p>\`: Paragraphs.
- \`<a>\`: Links.
- \`<img>\`: Images.
- \`<div>\`: Division/container.

## CSS (Cascading Style Sheets)
- **Selectors**: \`element\`, \`.class\`, \`#id\`.
- **Properties**: \`color\`, \`background-color\`, \`font-size\`, \`margin\`, \`padding\`, \`display\`, \`flex\`.
- **Box Model**: Content, Padding, Border, Margin.

## JavaScript
- **Variables**: \`let\`, \`const\`, \`var\`.
- **Functions**: \`function name() { ... }\`, \`const name = () => { ... }\`.
- **DOM Manipulation**: \`document.getElementById()\`, \`addEventListener()\`.
- **Events**: \`click\`, \`input\`, \`submit\`.
`;

export const INITIAL_HTML = `<!DOCTYPE html>
<html>
<head>
    <title>My Project</title>
</head>
<body>
    <h1>Welcome to your project</h1>
    <p>Start coding here!</p>
</body>
</html>`;

export const INITIAL_CSS = `body {
    font-family: sans-serif;
    padding: 20px;
}
h1 {
    color: #38bdf8;
}`;

export const INITIAL_JS = `console.log('Hello from JS!');`;

export const HTML_TAG_REFERENCE = `
# HTML TAG REFERENCE

## Structural Tags
- <div>: Generic container used for layout
- <span>: Inline container for styling text
- <header>: Represents introductory content or navigation
- <footer>: Represents footer content
- <section>: Semantic section of a page
- <article>: Self-contained content
- <main>: Main content of the document
- <nav>: Navigation links
- <aside>: Sidebar content
- <figure>: Content with optional caption
- <figcaption>: Caption for <figure>

## Headings & Text
- <h1> – <h6>: Headings from most important to least
- <p>: Paragraph text
- <hr>: Horizontal rule (line)
- <blockquote>: Quoted content
- <pre>: Preformatted text
- <code>: Inline code

## Lists
- <ul>: Unordered list
- <ol>: Ordered list
- <li>: List item
- <dl>: Description list
- <dt>: Description term
`;
