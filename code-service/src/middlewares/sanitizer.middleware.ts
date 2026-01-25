import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import logger from '../config/logger';
import { CodeUtils } from '../utils/codeUtils';

/**
 * Sanitizes project code (HTML fragment) to prevent XSS.
 * Also handles extraction of fragments if a full document is provided.
 */
export const sanitizeCode = (req: Request, res: Response, next: NextFunction) => {
    if (req.body) {
        // 1. Extraction: If the body contains a full HTML document in 'html', split it
        if (req.body.html && (req.body.html.toLowerCase().includes('<html') || req.body.html.toLowerCase().includes('<body'))) {
            const fragments = CodeUtils.extractFragments(req.body.html);
            req.body.html = fragments.html;

            // Merge or set extracted CSS/JS
            if (fragments.css) {
                req.body.css = req.body.css ? `${req.body.css}\n${fragments.css}` : fragments.css;
            }
            if (fragments.js) {
                req.body.js = req.body.js ? `${req.body.js}\n${fragments.js}` : fragments.js;
            }

            logger.info(`Extracted fragments from full document for project: ${req.body.name || 'unknown'}`);
        }

        // 2. Sanitization: Specifically for the HTML fragment
        if (req.body.html) {
            const original = req.body.html;

            // Clean the fragment. Since it's just the <body> content, we don't need doc-level tags.
            req.body.html = DOMPurify.sanitize(original, {
                ALLOWED_TAGS: [
                    'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
                    'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
                    'a', 'img', 'b', 'i', 'strong', 'em', 'u', 'code', 'pre', 'blockquote',
                    'form', 'label', 'input', 'textarea', 'button', 'select', 'option',
                    'header', 'footer', 'main', 'section', 'article', 'nav', 'aside', 'figure', 'figcaption'
                ],
                ALLOWED_ATTR: [
                    'id', 'class', 'style', 'href', 'src', 'alt', 'type', 'name',
                    'value', 'placeholder', 'target', 'rel', 'aria-label', 'role'
                ],
                // Explicitly forbid script and style tags within the html fragment
                FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
                FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
                WHOLE_DOCUMENT: false,
                FORCE_BODY: false,
            });

            if (original !== req.body.html) {
                logger.warn(`Sanitized malicious or structural tags from project: ${req.body.name || 'unknown'}`);
            }
        }
    }
    next();
};
