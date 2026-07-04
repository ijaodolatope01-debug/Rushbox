import { TRANSACTIONS, VIRTUAL_ACCOUNTS, WALLETS } from "../../ds/folders.js";

const get_wallet = async (req, res) => {
  let { user_id } = req.params;

  let wallet = await (await WALLETS()).findOne({ _id: user_id });
  if (!wallet) {
    return res.json({
      ok: false,
      message: "Wallet not found",
    });
  }
  wallet.virtual_account = await (
    await VIRTUAL_ACCOUNTS()
  ).findOne({ _id: wallet.virtual_account });

  res.json({
    ok: !!wallet,
    message: wallet ? "Wallet fetched successfully" : "Wallet not found",
    data: wallet || null,
  });
};

const deduct = async (req, res) => {
  let { amount, wallet, reason } = req.body;
  amount = Math.abs(Number(amount));

  let Wallet = await WALLETS();
  let data = await Wallet.findOne({ _id: wallet });
  if (!data || data.balance < amount) {
    return res.json({
      ok: false,
      message: !data ? "Wallet not found" : "Insufficient balance",
    });
  }

  await (
    await TRANSACTIONS(wallet)
  ).insertOne({
    title: "Withdrawal",
    wallet,
    amount,
    misc: {
      reason,
    },
  });

  res.json({
    ok: true,
    message: "Balance updated succesfully",
    data: await Wallet.updateOne(
      { _id: wallet },
      { $inc: { balance: -amount } },
    ),
  });
};

const transactions = async (req, res) => {
  let { wallet, skip } = req.body;
  skip = Number(skip) || 0;

  let limit = 20;
  let txs = await TRANSACTIONS(wallet);

  let data = await txs
    .find({})
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  let total = await txs.countDocuments();

  res.json({
    ok: true,
    message: "Transactions retrieved",
    data,
    pagination: {
      page: skip / limit + 1,
      pages: Math.ceil(total / limit),
      skip,
      limit,
      total,
    },
  });
};

export { get_wallet, transactions, deduct };
