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
        // 1. Sanitization: Allow structural tags if it's a full document
        if (req.body.html) {
            const original = req.body.html;

            // We allow structural tags but still sanitize for XSS
            req.body.html = DOMPurify.sanitize(original, {
                ALLOWED_TAGS: [
                    'html', 'head', 'body', 'meta', 'title', 'link',
                    'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
                    'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
                    'a', 'img', 'b', 'i', 'strong', 'em', 'u', 'code', 'pre', 'blockquote',
                    'form', 'label', 'input', 'textarea', 'button', 'select', 'option',
                    'header', 'footer', 'main', 'section', 'article', 'nav', 'aside', 'figure', 'figcaption',
                    'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'details', 'summary'
                ],
                ALLOWED_ATTR: [
                    'id', 'class', 'style', 'href', 'src', 'alt', 'type', 'name', 'charset', 'content',
                    'value', 'placeholder', 'target', 'rel', 'aria-label', 'role', 'viewport',
                    'width', 'height', 'viewBox', 'fill', 'stroke', 'd', 'points', 'x', 'y', 'r', 'cx', 'cy'
                ],
                // Explicitly allow data-* attributes
                ADD_ATTR: ['data-*'],
                // Explicitly forbid scripts but allow them to be handled via the separate 'js' field
                FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
                FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
                WHOLE_DOCUMENT: original.toLowerCase().includes('<html') || original.toLowerCase().includes('<body'),
                FORCE_BODY: !original.toLowerCase().includes('<html') && !original.toLowerCase().includes('<body'),
            });

            if (original !== req.body.html) {
                logger.warn(`Sanitized project code: ${req.body.name || 'unknown'}`);
            }
        }
    }
    next();
};
