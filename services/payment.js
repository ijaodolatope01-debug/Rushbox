import { PAYMENT_REFS, PENDING_DELIVERIES } from "../ds/folders.js";
import { credit_wallet } from "./wallet.js";

const handle_payment_ref = async (payment_reference, delivery_details) => {
  let Refs = await PAYMENT_REFS();
  let ref = await Refs.findOne({ _id: payment_reference });

  console.log(ref, payment_reference);

  if (!ref) {
    const Pending = await PENDING_DELIVERIES();
    const result = await Pending.updateOne(
      { _id: payment_reference },
      { $setOnInsert: { delivery_details, created: Date.now() } },
      { upsert: true },
    );

    // result.upsertedId is set when a new doc was inserted
    if (result.upsertedId) return "PENDING";

    // If no upsert happened, the document already existed — handle as needed
    return "ALREADY_PENDING";
  }

  await Refs.deleteOne({ _id: payment_reference });

  let user = delivery_details.user_id;

  let wallet = await credit_wallet(user, ref.amount / 100, {
    authorization: ref.authorization,
  });

  console.log(wallet, "hola");

  return wallet;
};

export { handle_payment_ref };
