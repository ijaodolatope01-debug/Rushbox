import { STATUSES_MESSAGE } from "./couriers/statuses_map.js";
import { create_profile_keys } from "./create_profile_keys.js";
import { send_notification } from "./push_notifications.js";
import { hash } from "./utils/hash.js";
import { handle_bank_account } from "./utils/payment_gateway.js";

const courier_webhook_callback = async ({ order: payload, req }) => {
  console.log("========== COURIER WEBHOOK CALLBACK START ==========");

  let db = req.db;

  let Webhooks = await db.folder("Webhooks");

  let { debug } = req.gp.utils;

  debug("[COURIER] Incoming payload:");
  debug(JSON.stringify(payload, null, 2));

  if (!payload) {
    debug("[COURIER] Missing payload");
    console.log("========== COURIER WEBHOOK CALLBACK END ==========");
    return;
  }

  const profile_id = payload.user_id || payload.profile;

  debug("[COURIER] Profile ID:", profile_id);
  debug("[COURIER] Order ID:", payload._id);
  debug("[COURIER] Courier:", payload.courier);
  debug("[COURIER] Status:", payload.status);
  debug("[COURIER] Ongoing Status:", payload.ongoing_status);

  // ------------------------------------------------------------
  // PUSH NOTIFICATION
  // ------------------------------------------------------------

  try {
    debug("[NOTIFICATION] Preparing push notification");

    let title = "Order Status Updated";

    let text =
      payload.status_message ||
      STATUSES_MESSAGE?.[payload.ongoing_status] ||
      "Your order status has been updated";

    if (payload.ongoing_status === 10) {
      title = "Delivery Completed";

      text =
        payload.status_message ||
        "Your package has been delivered successfully.";
    } else if (payload.ongoing_status < 0) {
      title = "Delivery Failed";

      text =
        payload.status_message ||
        "Unfortunately, your delivery could not be completed.";
    }

    debug("[NOTIFICATION] Title:", title);
    debug("[NOTIFICATION] Text:", text);

    const notification_result = await send_notification(
      profile_id,
      {
        title,
        text,
        type: "ongoing_order",
        data: {
          order_id: payload._id,
          courier: payload.courier,
          ongoing_status: payload.ongoing_status,
          status: payload.status,
        },
      },
      req,
    );

    debug("[NOTIFICATION] Notification sent:", notification_result);
  } catch (error) {
    debug("[NOTIFICATION] Courier push notification failed:", error);
  }

  // ------------------------------------------------------------
  // EMAIL NOTIFICATION
  // ------------------------------------------------------------

  try {
    debug("[EMAIL] Loading profile:", profile_id);

    const profile_result = await (
      await req.services("profiles")
    ).call("get_profile", {
      _id: profile_id,
    });

    debug("[EMAIL] Profile result:", profile_result);

    if (!profile_result?.ok) {
      debug("[EMAIL] Could not retrieve profile:", profile_id);
    } else {
      const profile = profile_result.data;

      debug("[EMAIL] Profile:", profile);

      if (profile?.email) {
        const platform = {
          name: "Rushbox Logistics",
        };

        let template = "order-status-updated";

        if (payload.ongoing_status === 10) {
          template = "order-delivered";
        } else if (payload.ongoing_status < 0) {
          template = "order-failed";
        }

        debug("[EMAIL] Selected template:", template);

        const params = {
          profile,
          platform,
          banner: "https://rushbox.biz/banner.jpeg",
          order: normalize_email_order(payload),
        };

        debug("[EMAIL] Template params:", JSON.stringify(params, null, 2));

        const response = await (
          await req.services("aimail")
        ).call("send_mail", {
          to: profile.email,
          from: platform.name,
          content: {
            template,
            params,
          },
        });

        debug("[EMAIL] Mail response:", response);
      } else {
        debug("[EMAIL] Profile has no email");
      }
    }
  } catch (error) {
    debug("[EMAIL] Courier status email failed:", error);
  }

  // ------------------------------------------------------------
  // USER WEBHOOK
  // ------------------------------------------------------------

  try {
    debug("[WEBHOOK] Looking up webhook for profile:", profile_id);

    const webhook = await Webhooks.findOne({
      profile: profile_id,
    });

    debug("[WEBHOOK] Webhook config:", webhook);

    if (webhook) {
      const body = JSON.stringify({
        event: "order_status",
        payload,
      });

      const secret = hash(`${webhook.secret}:${body}`);

      debug("[WEBHOOK] URL:", webhook.url);
      debug("[WEBHOOK] Generated secret:", secret);
      debug("[WEBHOOK] Body:", body);

      fetch(webhook.url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-secret": secret,
        },
        body,
      })
        .then((res) => {
          debug("[WEBHOOK] Response status:", res.status);

          return res.json();
        })
        .then((res) => {
          debug("[WEBHOOK] Response body:", res);
        })
        .catch((err) => {
          debug("[WEBHOOK] Request failed:", err);
        });
    } else {
      debug("[WEBHOOK] No webhook configured for profile:", profile_id);
    }
  } catch (error) {
    debug("[WEBHOOK] Courier webhook failed:", error);
  }

  console.log("========== COURIER WEBHOOK CALLBACK END ==========");
};

const normalize_email_order = (order = {}) => ({
  _id: order?._id || order?.order_id,

  status: order?.status || order?.order_status,

  status_message:
    order?.status_message ||
    order?.order_message ||
    STATUSES_MESSAGE?.[order?.ongoing_status],

  courier: order?.courier,

  pickup_address:
    order?.pickup_address ||
    order?.pickup?.address ||
    order?.norm?.pickup?.address,

  dropoff_address:
    order?.dropoff_address ||
    order?.destination_address ||
    order?.destination?.address ||
    order?.norm?.destination?.address,

  destination_address:
    order?.destination_address ||
    order?.dropoff_address ||
    order?.destination?.address ||
    order?.norm?.destination?.address,
});

const after_callback = async ({ route, db, result, req, headers }, gp) => {
  let { debug } = gp.utils;

  const Webhooks = await db.folder("Webhooks");

  // ============================================================
  // COURIER WEBHOOK
  // ============================================================

  console.log(route);
  if (
    ["courier_webhook/:courier", "courier_webhook/:courier/staging"].includes(
      route,
    ) &&
    result?.data
  ) {
    await courier_webhook_callback({ order: result.data?.order, req });
  } else if (route === "create_delivery") {
    const { data } = result;

    const { headers } = req;

    debug(JSON.stringify(data, null, 2));

    const profile = headers?.profile;

    const profile_id = profile?._id;

    // ------------------------------------------------------------
    // PUSH NOTIFICATION
    // ------------------------------------------------------------

    try {
      await send_notification(
        profile_id,

        {
          title: result.ok ? "Delivery Created" : "Delivery Creation Failed",

          text: result.ok
            ? "Your delivery request has been created successfully."
            : result.message || "We could not create your delivery.",

          type: result.ok
            ? "delivery_creation_success"
            : "delivery_creation_failed",

          data: {
            ...(data || {}),
          },
        },

        req,
      );
    } catch (error) {
      debug("[NOTIFICATION] Delivery push notification failed:", error);
    }

    // ------------------------------------------------------------
    // EMAIL NOTIFICATION
    // ------------------------------------------------------------

    try {
      if (profile?.email) {
        const platform = {
          name: "Rushbox Logistics",
        };

        const template = result.ok ? "order-created" : "order-failed";

        const params = {
          profile,

          platform,

          banner: "https://rushbox.biz/banner.jpeg",

          order: normalize_email_order(data),

          error: result.message,
        };

        debug(
          JSON.stringify(params, null, 2),
          "[EMAIL] CREATE DELIVERY PARAMS",
        );

        const response = await (
          await req.services("aimail")
        ).call("send_mail", {
          to: profile.email,

          from: platform.name,

          content: {
            template,
            params,
          },
        });

        debug(response, "AI_MAIL");
      }
    } catch (error) {
      debug("[EMAIL] Delivery creation email failed:", error);
    }

    // ------------------------------------------------------------
    // USER WEBHOOK
    // ------------------------------------------------------------

    try {
      const webhook = await Webhooks.findOne({
        profile: profile_id,
      });

      debug(webhook);

      if (webhook) {
        const body = JSON.stringify({
          event: result.ok
            ? "delivery_creation_success"
            : "delivery_creation_failed",

          payload: data,
        });

        await fetch(webhook.url, {
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
    } catch (error) {
      debug("[WEBHOOK] Delivery creation webhook failed:", error);
    }
  } else if (
    result.ok &&
    ["update_email", "confirm_phone_update"].includes(route)
  ) {
    let { profile } = headers;

    console.log(route, profile);
    console.log(result);
    if (
      (!profile.email && route === "update_email") ||
      (!profile.phone && route === "confirm_phone_update")
    ) {
      await handle_bank_account(result.data, db);

      await create_profile_keys(result.data, req);
    }
  }
};

const header_callback = async ({ headers }, gp) => {
  let auth = headers.authorization;
  let { debug } = gp.utils;

  if (auth?.startsWith("rb_")) {
    if (auth.startsWith("rb_test_")) {
      if (!process.env.STAGING)
        return {
          ok: false,
          status: 401,
          status_code: "test_key_not_allowed",
          message: "Test API keys are not allowed in production",
        };
    } else if (auth.startsWith("rb_live_")) {
      if (process.env.STAGING)
        return {
          ok: false,
          status: 401,
          status_code: "live_key_not_allowed",
          message: "Live API keys are not allowed in staging",
        };
    } else {
      return {
        ok: false,
        status: 401,
        status_code: "invalid_api_key",
        message: "Invalid API key format",
      };
    }
  }
};

const on_error_callback = async (payload, gp) => {
  let team = process.env.DEV_TEAM;
  let { debug } = gp.utils;

  try {
    if (!team) {
      return;
    }
    team = JSON.parse(team);
  } catch (e) {
    return;
  }

  let mail_payload = {
    request_id: payload.request_id,
    stage: payload.stage,
    timestamp: payload.timestamp,
    error_json: JSON.stringify(payload.error ?? {}, null, 2),
    request_json: JSON.stringify(payload.request ?? {}, null, 2),
    routing_json: JSON.stringify(payload.routing ?? {}, null, 2),
    database_json: JSON.stringify(payload.database ?? {}, null, 2),
    security_json: JSON.stringify(payload.security ?? {}, null, 2),
    before_hook_json: JSON.stringify(payload.before_hook ?? {}, null, 2),
    execution_json: JSON.stringify(payload.execution ?? {}, null, 2),
    result_json: JSON.stringify(payload.result ?? null, null, 2),
  };

  for (let t = 0; t < team.length; t++) {
    (await gp.route_table.get_service("aimail", { version: "v2" }))
      .call("send_mail", {
        to: team[t],
        from: "Rushbox Monitoring",
        content: {
          template: "internal_error_alert",
          params: mail_payload,
        },
      })
      .then((res) => {
        debug(res, "ok");
      })
      .catch((err) => console.log(err));
  }
};

export {
  after_callback,
  header_callback,
  on_error_callback,
  courier_webhook_callback,
};
