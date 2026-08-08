import {
  get_paystack_banks,
  resolve_bank_account,
  transfer_to_bank,
} from "../../libs/utils/payment_gateway.js";

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

  let skip = (page - 1) / limit;

  let data = await txs
    .find({ wallet })
    .sort({ created: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  let total = await txs.countDocuments({ wallet });

  return {
    ok: true,
    message: "Transactions retrieved",
    data,
    pagination: {
      page: skip + 1,
      pages: Math.ceil(total / limit),
      skip,
      limit,
      total,
    },
  };
};

const get_banks = async (req) => {
  try {
    const banks = await get_paystack_banks();

    return {
      ok: true,
      message: "Banks retrieved successfully",
      data: banks,
    };
  } catch (err) {
    console.error("[get_banks]", err);

    return {
      ok: false,
      status: 500,
      message: err.message || "Failed to retrieve banks",
    };
  }
};

const add_bank_account = async (req) => {
  const { headers, db, body } = req;
  const { profile } = headers;

  const { account_number, bank_code } = body;

  if (!account_number || !bank_code) {
    return {
      ok: false,
      status: 400,
      message: "Account number and bank code are required",
    };
  }

  try {
    // Verify the bank account with Paystack
    const account = await resolve_bank_account(account_number, bank_code);

    if (!account?.account_name) {
      return {
        ok: false,
        status: 400,
        message: "Unable to verify bank account",
      };
    }

    const Bank_accounts = await db.folder("Bank_accounts");

    // Prevent duplicate account for this user
    const existing = await Bank_accounts.findOne({
      user_id: profile._id,
      account_number,
      bank_code,
    });

    if (existing) {
      return {
        ok: true,
        message: "Bank account already added",
        data: existing,
      };
    }

    const bank_account = {
      _id: crypto.randomUUID(),
      user_id: profile._id,
      account_number,
      bank_code,
      account_name: account.account_name,
      created: Date.now(),
    };

    await Bank_accounts.insertOne(bank_account);

    return {
      ok: true,
      message: "Bank account added successfully",
      data: bank_account,
    };
  } catch (err) {
    console.error("[add_bank_account]", err);

    return {
      ok: false,
      status: 400,
      message: err.message || "Unable to verify bank account",
    };
  }
};

const withdraw = async (req) => {
  const { headers, db, body } = req;
  const { profile } = headers;

  const { amount, bank_account_id, reason = "Wallet withdrawal" } = body;

  if (!amount || amount <= 0) {
    return {
      ok: false,
      status: 400,
      message: "Invalid withdrawal amount",
    };
  }

  try {
    // Get wallet
    const Wallets = await db.folder("Wallets");

    const wallet = await Wallets.findOne({
      _id: profile._id,
    });

    if (!wallet) {
      return {
        ok: false,
        status: 404,
        message: "Wallet not found",
      };
    }

    // Check balance
    if (wallet.balance < amount) {
      return {
        ok: false,
        status: 400,
        message: "Insufficient wallet balance",
      };
    }

    // Get user's saved bank account
    const Bank_accounts = await db.folder("Bank_accounts");

    const bank_account = await Bank_accounts.findOne({
      _id: bank_account_id,
      user_id: profile._id,
    });

    if (!bank_account) {
      return {
        ok: false,
        status: 404,
        message: "Bank account not found",
      };
    }

    // Initiate Paystack transfer
    const transfer = await transfer_to_bank({
      name: bank_account.account_name,
      account_number: bank_account.account_number,
      bank_code: bank_account.bank_code,
      amount,
      reason,
    });

    const reference = transfer.reference;

    // Deduct wallet only after Paystack accepts the transfer
    await Wallets.updateOne(
      { _id: profile._id },
      {
        $inc: {
          balance: -amount,
        },
      },
    );

    // Record withdrawal
    const Transactions = await db.folder("Transactions");

    const transaction = {
      _id: crypto.randomUUID(),
      wallet: profile._id,
      type: "withdrawal",
      amount,
      status: transfer.status || "pending",
      reference,
      bank_account_id,
      created: Date.now(),
    };

    await Transactions.insertOne(transaction);

    return {
      ok: true,
      message: "Withdrawal initiated successfully",
      data: {
        ...transaction,
        transfer,
      },
    };
  } catch (err) {
    console.error("[withdraw]", err);

    return {
      ok: false,
      status: 500,
      message: err.message || "Withdrawal failed",
    };
  }
};

const get_bank_accounts = async (req) => {
  const { headers, db } = req;
  const { profile } = headers;

  const Bank_accounts = await db.folder("Bank_accounts");

  const data = await Bank_accounts.find({ user_id: profile._id })
    .sort({ created: -1 })
    .toArray();

  return {
    ok: true,
    message: "Bank accounts retrieved successfully",
    data,
  };
};

const delete_bank_account = async (req) => {
  const { headers, db, body } = req;
  const { profile } = headers;

  const { bank_account_id } = body;

  if (!bank_account_id) {
    return {
      ok: false,
      status: 400,
      message: "Bank account ID is required",
    };
  }

  const Bank_accounts = await db.folder("Bank_accounts");

  const result = await Bank_accounts.deleteOne({
    _id: bank_account_id,
    user_id: profile._id,
  });

  if (!result.deletedCount) {
    return {
      ok: false,
      status: 404,
      message: "Bank account not found",
    };
  }

  return {
    ok: true,
    message: "Bank account deleted successfully",
  };
};

export {
  delete_bank_account,
  get_bank_accounts,
  get_wallet,
  transactions,
  withdraw,
  get_banks,
  add_bank_account,
};
