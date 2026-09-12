import dotenv from "dotenv";
dotenv.config();

import GodProtocol from "godprotocol";

import router from "./routes/index.js";
import services_config, { gp_services_config } from "./services.config.js";
import { hash } from "./libs/utils/hash.js";
import { debug } from "./handlers/v2/delivery.js";
import { send_notification } from "./libs/push_notifications.js";

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
  after: async ({ route, db, result, req }) => {
    const Webhooks = await db.folder("Webhooks");

    // ============================================================
    // COURIER WEBHOOK
    // ============================================================

    if (route === "courier_webhook/:courier" && result?.data) {
      const { order: payload } = result.data;

      if (!payload) return;

      const profile_id = payload.user_id;

      // ------------------------------------------------------------
      // PUSH NOTIFICATION
      // ------------------------------------------------------------

      try {
        let title = "Order Status Updated";

        let text =
          payload.status_message ||
          STATUSES_MESSAGE[payload.ongoing_status] ||
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

        await send_notification(
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
      } catch (error) {
        debug("[NOTIFICATION] Courier push notification failed:", error);
      }

      // ------------------------------------------------------------
      // EMAIL NOTIFICATION
      // ------------------------------------------------------------

      try {
        let profile_result = await (
          await req.services("profiles")
        ).call("get_profile", {
          _id: profile_id,
        });

        if (!profile_result?.ok) {
          debug("[EMAIL] Could not retrieve profile:", profile_id);
        } else {
          const profile = profile_result.data;

          debug(profile);

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

            debug(
              await (
                await req.services("aimail")
              ).call("send_mail", {
                to: profile.email,
                from: platform.name,
                content: {
                  template,
                  params: {
                    profile,
                    platform,
                    banner: "https://rushbox.biz/banner.jpeg",
                    order: {
                      status: payload?.order_status,
                      _id: payload?.order_id,
                      status_message: payload?.order_message,
                      courier: payload?.courier,
                      pickup_address: payload?.pickup?.address,
                      dropoff_address: payload?.destination?.address,
                      destination_address: payload?.destination?.address,
                    },
                  },
                },
              }),
              "AI_MAIL",
            );
          }
        }
      } catch (error) {
        debug("[EMAIL] Courier status email failed:", error);
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
            event: "order_status",
            payload,
          });

          fetch(webhook.url, {
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
        debug("[WEBHOOK] Courier webhook failed:", error);
      }
    }

    // ============================================================
    // CREATE DELIVERY
    // ============================================================
    else if (route === "create_delivery") {
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

          debug(
            await (
              await req.services("aimail")
            ).call("send_mail", {
              to: profile.email,
              from: platform.name,
              content: {
                template,
                params: {
                  profile,
                  platform,
                  banner: "https://rushbox.biz/banner.jpeg",
                  order: {
                    status: data?.order_status,
                    _id: data?.order_id,
                    status_message: data?.order_message,
                    courier: data?.courier,
                    pickup_address: data?.pickup.address,
                    dropoff_address: data?.destination.address,
                    destination_address: data?.destination.address,
                  },

                  error: result.message,
                },
              },
            }),
          );
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
    }
  },
});

gp.on_start(() => {
  global.gp = gp;
});

await gp.boot();

export default gp.on_request;
