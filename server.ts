import { createServer } from "http";
import next from "next";
import { initRealtimeEngine } from "./src/lib/realtime/engine";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  initRealtimeEngine(httpServer);

  httpServer.listen(port, () => {
    console.log(`> Lepta running on http://${hostname}:${port}`);
    console.log(`> WebSocket on ws://${hostname}:${port}/api/ws`);
    console.log(`> Realtime engine: reconciliation + settlement + agent loops active`);
  });
});
