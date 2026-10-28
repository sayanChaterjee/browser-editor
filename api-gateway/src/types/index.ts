
export interface ServiceConfig {
  path: string;
  url: string;
  pathRewrite?: Record<string, string>; // Optional - if not provided, path is preserved
  name: string;
  // Service the user token is signed for (defaults to name)
  audience?: string;
  timeout?: number;
}

export interface ProxyErrorResponse {
  message: string;
  status: number;
  timestamp: string;
}