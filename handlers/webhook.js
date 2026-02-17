import crypto from "crypto";
import {
  EVENT_LOGS,
  TRANSACTIONS,
  VIRTUAL_ACCOUNTS,
  WALLETS,
} from "../ds/folders.js";
import { hash } from "./auth.js";

const paystack_webhook_events_listener = async (req, res) => {
  let { body } = req;
  let hash_ = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET)
    .update(JSON.stringify(body))
    .digest("hex");

  await (await EVENT_LOGS()).insertOne(body);
  if (hash_ === req.headers["x-paystack-signature"]) {
    if (body.event === "charge.success") {
      let customer = body.data.customer;
      let customer_hash = hash(customer.customer_code);
      let virtual_account = await (
        await VIRTUAL_ACCOUNTS()
      ).findOne({ _id: customer_hash });
      if (virtual_account) {
        let value = body.data.amount / 100;

        await (
          await WALLETS()
        ).updateOne(
          { _id: virtual_account.user },
          { $inc: { balance: value } },
        );

        let authorization = body.data.authorization;
        let ress = await (
          await TRANSACTIONS(virtual_account.user)
        ).insertOne({
          title: "Top-up",
          amount: value,
          wallet: virtual_account.user,
          misc: {
            from: {
              bank: authorization.bank,
              sender_name: authorization.sender_name,
              account: authorization.sender_bank_account_number,
            },
          },
        });
      }
    }
    res.send(200);
  } else res.send(403);
};

export { paystack_webhook_events_listener };
