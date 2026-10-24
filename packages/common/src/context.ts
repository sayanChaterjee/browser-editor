import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  correlationId: string;
  origin?: string;
}

// Per-request context, available to everything that runs for the request (incl. the logger)
const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

export function getCorrelationId(): string | undefined {
  return requestContext.getStore()?.correlationId;
}

export function getOrigin(): string | undefined {
  return requestContext.getStore()?.origin;
}

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return requestContext.run(context, fn);
}
