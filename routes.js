import { login, resend_otp, signup, verify_otp } from "./handlers/auth.js";
import { create_delivery } from "./handlers/delivery.js";
import { get_order, history } from "./handlers/history.js";
import { fetch_estimates } from "./handlers/order_estimate.js";
import {
  confirm_delete_account,
  delete_account,
  update_profile,
  user,
} from "./handlers/user.js";
import { deduct, get_wallet, transactions } from "./handlers/wallets.js";
import { paystack_webhook_events_listener } from "./handlers/webhook.js";

const router = async (app) => {
  app.get("/user/:_id", user);
  app.get("/get_wallet/:user_id", get_wallet);

  app.post("/resend_otp", resend_otp);
  app.post("/login", login);
  app.post("/verify_otp", verify_otp);
  app.post("/signup", signup);
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
  app.post("/get_order/:_id", get_order);

  // Wallet
  app.post("/deduct_wallet", deduct);
  app.post("/transactions", transactions);

  // Webhook
  app.post(
    "/paystack_webhook_events_listener",
    paystack_webhook_events_listener
  );
};

export default router;
