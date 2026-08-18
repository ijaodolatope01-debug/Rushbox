import { boots } from "./boots.js";
import handler from "./Rushbaby.js";
import http from "http";

let server = http.createServer(handler);

let port = process.env.PORT || 4000;

server.listen(port, "0.0.0.0", async () => {
  // boots();
  console.log(`Rushbox is listening on http://localhost:${port}`);
});
