import { TRANSACTIONS, WALLETS } from "../ds/folders.js";

async function charge_wallet(user_id, value, order_id) {
  const Wallets = await WALLETS();
  const wallet = await Wallets.findOne({ _id: user_id });

  if (!wallet) return { ok: false, message: "Wallet not found" };

  if (wallet.balance < value)
    return { ok: false, message: "Insufficient balance" };

  await Wallets.updateOne({ _id: user_id }, { $inc: { balance: -value } });

  await (
    await TRANSACTIONS(user_id)
  ).insertOne({
    title: "Order creation",
    amount: value,
    wallet: user_id,
    misc: { from: { order_id } },
  });

  return { ok: true };
}

const credit_wallet = async (wallet, value, { authorization }) => {
  // update and return the updated wallet document
  const Wallets = await WALLETS();
  const updated = await Wallets.findOneAndUpdate(
    { _id: wallet },
    { $inc: { balance: value } },
    { returnDocument: "after" }, // returns the document after update
  );

  // if wallet not found, updated.value will be null
  if (!updated.value) return null;

  await (
    await TRANSACTIONS(wallet)
  ).insertOne({
    title: "Top-up",
    amount: value,
    wallet,
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

const revert_wallet = async (wallet, value, order_id) => {
  await (
    await WALLETS()
  ).updateOne({ _id: wallet }, { $inc: { balance: value } });

  await (
    await TRANSACTIONS(wallet)
  ).insertOne({
    title: "Order reverted",
    amount: value,
    wallet,
    misc: {
      from: {
        order_id,
      },
    },
  });
};

export { revert_wallet, credit_wallet, charge_wallet };
