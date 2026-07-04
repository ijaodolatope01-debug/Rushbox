import { email_signin, request_otp, signin } from "../handlers/v1/auth.js";
import { create_delivery } from "../handlers/v1/delivery.js";
import { get_order, history } from "../handlers/v1/history.js";
import { fetch_estimates } from "../handlers/v1/order_estimate.js";
import { add_review, get_reviews } from "../handlers/v1/reviews.js";
import {
  confirm_delete_account,
  delete_account,
  update_profile,
  user,
} from "../handlers/v1/user.js";
import { deduct, get_wallet, transactions } from "../handlers/v1/wallets.js";
import {
  courier_webhook,
  paystack_webhook_events_listener,
} from "../handlers/v1/webhook.js";

const routes = {
  "/user/:_id": user,
  "/get_wallet/:user_id": get_wallet,

  "/signin": signin,
  "/request_otp": request_otp,
  "/email_signin": email_signin,

  // Deletion
  "/delete_account": delete_account,
  "/confirm_delete_account": confirm_delete_account,

  "/update_profile": update_profile,

  // Estimates
  "/fetch_estimates": fetch_estimates,

  // Delivery
  "/create_delivery": create_delivery,

  // History
  "/history": history,
  "/get_order/:_id": get_order,

  // Reviews
  "/add_review": add_review,
  "/get_reviews": get_reviews,

  // Wallet
  "/deduct_wallet": deduct,
  "/transactions": transactions,

  // Webhook

  "/paystack_webhook_events_listener": paystack_webhook_events_listener,

  "/couriers-webhook/:courier": courier_webhook,
};

const router = async (req, responder) => {
  let res = {
    json(payload) {
      responder.setHeader("Content-Type", "application/json");
      responder.end(JSON.stringify(payload));
    },
  };

  try {
    // console.log(`Incoming request: ${req.method} ${req.url}`);
    const path = req.url; // e.g. "/register"
    const method = req.method.toUpperCase(); // optional if you want method-based routing

    const handler = routes[path];

    if (!handler) {
      return res.json({
        error: "Route not found",
        path,
      });
    }

    // Call handler

    return await handler(req, res);
  } catch (err) {
    console.error("Router Error:", err);

    return res.json({
      ok: false,
      message: "Internal server error",
    });
  }
};

export default router;
