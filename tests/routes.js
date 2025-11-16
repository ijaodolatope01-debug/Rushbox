import { signup } from "./auth.js";
import { test_create_delivery, test_estimates } from "./delivery.js";
import { update_profile, user } from "./user.js";

const test_router = async (app) => {
  app.get("/test-signup", signup);
  app.get("/test-user", user);
  app.get("/test-update-profile", update_profile);
  app.get("/test-estimates", test_estimates);
  app.get("/test-create-delivery", test_create_delivery);
};

export default test_router;
