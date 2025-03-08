import { WebSocketServer } from "ws";

const server = new WebSocketServer({ port: 8080 });

server.on("connection", (socket) => {
  socket.on("message", (data) => {
    server.clients.forEach((client) => {
      if (client !== socket && client.readyState === client.OPEN) {
        client.send(data.toString());
      }
    });
  });
});

console.log("WebSocket server is running on ws://localhost:8080");
