import dotenv from "dotenv";
dotenv.config();

import GodProtocol from "godprotocol";

import router from "./routes/index.js";
import services from "./services/index.js";

let gp = new GodProtocol({
  platform_uri: process.env.PLATFORM_URI,
  api_key: process.env.API_KEY,
  db_config: {
    db_name: "rushbox",
    db_url: process.env.MONGODB_URI,
  },
});

router(gp);
gp.load_services(services);

export default gp.on_request;
