import { Server as IOServer } from "socket.io";

export let io: IOServer;

export function initSocket(httpServer: any, corsOrigin: string) {
  io = new IOServer(httpServer, {
    cors: { origin: corsOrigin, methods: ["GET", "POST"] }
  });

  io.on("connection", (socket) => {
    const tenantId = socket.handshake.query?.tenantId;
    if (typeof tenantId === "string" && tenantId.length > 0) {
      socket.join(tenantId);
    }
  });

  return io;
}
