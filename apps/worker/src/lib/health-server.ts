import { createServer, type Server } from "node:http";
import { getFacebookSessionDiagnostics } from "./facebook-session";

export function startHealthServer(): Server {
  const port = Number(process.env.PORT ?? 10000);
  const startedAt = Date.now();

  const server = createServer((request, response) => {
    if (request.url === "/health") {
      const facebookSession = getFacebookSessionDiagnostics();
      const status = facebookSession.status === "ok" ? "ok" : "degraded";

      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          status,
          service: "price-monitor-worker",
          uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
          checks: {
            facebookSession,
          },
        }),
      );
      return;
    }

    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("Not found");
  });

  server.listen(port, () => {
    console.log(`Health server listening on port ${port}`);
  });

  return server;
}
