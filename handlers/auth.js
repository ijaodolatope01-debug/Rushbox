import { hash } from "godprotocol/utils/hash.js";
import { request_otp_, verify_otp_ } from "./utils/user.js";
import { USERS } from "../ds/folders.js";
import { handle_bank_account } from "./utils/payment_gateway.js";

const request_otp = async (req, res) => {
  let { phone, user_id } = req.body;

  let reslt = await request_otp_(phone, user_id);

  res.json({
    ok: true,
    message: "OTP has been sent",
    data: { phone, user_id },
  });
};

const signin = async (req, res) => {
  let { code, phone, user_id } = req.body;

  let very = await verify_otp_(phone, code);

  let message;
  if (very) {
    if (very === "expired") message = "OTP have expired";
    else message = "OTP verified successfully";
  } else message = "OTP verification failed";

  if (message !== "OTP verified successfully") {
    return res.json({
      ok: false,
      message,
    });
  }

  let Users = await USERS();
  let usr = await Users.findOne({ phone });

  if (usr) {
    return res.json({
      ok: true,
      message: "User signed-in",
      data: usr,
    });
  } else {
    if (user_id) {
      let ress = await Users.updateOne(
        { _id: user_id },
        { $set: { phone }, $unset: { is_new: 1 } },
        { returnDocument: "after" },
      );

      usr = ress.value || ress;
      await handle_bank_account(usr);
    } else {
      user_id = crypto.randomUUID();
      usr = { _id: user_id, phone, created: new Date(), is_new: true };
      await Users.insertOne(usr);
    }
  }

  res.json({
    ok: true,
    message: "User signed-in",
    data: usr,
  });
};

const email_signin = async (req, res) => {
  let { email, firstname, lastname } = req.body;

  email = email?.trim().toLowerCase();

  let Users = await USERS();
  let usr = await Users.findOne({ email });

  if (usr) {
    return res.json({
      ok: true,
      message: "User Email Signin",
      data: usr,
    });
  }

  let _id = crypto.randomUUID();
  await Users.insertOne({ email, firstname, lastname, _id, is_new: true });

  res.json({
    ok: true,
    message: "User Profile created",
    data: { _id, email, firstname, lastname, is_new: true },
  });
};

export { email_signin, signin, request_otp, hash };
