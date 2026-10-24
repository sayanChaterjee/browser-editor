import { z } from 'zod';

export { z };

/**
 * Parses process.env with a zod schema. On invalid or missing values the process exits
 * with a list of every problem, instead of failing later on the first use.
 */
export function loadConfig<T extends z.ZodTypeAny>(
  schema: T,
  env: NodeJS.ProcessEnv = process.env,
  exit: (code: number) => never = process.exit,
): z.infer<T> {
  // An empty value (e.g. `PORT=`) counts as unset, so defaults apply as with `||`.
  const present = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  const result = schema.safeParse(present);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    console.error(`Invalid configuration:\n${problems}`);
    return exit(1);
  }
  return result.data;
}

// Env vars are strings; these turn them into typed values with defaults.
// A required value shows the same hint whether it is missing or empty.
export const envRequired = (hint: string) => z.string({ required_error: `required (${hint})` }).min(1, `required (${hint})`);
export const envNumber = (fallback: number) => z.coerce.number().default(fallback);
export const envBoolean = (fallback: boolean) =>
  z
    .enum(['true', 'false'])
    .default(fallback ? 'true' : 'false')
    .transform((value) => value === 'true');
export const envList = (fallback: string) =>
  z
    .string()
    .default(fallback)
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    );
