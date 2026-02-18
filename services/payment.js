import { PAYMENT_REFS, PENDING_DELIVERIES } from "../ds/folders.js";
import { credit_wallet } from "./wallet.js";

const handle_payment_ref = async (payment_reference, delivery_details) => {
  let Refs = await PAYMENT_REFS();
  let ref = await Refs.findOne({ _id: payment_reference });

  if (!ref) {
    await (
      await PENDING_DELIVERIES()
    ).insertOne({ _id: payment_reference, delivery_details });
    return "PENDING";
  }

  await Refs.deleteOne({ _id: payment_reference });

  let user = delivery_details.user_id;

  let wallet = await credit_wallet(user, ref.amount / 100, {
    authorization: ref.authorization,
  });

  return wallet;
};

export { handle_payment_ref };
