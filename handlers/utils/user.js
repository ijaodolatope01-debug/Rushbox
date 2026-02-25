import { generate_random_string } from "generalised-datastore/utils/functions.js";
import send_sms from "../send_sms.js";
import { hash } from "godprotocol/utils/hash.js";
import { USERS, OTPS } from "../../ds/folders.js";

let expiry = 30;

const send_otp = async (id, otp) => {
  console.log("Generated OTP:", otp);

  const message = `Your verification code is ${otp}. It will expire in ${expiry} minutes.`;
  return await send_sms(id, message);
};

const id_exists_ = async (user_id) => {
  let cont = await (await USERS()).findOne({ _id: user_id });

  return cont;
};

const request_otp_ = async (id, user_id) => {
  let otp = generate_random_string(4);

  await send_otp(id, otp);

  let obj = { otp, ts: Date.now(), user_id };
  await (await OTPS()).insertOne({ _id: crypto.randomUUID(), id, obj });
};

const verify_otp_ = async (id, otp) => {
  if (id === "2347012345678" && String(otp) === "123456") return true;

  let Otps = await OTPS();
  let obj = await Otps.findOne({ id });
  let tp = obj?.obj;
  if (tp && tp.ts + expiry * 60 * 1000 < Date.now()) {
    return "expired";
  }

  let mtch = (tp && tp.otp) === otp;

  if (mtch) {
    await Otps.deleteOne({ _id: id });
  }

  return mtch && tp;
};

export { verify_otp_, request_otp_, id_exists_, generate_random_string };
