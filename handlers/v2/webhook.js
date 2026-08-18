import crypto from "crypto";
import { create_delivery, debug } from "./delivery.js";
import { credit_wallet } from "../../services/wallet.js";
import { webhook_courier } from "../../libs/couriers/index.js";
import { send_notification } from "./push_noti.js";
import { STATUSES_MESSAGE } from "../../libs/couriers/statuses_map.js";
import { hash } from "../../libs/utils/hash.js";

const courier_webhook = async (req) => {
  let { params, db, body, headers } = req;
  let { courier } = params;

  console.log(headers, params);

  let handler = webhook_courier[courier];

  if (!handler) {
    return { ok: true, status: 200 };
  }

  let result = await handler(req, res);
  if (!result) {
    return { status: 403 };
  }

  if (result?.order) {
    let { user_id, ongoing_status, _id } = result.order;
    await send_notification(
      user_id,
      {
        title: "Order status",
        text: STATUSES_MESSAGE[ongoing_status],
        _id: crypto.randomUUID(),
        type: "ongoing_order",
        user_id,
        data: { order_id: _id },
      },
      req,
    );

    let payload = {
      order_id: _id,
      user_id,
      ongoing_status,
      time: result.order[ongoing_status],
    };
    try {
      await fetch(`https://livechat.rushbox.biz/send_event`, {
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
      });
    } catch {}
  }
  return {
    ok: true,
    status: 200,
    data: {
      payload,
    },
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
