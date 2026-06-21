import crypto from "crypto";
import {
  EVENT_LOGS,
  PAYMENT_REFS,
  PENDING_DELIVERIES,
  VIRTUAL_ACCOUNTS,
} from "../ds/folders.js";
import { hash } from "./auth.js";
import { create_delivery } from "./delivery.js";
import { credit_wallet } from "../services/wallet.js";
import { webhook_courier } from "./couriers/index.js";
import { send_notification } from "./push_noti.js";
import { STATUSES_MESSAGE } from "./couriers/statuses_map.js";

const courier_webhook = async (req, res) => {
  let { courier } = req.params;

  let handler = webhook_courier[courier];

  if (!handler) {
    return res.send(200);
  }

  let result = await handler(req, res);
  if (!result) {
    return res.send(403);
  }

  if (result?.order) {
    let { user_id, ongoing_status, _id } = result.order;
    await send_notification(user_id, {
      title: "Order status",
      text: STATUSES_MESSAGE[ongoing_status],
      _id: crypto.randomUUID(),
      type: "ongoing_order",
      user_id,
      data: { order_id: _id },
    });

    try {
      await fetch(`https://livechat.rushbox.biz/send_event`, {
        method: "POST",
        headers: {
          "Content-type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          user: user_id,
          name: "ongoing_order_statud",
          payload: {
            order_id: _id,
            user_id,
            ongoing_status,
            time: result.order[ongoing_status],
          },
        }),
      });
    } catch {}
  }
  res.send(200);
};

const paystack_webhook_events_listener = async (req, res) => {
  let { body } = req;
  let hash_ = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET)
    .update(JSON.stringify(body))
    .digest("hex");

  let test_hash_ = crypto
    .createHmac("sha512", process.env.PAYSTACK_TEST_SECRET)
    .update(JSON.stringify(body))
    .digest("hex");

  await (await EVENT_LOGS()).insertOne(body);

  if ([test_hash_, hash_].includes(req.headers["x-paystack-signature"])) {
    if (body.event === "charge.success") {
      let customer = body.data.customer;
      let customer_hash = hash(customer.customer_code);
      let virtual_account = await (
        await VIRTUAL_ACCOUNTS()
      ).findOne({ _id: customer_hash });

      let value = body.data.amount / 100;
      if (virtual_account) {
        await credit_wallet(virtual_account.user, value, {
          authorization: body.data.authorization,
        });
      } else {
        await (
          await PAYMENT_REFS()
        ).insertOne({ _id: body.data.reference, ...body.data });

        let Pending_deliveries = await PENDING_DELIVERIES();
        let exists = await Pending_deliveries.findOne({
          _id: body.data.reference,
        });

        if (exists) {
          await create_delivery(exists.delivery_details);
        }
      }
    }
    res.send(200);
  } else res.send(403);
};

export { paystack_webhook_events_listener, credit_wallet, courier_webhook };
