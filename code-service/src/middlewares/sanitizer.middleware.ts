import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import logger from '../config/logger';

/**
 * Sanitizes project code (HTML) to prevent XSS in the editor/judge preview.
 */
export const sanitizeCode = (req: Request, res: Response, next: NextFunction) => {
    if (req.body && req.body.html) {
        const original = req.body.html;
        // Strip scripts and potentially malicious tags
        req.body.html = DOMPurify.sanitize(original, {
            FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
        });

        if (original !== req.body.html) {
            logger.warn(`Sanitized malicious content from project: ${req.body.name || 'unknown'}`);
        }
    }
    next();
};
