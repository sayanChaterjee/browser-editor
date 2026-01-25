import { JSDOM } from 'jsdom';

export interface CodeFragments {
    html: string;
    css: string;
    js: string;
}

export class CodeUtils {
    /**
     * Extracts HTML, CSS, and JS fragments from a full HTML document.
     * If the input is not a full document, it returns the input as the HTML fragment.
     */
    static extractFragments(code: string): CodeFragments {
        // Simple heuristic to check if it's a full document
        const lowerCode = code.toLowerCase();
        if (!lowerCode.includes('<html') && !lowerCode.includes('<body')) {
            return { html: code, css: '', js: '' };
        }

        try {
            const dom = new JSDOM(code);
            const { document } = dom.window;

            // Extract CSS from <style> tags
            const styles = Array.from(document.querySelectorAll('style'))
                .map(style => style.textContent || '')
                .join('\n');

            // Remove <style> tags from the body content
            document.querySelectorAll('style').forEach(s => s.remove());

            // Extract JS from <script> tags
            const scripts = Array.from(document.querySelectorAll('script'))
                .map(script => script.textContent || '')
                .join('\n');

            // Remove <script> tags
            document.querySelectorAll('script').forEach(s => s.remove());

            // Extract content from <body>
            const html = document.body.innerHTML.trim();

            return { html, css: styles, js: scripts };
        } catch (error) {
            // Fallback in case of parsing error
            return { html: code, css: '', js: '' };
        }
    }

    /**
     * Assembles fragments into a full HTML document with system injections.
     */
    static generateFullPreview(html: string, css: string, js: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 16px; font-family: sans-serif; }
        ${css}
    </style>
    <script>
        // System Injection: Visibility Change Listener (Anti-Cheating)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                window.parent.postMessage({ 
                    type: 'CONTEST_VIOLATION', 
                    reason: 'TAB_SWITCH',
                    timestamp: new Date().toISOString()
                }, '*');
            }
        });

        // Security: Prevent navigation via links
        document.addEventListener('click', (e) => {
            const link = (e.target as HTMLElement).closest('a');
            if (link && link.getAttribute('href') && link.getAttribute('href') !== '#') {
                e.preventDefault();
                window.parent.postMessage({ type: 'PREVIEW_LINK_CLICK' }, '*');
            }
        }, true);

        window.onload = () => {
            try {
                ${js}
            } catch (err) {
                console.error("Preview Error:", err);
            }
        };
    </script>
</head>
<body>
    ${html}
</body>
</html>`;
    }
}
