import dotenv from "dotenv";
dotenv.config();

import GodProtocol from "godprotocol";

import router from "./routes/index.js";
import services from "./services/index.js";
import services_config, { gp_services_config } from "./services.config.js";
import { hash } from "./libs/utils/hash.js";
import { debug } from "./handlers/v2/delivery.js";

let gp = new GodProtocol({
  platform_uri: process.env.PLATFORM_URI,
  api_key: process.env.API_KEY,
  db_config: {
    db_name: "rushbox",
    db_url: process.env.MONGODB_URI,
  },
  capabilities: gp_services_config,
});

router(gp, { services_config });

gp.callback({
  after: async ({ route, db, result }) => {
    let Webhooks = await db.folder("Webhooks");
    if (route === "courier_webhook/:courier" && result?.data) {
      let { order: payload } = result?.data;
      let webhook = await Webhooks.findOne({ profile: payload.user_id });
      debug(webhook);
      if (webhook) {
        let body = JSON.stringify({ event: "order_status", payload });
        fetch(`${webhook.url}`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "x-secret": hash(`${webhook.secret}:${body}`),
          },
          body,
        })
          .then((res) => res.json())
          .then((res) => debug(res))
          .catch((err) => debug(err));
      }
    } else if (route === "create_delivery") {
      let { data } = result;
      let webhook = await Webhooks.findOne({ profile: data.profile });
      debug(webhook);
      if (webhook) {
        let body = JSON.stringify({
          event: result.ok
            ? "delivery_creation_success"
            : "delivery_creation_failed",
          payload: data,
        });
        await fetch(`${webhook.url}`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "x-secret": hash(`${webhook.secret}:${body}`),
          },
          body,
        })
          .then((res) => res.json())
          .then((res) => debug(res))
          .catch((err) => debug(err));
      }
    }
  },
});

export default gp.on_request;
