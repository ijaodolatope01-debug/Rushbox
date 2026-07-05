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

export {
  create_virtual_account,
  create_customer,
  handle_bank_account,
  fetch_customer,
  update_customer,
};
