async function charge_wallet(user_id, value, order_id, payment_ref, db) {
  const Wallets = await db.folder("Wallets");
  const wallet = await Wallets.findOne({ _id: user_id });

  if (!wallet) return { ok: false, message: "Wallet not found" };

  if (wallet.balance < value)
    return { ok: false, message: "Insufficient balance" };

  await Wallets.updateOne({ _id: user_id }, { $inc: { balance: -value } });

  let misc = { order_id };
  if (payment_ref) misc.payment_ref = payment_ref;

  await (
    await db.folder("Transactions")
  ).insertOne({
    title: "Order creation",
    amount: value,
    wallet: user_id,
    created: Date.now(),
    _id: crypto.randomUUID(),
    misc,
  });

  return { ok: true };
}

const credit_wallet = async (wallet, value, { authorization, db }) => {
  // update and return the updated wallet document
  const Wallets = await db.folder("Wallets");
  const updated = await Wallets.findOneAndUpdate(
    { _id: wallet },
    { $inc: { balance: value } },
    { returnDocument: "after" }, // returns the document after update
  );

  // if wallet not found, updated.value will be null
  if (!updated.value) return null;

  await (
    await db.folder("Transactions")
  ).insertOne({
    _id: crypto.randomUUID(),
    title: "Top-up",
    amount: value,
    wallet,
    created: Date.now(),
    misc: {
      from: {
        bank: authorization.bank,
        sender_name: authorization.sender_name,
        account: authorization.sender_bank_account_number,
      },
    },
  });

  return updated.value;
};

const revert_wallet = async (wallet, value, order_id, db) => {
  await (
    await db.folder("Wallets")
  ).updateOne({ _id: wallet }, { $inc: { balance: value } });

  await (
    await db.folder("Transactions")
  ).insertOne({
    _id: crypto.randomUUID(),
    title: "Order reverted",
    amount: value,
    wallet,
    created: Date.now(),
    misc: {
      order_id,
    },
  });
};

export { revert_wallet, credit_wallet, charge_wallet };
