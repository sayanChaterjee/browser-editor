#!/usr/bin/env node
// Prints a new Ed25519 key pair for the user tokens the gateway signs (see docs/adr/0008).
// USER_TOKEN_PRIVATE_KEY goes to the gateway only; USER_TOKEN_PUBLIC_KEY to every service.
import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
console.log(`USER_TOKEN_PRIVATE_KEY=${privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64')}`);
console.log(`USER_TOKEN_PUBLIC_KEY=${publicKey.export({ format: 'der', type: 'spki' }).toString('base64')}`);
