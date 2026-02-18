import crypto from "crypto";
import {
  EVENT_LOGS,
  PAYMENT_REFS,
  PENDING_DELIVERIES,
  TRANSACTIONS,
  VIRTUAL_ACCOUNTS,
  WALLETS,
} from "../ds/folders.js";
import { hash } from "./auth.js";
import { create_delivery } from "./delivery.js";
import { credit_wallet } from "../services/wallet.js";

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

export { paystack_webhook_events_listener, credit_wallet };
