const get_wallet = async (req) => {
  let { headers, db } = req;
  let { profile } = headers;
  let user_id = profile._id;

  let wallet = await (await db.folder("Wallets")).findOne({ _id: user_id });
  if (!wallet) {
    return {
      ok: false,
      message: "Wallet not found",
      status: 401,
    };
  }
  wallet.virtual_account = await (
    await db.folder("Virtual_accounts")
  ).findOne({ _id: wallet.virtual_account });

  return {
    ok: !!wallet,
    message: wallet ? "Wallet fetched successfully" : "Wallet not found",
    data: wallet || null,
  };
};

const transactions = async (req) => {
  let { headers, db, body } = req;

  let { profile } = headers;
  let wallet = profile._id;
  let { page, limit } = body;

  let txs = await db.folder("Transactions");

  let data = await txs
    .find({ wallet })
    .sort({ created: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  let total = await txs.countDocuments({ wallet });

  return {
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
  };
};

export { get_wallet, transactions };
