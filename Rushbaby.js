import dotenv from "dotenv";
dotenv.config();

import GodProtocol from "godprotocol";

import router from "./routes/index.js";
import services_config, { gp_services_config } from "./services.config.js";
import { after_callback, header_callback } from "./libs/callbacks.js";

let gp = new GodProtocol({
  platform_uri: process.env.PLATFORM_URI,
  api_key: process.env.API_KEY,
  profile_key_prefixes: ["rb_test_", "rb_live_"],
  db_config: {
    db_name: "rushbox",
    db_url: process.env.MONGODB_URI,
  },
  capabilities: gp_services_config,
});

router(gp, { services_config });

gp.callback({
  after: after_callback,
  header_resolved: header_callback,
});

gp.on_start(() => {
  global.gp = gp;
});

await gp.boot();

export default gp.on_request;
