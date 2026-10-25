import { AddressInfo } from 'net';
import http from 'http';
import express from 'express';

/** Starts an app on the given port (0 = any free port) and returns its base URL and a closer. */
export async function listen(app: express.Express | http.RequestListener, port = 0) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
}
