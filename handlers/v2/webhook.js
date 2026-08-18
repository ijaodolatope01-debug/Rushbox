import crypto from "crypto";
import { create_delivery, debug } from "./delivery.js";
import { credit_wallet } from "../../services/wallet.js";
import { webhook_courier } from "../../libs/couriers/index.js";
import { send_notification } from "./push_noti.js";
import { STATUSES_MESSAGE } from "../../libs/couriers/statuses_map.js";
import { hash } from "../../libs/utils/hash.js";

const courier_webhook = async (req) => {
  console.log("========== COURIER WEBHOOK START ==========");

  let { params, db, body, headers, query } = req;
  let { courier } = params;

  console.log("[WEBHOOK] Params:", params);
  console.log("[WEBHOOK] Courier:", courier);
  console.log("[WEBHOOK] Headers:", headers);
  console.log("[WEBHOOK] Body:", body);
  console.log("[WEBHOOK] DB available:", !!db);

  let handler = webhook_courier[courier];

  console.log("[WEBHOOK] Handler found:", !!handler);

  if (!handler) {
    console.log("[WEBHOOK] No handler for courier:", courier);
    console.log("========== COURIER WEBHOOK END ==========");

    return {
      ok: true,
      status: 200,
    };
  }

  console.log("[WEBHOOK] Calling courier handler...");

  let result;

  try {
    result = await handler(req, { staging });
    console.log("[WEBHOOK] Handler result:", result);
  } catch (error) {
    console.error("[WEBHOOK] Handler error:", error);
    console.log("========== COURIER WEBHOOK END ==========");

    return {
      ok: false,
      status: 500,
    };
  }

  if (!result) {
    console.log("[WEBHOOK] Handler returned no result");
    console.log("========== COURIER WEBHOOK END ==========");

    return {
      status: 403,
    };
  }

  console.log("[WEBHOOK] Handler succeeded");

  if (result?.order) {
    console.log("[WEBHOOK] Order found:", result.order);

    let { user_id, ongoing_status, _id } = result.order;

    console.log("[WEBHOOK] Order ID:", _id);
    console.log("[WEBHOOK] User ID:", user_id);
    console.log("[WEBHOOK] Ongoing status:", ongoing_status);
    console.log("[WEBHOOK] Status timestamp:", result.order[ongoing_status]);

    const notification = {
      title: "Order status",
      text: STATUSES_MESSAGE[ongoing_status],
      _id: crypto.randomUUID(),
      type: "ongoing_order",
      user_id,
      data: {
        order_id: _id,
      },
    };

    console.log("[WEBHOOK] Sending notification:", notification);

    try {
      await send_notification(user_id, notification, req);

      console.log("[WEBHOOK] Notification sent successfully");
    } catch (error) {
      console.error("[WEBHOOK] Notification error:", error);
    }

    let payload = {
      order_id: _id,
      user_id,
      ongoing_status,
      time: result.order[ongoing_status],
    };

    console.log("[WEBHOOK] Live event payload:", payload);

    try {
      const livechat_response = await fetch(
        `https://livechat.rushbox.biz/send_event`,
        {
          method: "POST",
          headers: {
            "Content-type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            user: user_id,
            name: "ongoing_order_status",
            payload,
          }),
        },
      );

      console.log("[WEBHOOK] Livechat status:", livechat_response.status);

      const livechat_text = await livechat_response.text();

      console.log("[WEBHOOK] Livechat response:", livechat_text);
    } catch (error) {
      console.error("[WEBHOOK] Livechat error:", error);
    }
  } else {
    console.log("[WEBHOOK] No order in handler result");
  }

  console.log("[WEBHOOK] Returning success");
  console.log("========== COURIER WEBHOOK END ==========");

  return {
    ok: true,
    status: 200,
    data: result,
  };
};

const paystack_webhook_events_listener = async (req) => {
  let { body, db } = req;

  let hash_ = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET)
    .update(JSON.stringify(body))
    .digest("hex");

  let test_hash_ = crypto
    .createHmac("sha512", process.env.PAYSTACK_TEST_SECRET)
    .update(JSON.stringify(body))
    .digest("hex");

  const EventLogs = await db.folder("Event_logs");
  await EventLogs.insertOne(body);
  console.log("Paystack webhook body inserted", {
    event: body.event,
    reference: body.data?.reference,
  });

  console.log("Paystack signature check", {
    received: req.headers["x-paystack-signature"],
    expected: [test_hash_, hash_],
  });

  if ([test_hash_, hash_].includes(req.headers["x-paystack-signature"])) {
    console.log("Paystack signature valid", body.event);
    if (body.event === "charge.success") {
      console.log("Processing charge.success", body.data.reference);
      let customer = body.data.customer;
      let customer_hash = hash(customer.customer_code);
      console.log("Customer code hash", customer_hash);
      let virtual_account = await (
        await db.folder("Virtual_accounts")
      ).findOne({ _id: customer_hash });
      console.log("Virtual account lookup", {
        found: !!virtual_account,
        virtual_account_id: virtual_account?._id,
      });

      let value = body.data.amount / 100;
      console.log("Charge amount converted", value);
      if (virtual_account) {
        console.log("Crediting wallet", { user: virtual_account.user, value });
        await credit_wallet(virtual_account.user, value, {
          authorization: body.data.authorization,
          db,
        });
      } else {
        console.log(
          "No virtual account found, saving payment ref",
          body.data.reference,
        );
        await (
          await db.folder("Payment_refs")
        ).updateOne(
          { _id: body.data.reference },
          { $set: body.data },
          { upsert: true },
        );

        let Pending_deliveries = await db.folder("Pending_deliveries");
        let exists = await Pending_deliveries.findOne({
          _id: body.data.reference,
        });
        console.log("Pending delivery check", {
          reference: body.data.reference,
          exists: !!exists,
        });

        if (exists) {
          console.log(
            "Creating delivery from pending delivery",
            exists.delivery_details,
          );
          await create_delivery(
            { ...exists.delivery_details, profile: exists.profile },
            {
              db,
              from_webhook: true,
            },
          );
        }
      }
    }
    return {
      status: 200,
      ok: true,
    };
  } else
    return {
      status: 403,
      ok: false,
    };
};

export { paystack_webhook_events_listener, credit_wallet, courier_webhook };
