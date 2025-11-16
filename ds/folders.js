import { DB } from "./conn.js";

const USERS = async () => {
  let fold = await DB().collection("Users");

  return fold;
};

const ORDERS = async (user_id, status) => {
  let fold = await DB().collection(
    "Orders_".concat(`${user_id}_`).concat(status)
  );

  return fold;
};

const WALLETS = async () => {
  let fold = await DB().collection("Wallets");

  return fold;
};

const VIRTUAL_ACCOUNTS = async () => {
  let fold = await DB().collection("Virtual_Accounts");

  return fold;
};

const EVENT_LOGS = async () => {
  let fold = await DB().collection("Event_Logs");

  return fold;
};

const TRANSACTIONS = async (wallet) => {
  let fold = await DB().collection("Transactions:" + wallet);

  return fold;
};

export { USERS, ORDERS, WALLETS, VIRTUAL_ACCOUNTS, EVENT_LOGS, TRANSACTIONS };
