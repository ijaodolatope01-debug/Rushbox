import { boots } from "./boots.js";
import {
  EVENT_LOGS,
  PAYMENT_REFS,
  PENDING_DELIVERIES,
  OTPS,
  USERS,
  WALLETS,
} from "./ds/folders.js";
import handler from "./Rushbaby.js";
import http from "http";

let server = http.createServer(handler);

let port = process.env.PORT || 4000;

server.listen(port, "0.0.0.0", async () => {
  // boots();
  console.log(`Rushbox is listening on http://localhost:${port}`);
});
