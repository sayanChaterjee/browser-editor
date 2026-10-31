import { createPrivateKey, createPublicKey, KeyObject, sign, verify } from 'crypto';
import type { Request } from 'express';
import { envRequired, z } from './config';

/**
 * Signed user identity, passed from the gateway to the services.
 *
 * The gateway authenticates the session and signs a short-lived token (a JWT, EdDSA/Ed25519)
 * naming the user and the one service it is meant for. Services verify it with the public
 * key and trust nothing else about the user: a leaked internal secret, or plain x-user-*
 * headers, no longer let a caller act as someone else.
 */

export const USER_TOKEN_HEADER = 'x-user-token';
export const USER_TOKEN_ISSUER = 'api-gateway';
export const USER_TOKEN_TTL_SECONDS = 60;
// Headers that used to carry the user in plain text: stripped at the gateway, ignored by services
export const LEGACY_USER_HEADERS = ['x-user-id', 'x-user-name', 'x-user-email', 'x-user-role'];

// Allowance for clock drift between the gateway and a service
const CLOCK_SKEW_SECONDS = 5;

export type Role = 'user' | 'admin';

export interface UserIdentity {
  id: string;
  name: string;
  email: string;
  // Set by identity-service (the user record's role); services authorise admin routes on it
  role: Role;
}

// Anything but an explicit "admin" is an ordinary user
export const toRole = (value: unknown): Role => (value === 'admin' ? 'admin' : 'user');

export class InvalidUserTokenError extends Error {}

// Keys travel in env vars as one-line base64 DER (PKCS#8 private, SPKI public)
export const privateKeyFromBase64 = (value: string): KeyObject =>
  createPrivateKey({ key: Buffer.from(value, 'base64'), format: 'der', type: 'pkcs8' });
export const publicKeyFromBase64 = (value: string): KeyObject =>
  createPublicKey({ key: Buffer.from(value, 'base64'), format: 'der', type: 'spki' });
export const publicKeyToBase64 = (key: KeyObject): string =>
  key.export({ format: 'der', type: 'spki' }).toString('base64');

/** Config field for the services: the gateway's public key, parsed at startup (bad keys stop the service). */
export const envUserTokenPublicKey = () =>
  envRequired('the gateway\'s public key (npm run keys:user-token)').transform((value, ctx) => {
    try {
      const key = publicKeyFromBase64(value);
      if (key.asymmetricKeyType === 'ed25519') return key;
    } catch {
      // reported below
    }
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'not a base64 SPKI Ed25519 public key' });
    return z.NEVER;
  });

const HEADER = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');

export function signUserToken(privateKey: KeyObject, user: UserIdentity, audience: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: USER_TOKEN_ISSUER,
      aud: audience,
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      iat,
      exp: iat + USER_TOKEN_TTL_SECONDS,
    }),
  ).toString('base64url');
  const signature = sign(null, Buffer.from(`${HEADER}.${payload}`), privateKey).toString('base64url');
  return `${HEADER}.${payload}.${signature}`;
}

function decode(part: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidUserTokenError('malformed token');
  }
  // "null", numbers and arrays parse fine but aren't a JWT header or claims
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new InvalidUserTokenError('malformed token');
  return value as Record<string, unknown>;
}

/** Returns the user named by a valid token for this audience; throws InvalidUserTokenError otherwise. */
export function verifyUserToken(publicKey: KeyObject, token: string, audience: string, now = Date.now()): UserIdentity {
  const parts = token.split('.');
  if (parts.length !== 3) throw new InvalidUserTokenError('malformed token');
  const [header, payload, signature] = parts;

  // Only EdDSA: rejects "none" and algorithm-confusion tokens before looking at the signature
  if (decode(header).alg !== 'EdDSA') throw new InvalidUserTokenError('unexpected algorithm');
  if (!verify(null, Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, 'base64url'))) {
    throw new InvalidUserTokenError('bad signature');
  }

  const claims = decode(payload);
  const seconds = Math.floor(now / 1000);
  if (claims.iss !== USER_TOKEN_ISSUER) throw new InvalidUserTokenError('unexpected issuer');
  if (claims.aud !== audience) throw new InvalidUserTokenError('token is for another service');
  if (typeof claims.exp !== 'number' || seconds > claims.exp + CLOCK_SKEW_SECONDS) throw new InvalidUserTokenError('expired');
  if (typeof claims.iat !== 'number' || claims.iat > seconds + CLOCK_SKEW_SECONDS) throw new InvalidUserTokenError('issued in the future');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new InvalidUserTokenError('missing subject');

  return {
    id: claims.sub,
    name: typeof claims.name === 'string' ? claims.name : '',
    email: typeof claims.email === 'string' ? claims.email.toLowerCase() : '',
    role: toRole(claims.role),
  };
}

/** The user from the request's token, or null when it is missing or invalid (the reason goes to onInvalid). */
export function userFromRequest(
  req: Request,
  publicKey: KeyObject,
  audience: string,
  onInvalid?: (reason: string) => void,
): UserIdentity | null {
  const token = req.headers[USER_TOKEN_HEADER];
  if (typeof token !== 'string' || !token) return null;
  try {
    return verifyUserToken(publicKey, token, audience);
  } catch (err) {
    if (!(err instanceof InvalidUserTokenError)) throw err;
    onInvalid?.(err.message);
    return null;
  }
}
