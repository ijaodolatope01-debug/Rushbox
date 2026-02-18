import { EVENT_LOGS } from "./ds/folders.js";
import handler from "./Rushbaby.js";
import http from "http";

let server = http.createServer(handler);

let port = process.env.PORT || 4000;

server.listen(port, "0.0.0.0", async () => {
  // console.log(
  //   JSON.stringify(await (await EVENT_LOGS()).find().toArray(), null, 2),
  // );
  console.log(`Rushbox is listening on http://localhost:${port}`);
});
