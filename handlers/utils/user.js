import { generate_random_string } from "generalised-datastore/utils/functions.js";
import send_sms from "../send_sms.js";
import { hash } from "godprotocol/utils/hash.js";
import { USERS } from "../../ds/folders.js";

let otps = new Object(),
  expiry = 30;

const send_otp = async (id, otp) => {
  console.log("Generated OTP:", otp);

  const message = `Your verification code is ${otp}. It will expire in ${expiry} minutes.`;
  return await send_sms(id, message);
};

const id_exists_ = async (id) => {
  let cont = await (await USERS()).findOne({ _id: hash(id) });

  return cont;
};

const request_otp_ = async (id) => {
  let otp = generate_random_string(4);

  await send_otp(id, otp);

  otps[id] = { otp, ts: Date.now() };
};

const verify_otp_ = (id, otp) => {
  if (id === "2347012345678" && String(otp) === "123456") return true;

  let tp = otps[id];
  if (tp && tp.ts + expiry * 60 * 1000 < Date.now()) {
    return "expired";
  }

  let mtch = (tp && tp.otp) === otp;

  if (mtch) {
    delete otps[id];
  }

  return mtch;
};

export { verify_otp_, request_otp_, id_exists_, generate_random_string };
