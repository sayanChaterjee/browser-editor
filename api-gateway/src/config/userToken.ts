import { createPublicKey, KeyObject } from 'crypto';
import { privateKeyFromBase64, publicKeyToBase64, signUserToken, UserIdentity } from '@ceditor/common';
import { config } from './index';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      // Set by authMiddleware from the validated session
      user?: UserIdentity;
    }
  }
}

/**
 * Loads the signing key once at startup. A key that doesn't parse, isn't Ed25519, or doesn't
 * match USER_TOKEN_PUBLIC_KEY stops the gateway here, instead of every request being
 * refused by the services later.
 */
function loadSigningKey(): KeyObject {
  const fail = (problem: string): never => {
    console.error(`Invalid configuration:\n  - USER_TOKEN_PRIVATE_KEY: ${problem}`);
    return process.exit(1);
  };

  let key: KeyObject;
  try {
    key = privateKeyFromBase64(config.USER_TOKEN_PRIVATE_KEY);
  } catch {
    return fail('not a base64 PKCS#8 key (generate with: npm run keys:user-token)');
  }
  if (key.asymmetricKeyType !== 'ed25519') fail(`must be an Ed25519 key, got ${key.asymmetricKeyType}`);
  if (config.USER_TOKEN_PUBLIC_KEY && publicKeyToBase64(createPublicKey(key)) !== config.USER_TOKEN_PUBLIC_KEY) {
    fail('does not match USER_TOKEN_PUBLIC_KEY (the key the services verify with)');
  }
  return key;
}

const signingKey = loadSigningKey();

/** A short-lived token naming the user, valid only at the given service. */
export const userTokenFor = (user: UserIdentity, audience: string): string => signUserToken(signingKey, user, audience);
