
export interface ServiceConfig {
  path: string;
  url: string;
  pathRewrite?: Record<string, string>; // Optional - if not provided, path is preserved
  name: string;
  timeout?: number;
}

export interface ProxyErrorResponse {
  message: string;
  status: number;
  timestamp: string;
}