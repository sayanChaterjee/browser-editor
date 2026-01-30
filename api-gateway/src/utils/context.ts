import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
    correlationId: string;
    origin?: string;
}

// Create an async local storage instance for request context
const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current request context
 */
export function getRequestContext(): RequestContext | undefined {
    return requestContext.getStore();
}

/**
 * Get the correlation ID from the current request context
 */
export function getCorrelationId(): string | undefined {
    return requestContext.getStore()?.correlationId;
}

/**
 * Get the origin from the current request context
 */
export function getOrigin(): string | undefined {
    return requestContext.getStore()?.origin;
}

/**
 * Run a function within a request context
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
    return requestContext.run(context, fn);
}

/**
 * Set correlation ID in the current context
 * Note: This should only be used if context already exists
 */
export function setCorrelationId(correlationId: string): void {
    const store = requestContext.getStore();
    if (store) {
        store.correlationId = correlationId;
    }
}

/**
 * Set origin in the current context
 */
export function setOrigin(origin: string): void {
    const store = requestContext.getStore();
    if (store) {
        store.origin = origin;
    }
}

export { requestContext };
