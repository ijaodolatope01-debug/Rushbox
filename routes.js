import { email_signin, request_otp, signin } from "./handlers/auth.js";
import { create_delivery } from "./handlers/delivery.js";
import { get_order, history } from "./handlers/history.js";
import { fetch_estimates } from "./handlers/order_estimate.js";
import { add_review, get_reviews } from "./handlers/reviews.js";
import {
  confirm_delete_account,
  delete_account,
  update_profile,
  user,
} from "./handlers/user.js";
import { deduct, get_wallet, transactions } from "./handlers/wallets.js";
import {
  courier_webhook,
  paystack_webhook_events_listener,
} from "./handlers/webhook.js";

const router = async (app) => {
  app.get("/user/:_id", user);
  app.get("/get_wallet/:user_id", get_wallet);

  app.post("/signin", signin);
  app.post("/request_otp", request_otp);
  app.post("/email_signin", email_signin);

  // Deletion
  app.post("/delete_account", delete_account);
  app.post("/confirm_delete_account", confirm_delete_account);

  app.post("/update_profile", update_profile);

  // Estimates
  app.post("/fetch_estimates", fetch_estimates);

  // Delivery
  app.post("/create_delivery", create_delivery);

  // History
  app.post("/history", history);
  app.get("/get_order/:_id", get_order);

  // Reviews
  app.post("/add_review", add_review);
  app.post("/get_reviews", get_reviews);

  // Wallet
  app.post("/deduct_wallet", deduct);
  app.post("/transactions", transactions);

  // Webhook
  app.post(
    "/paystack_webhook_events_listener",
    paystack_webhook_events_listener,
  );

  app.post("/couriers-webhook/:courier", courier_webhook);
};

export default router;
