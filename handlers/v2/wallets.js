import {
  get_paystack_banks,
  resolve_bank_account,
  transfer_to_bank,
} from "../../libs/utils/payment_gateway.js";
import crypto from "crypto";

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

  let skip = (page - 1) * limit;

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

const validate_bank_account = async (req) => {
  const { body } = req;

  const { account_number, bank_code } = body;

  if (!account_number || !bank_code) {
    return {
      ok: false,
      status: 400,
      message: "Account number and bank code are required",
    };
  }

  try {
    const account = await resolve_bank_account(account_number, bank_code);

    return {
      ok: true,
      message: "Account resolved successfully",
      data: {
        account_number: account.account_number,
        account_name: account.account_name,
        bank_code,
      },
    };
  } catch (err) {
    return {
      ok: false,
      status: 400,
      message: err.message || "Unable to resolve account",
    };
  }
};

const withdraw = async (req) => {
  const { headers, db, body, services } = req;
  const { profile } = headers;

  const { amount, bank_account_id, reason = "Wallet withdrawal" } = body;

  if (!amount || amount <= 0) {
    return {
      ok: false,
      status: 400,
      status_code: "invalid_amount",
      message: "Invalid withdrawal amount",
    };
  }

  const Wallets = await db.folder("Wallets");

  const wallet = await Wallets.findOne({
    _id: profile._id,
  });

  if (!wallet) {
    return {
      ok: false,
      status: 404,
      status_code: "wallet_not_found",
      message: "Wallet not found",
    };
  }

  if (wallet.balance < amount) {
    return {
      ok: false,
      status: 400,
      status_code: "insufficient_balance",
      message: "Insufficient wallet balance",
    };
  }

  const Bank_accounts = await db.folder("Bank_accounts");

  const bank_account = await Bank_accounts.findOne({
    _id: bank_account_id,
    user_id: profile._id,
  });

  if (!bank_account) {
    return {
      ok: false,
      status: 404,
      status_code: "bank_account_not_found",
      message: "Bank account not found",
    };
  }

  let otp = crypto.randomInt(0, 10000).toString().padStart(4, "0");

  let Cont = await db.folder("Wallet_continuation_tokens");

  let obj = {
    _id: crypto.randomUUID(),
    type: "otp",
    channel: "email",
    code: otp,
    created: Date.now(),
    profile: profile._id,
    total: 5,
    payload: {
      bank_account_id,
      amount,
      reason,
    },
  };

  let ress = await (
    await services("aimail")
  ).call("send_mail", {
    to: profile.email,
    from: "Rushbox Logistics",
    content: {
      template: "otp-2fa-wallet-withdrawal",
      params: {
        otp,
        expiry: 5,
        profile,
        platform: {
          name: "Rushbox Logistics",
        },
      },
    },
  });

  if (!ress?.ok) {
    return ress;
  }

  // Remove any previous withdrawal tokens for this profile
  await Cont.deleteMany({
    profile: profile._id,
  });

  // Store the new token
  await Cont.insertOne(obj);

  return {
    ok: true,
    status: 200,
    status_code: "withdrawal_2fa_initiated",
    message: "Withdrawal verification initiated",
    data: {
      continuation_token: obj._id,
      two_factor_auth: {
        type: obj.type,
        channel: obj.channel,
      },
    },
  };
};

const validate_otp = async ({ db, profile_id, continuation_token, code }) => {
  const Cont = await db.folder("Wallet_continuation_tokens");

  const token = await Cont.findOne({
    _id: continuation_token,
    profile: profile_id,
    type: "otp",
    channel: "email",
  });

  if (!token) {
    return {
      ok: false,
      status: 400,
      status_code: "invalid_continuation_token",
      message: "Invalid or expired verification",
    };
  }

  if (Date.now() > token.created + 5 * 60 * 1000) {
    await Cont.deleteOne({ _id: token._id });

    return {
      ok: false,
      status: 400,
      status_code: "otp_expired",
      message: "Verification code has expired",
    };
  }

  if (token.code !== String(code)) {
    const total = (token.total ?? 0) - 1;

    if (total <= 0) {
      await Cont.deleteOne({ _id: token._id });

      return {
        ok: false,
        status: 400,
        status_code: "otp_attempts_exceeded",
        message: "Too many incorrect attempts",
      };
    }

    await Cont.updateOne({ _id: token._id }, { $set: { total } });

    return {
      ok: false,
      status: 400,
      status_code: "invalid_otp",
      message: `Invalid verification code. ${total} attempt${total === 1 ? "" : "s"} left`,
    };
  }

  // Successful OTP — consume the token.
  await Cont.deleteOne({ _id: token._id });

  return {
    ok: true,
    status: 200,
    status_code: "otp_valid",
    message: "Verification successful",
    data: token,
  };
};

const confirm_withdraw = async (req) => {
  const { headers, db, body, services } = req;
  const { profile } = headers;
  const { continuation_token, code } = body;

  let res = await validate_otp({
    db,
    profile_id: profile._id,
    continuation_token,
    code,
  });

  if (!res.ok) {
    return res;
  }

  let { bank_account_id, reason, amount } = res.data?.payload;

  const Wallets = await db.folder("Wallets");

  const wallet = await Wallets.findOne({
    _id: profile._id,
  });

  if (!wallet) {
    return {
      ok: false,
      status: 404,
      status_code: "wallet_not_found",
      message: "Wallet not found",
    };
  }

  const Bank_accounts = await db.folder("Bank_accounts");

  const bank_account = await Bank_accounts.findOne({
    _id: bank_account_id,
    user_id: profile._id,
  });

  if (!bank_account) {
    return {
      ok: false,
      status: 404,
      status_code: "bank_account_not_found",
      message: "Bank account not found",
    };
  }

  const debit = await Wallets.updateOne(
    {
      _id: profile._id,
      balance: { $gte: amount },
    },
    {
      $inc: {
        balance: -amount,
      },
    },
  );

  if (!debit.modifiedCount) {
    return {
      ok: false,
      status: 400,
      status_code: "insufficient_balance",
      message: "Insufficient wallet balance",
    };
  }

  try {
    const transfer = await transfer_to_bank({
      name: bank_account.account_name,
      account_number: bank_account.account_number,
      bank_code: bank_account.bank_code,
      amount,
      reason,
    });

    const Transactions = await db.folder("Transactions");

    const transaction = {
      _id: crypto.randomUUID(),
      wallet: profile._id,
      type: "withdrawal",
      amount,
      status: transfer.status || "pending",
      reference: transfer.reference,
      bank_account_id,
      created: Date.now(),
    };

    await Transactions.insertOne(transaction);

    const ress = await (
      await services("aimail")
    ).call("send_mail", {
      to: profile.email,
      from: "Rushbox Logistics",
      content: {
        template: "wallet-withdrawal-receipt",
        params: {
          banner: "https://rushbox.biz/banner.jpeg",
          profile,
          transaction,
          bank_account,
          platform: {
            name: "Rushbox Logistics",
          },
        },
      },
    });

    return {
      ok: true,
      status: 200,
      status_code: "withdrawal_successful",
      message: "Withdrawal initiated successfully",
      data: {
        ...transaction,
        transfer,
        email: ress,
      },
    };
  } catch (err) {
    await Wallets.updateOne(
      {
        _id: profile._id,
      },
      {
        $inc: {
          balance: amount,
        },
      },
    );

    return {
      status: 403,
      message: err.message,
      ok: false,
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
  confirm_withdraw,
  add_bank_account,
  validate_bank_account,
};
