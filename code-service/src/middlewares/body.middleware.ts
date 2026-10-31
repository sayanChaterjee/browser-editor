import express from 'express';

// A project's files: up to MAX_FILE_CHARS each (the routes check it), so a request carrying all
// three fits in the body limit. Express's default (100 KB) made larger projects fail to save.
export const MAX_FILE_CHARS = 500_000;
export const jsonBody = express.json({ limit: '2mb' });
