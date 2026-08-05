import { credit_wallet } from "./wallet.js";

const handle_payment_ref = async (payment_reference, delivery_details, db) => {
  let Refs = await db.folder("Payment_refs");
  let ref = await Refs.findOne({ _id: payment_reference });

  if (!ref) {
    const Pending = await db.folder("Pending_deliveries");
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
    db,
  });

  return wallet;
};

async function initializePaystackTransaction({
  email,
  amount,
  reference,
  callbackUrl,
  metadata = {},
}) {
  const response = await fetch(
    "https://api.paystack.co/transaction/initialize",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_TEST_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount, // Amount in the smallest currency unit (e.g. Kobo)
        reference,
        callback_url: callbackUrl,
        metadata,
      }),
    },
  );

  const data = await response.json();

  console.log(data, "paystack transaction initialization response");

  if (!response.ok || !data.status) {
    throw new Error(
      data.message || "Failed to initialize Paystack transaction",
    );
  }

  return data.data;
}

export { handle_payment_ref, initializePaystackTransaction };
