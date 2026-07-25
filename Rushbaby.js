import dotenv from "dotenv";
dotenv.config();

import GodProtocol from "godprotocol";

import router from "./routes/index.js";
import services from "./services/index.js";
import services_config, { gp_services_config } from "./services.config.js";

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

export default gp.on_request;
