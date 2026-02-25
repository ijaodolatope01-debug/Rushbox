import { DB } from "./conn.js";

const USERS = async () => {
  let fold = await DB().collection("Users");

  return fold;
};

const ORDERS = async () => {
  let fold = await DB().collection("Orders");

  return fold;
};

const WALLETS = async () => {
  let fold = await DB().collection("Wallets");

  return fold;
};

const OTPS = async () => {
  let fold = await DB().collection("Otps");

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

const PAYMENT_REFS = async () => {
  let fold = await DB().collection("Payment_refs");

  return fold;
};

const ESTIMATES = async () => {
  let fold = await DB().collection("Estimates");

  return fold;
};

const PENDING_DELIVERIES = async () => {
  let fold = await DB().collection("Pending_deliveries");

  return fold;
};

export {
  USERS,
  ORDERS,
  WALLETS,
  VIRTUAL_ACCOUNTS,
  EVENT_LOGS,
  TRANSACTIONS,
  ESTIMATES,
  PENDING_DELIVERIES,
  PAYMENT_REFS,
  OTPS,
};
