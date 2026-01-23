import { AsyncLocalStorage } from 'async_hooks';

export const correlationContext = new AsyncLocalStorage<string>();
