import { EVENT_LOGS, WALLETS } from "./ds/folders.js";
import handler from "./Rushbaby.js";
import http from "http";

let server = http.createServer(handler);

let port = process.env.PORT || 4000;

server.listen(port, "0.0.0.0", async () => {
  // console.log(
  //   JSON.stringify(await (await EVENT_LOGS()).find().toArray(), null, 2),
  // );
  // await (
  //   await WALLETS()
  // ).updateOne(
  //   { _id: "c2ade644bdbd5dda90ddca2279d79fcaac9adb23de31468f233e71c2080b4c1d" },
  //   { $inc: { balance: 80000 } },
  // );
  console.log(`Rushbox is listening on http://localhost:${port}`);
});
