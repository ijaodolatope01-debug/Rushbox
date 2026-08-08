import { hash } from "./hash.js";

const result = (data) => {
  return data.status === true ? data.data : null;
};

const create_virtual_account = async (customer) => {
  let payload = {
      customer,
      preferred_bank: "wema-bank",
    },
    res;

  try {
    res = await fetch("https://api.paystack.co/dedicated_account", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    res = await res.json();
  } catch (e) {
    console.log(e);
  }

  return result(res);
};

const create_customer = async (user) => {
  let payload = {
      email: user.email,
      first_name: user.firstname || "Rushbox",
      last_name: user.lastname || "Rushbox",
      phone: `+${user.phone}`,
    },
    data;

  // console.log(payload, "ohhhh");

  try {
    let response = await fetch("https://api.paystack.co/customer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    data = await response.json();
  } catch (error) {
    console.error("Error:", error);
  }

  return result(data);
};

const fetch_customer = async (email) => {
  let data;
  try {
    let response = await fetch(`https://api.paystack.co/customer/${email}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
      },
    });

    data = await response.json();
  } catch (error) {
    console.error("Error:", error);
  }

  return result(data);
};

const update_customer = async (customer, update) => {
  let data;
  try {
    let response = await fetch(`https://api.paystack.co/customer/${customer}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(update),
    });

    data = await response.json();
  } catch (e) {}

  return result(data);
};

const handle_bank_account = async (user_data, db) => {
  let _id = user_data._id;
  let customer = user_data?.email && (await fetch_customer(user_data.email));
  // console.log(customer, "custom");
  if (!customer) {
    customer = await create_customer(user_data);
  }

  let response = await create_virtual_account(customer?.customer_code);
  let virtual_account = {
    number: response.account_number,
    name: response.account_name,
    bank: response.bank,
    customer: customer.customer_code,
    user: _id,
    _id: hash(customer.customer_code),
  };
  try {
    await (await db.folder("Virtual_accounts")).insertOne(virtual_account);
  } catch (e) {}

  let data = {
    _id,
    balance: 0,
    virtual_account: virtual_account._id,
  };
  await (
    await db.folder("Wallets")
  ).replaceOne({ _id }, data, { upsert: true });
};

const PAYSTACK_URL = "https://api.paystack.co";

const paystackRequest = async (endpoint, options = {}) => {
  const response = await fetch(`${PAYSTACK_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok || !data.status) {
    throw new Error(data.message || "Paystack request failed");
  }

  return data;
};

// Get banks available for transfers
const get_paystack_banks = async ({
  country = "nigeria",
  currency = "NGN",
} = {}) => {
  const params = new URLSearchParams({
    country,
    currency,
  });

  const response = await paystackRequest(`/bank?${params}`);

  return response.data;
};

// Transfer money from Paystack balance to a bank account
const transfer_to_bank = async ({
  name,
  account_number,
  bank_code,
  amount,
  reason = "Bank transfer",
  reference = crypto.randomUUID(),
}) => {
  // 1. Create/retrieve the transfer recipient
  const recipient = await paystackRequest("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name,
      account_number,
      bank_code,
      currency: "NGN",
    }),
  });

  const recipient_code = recipient.data.recipient_code;

  // 2. Initiate the transfer
  const transfer = await paystackRequest("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: Math.round(amount * 100),
      recipient: recipient_code,
      reference,
      reason,
      currency: "NGN",
    }),
  });

  return transfer.data;
};

const resolve_bank_account = async (account_number, bank_code) => {
  const params = new URLSearchParams({
    account_number,
    bank_code,
  });

  const response = await paystackRequest(`/bank/resolve?${params.toString()}`);

  return response.data;
};

export {
  create_virtual_account,
  create_customer,
  handle_bank_account,
  fetch_customer,
  update_customer,
  get_paystack_banks,
  transfer_to_bank,
  resolve_bank_account,
};
