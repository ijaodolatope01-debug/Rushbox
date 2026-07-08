import { handle_bank_account } from "../../libs/utils/payment_gateway.js";
import { hash } from "../v1/auth.js";

const request_otp = async (req) => {
  let { body, db, services } = req;
  let { phone } = body;

  // let reslt = await request_otp_(phone, user_id);
  let Profile = await services("profiles");
  let Rus_continuation_token = await db.folder("Rus:continuation_tokens");

  let is_signup = await Rus_continuation_token.findOne({
    phone,
    type: "signup",
  });
  let type = "signin";
  let response = is_signup
    ? { ok: false, message: "is signup" }
    : await Profile.call("signin", {
        profile_type: process.env.USER_PROFILE_TYPE,
        meta_payload: {
          channel: "phone",
        },
        credentials: {
          phone,
          password: process.env.RUSHBOX_DEFAULT_PASSWORD,
        },
      });

  if (!response.ok) {
    if (
      response.message === "Invalid credentials" ||
      response.message === "is signup" ||
      response.message?.includes("already in use")
    ) {
      type = "signup";
      response = await Profile.call("signup", {
        profile_type: process.env.USER_PROFILE_TYPE,
        details: {
          phone,
        },
        meta_payload: {
          channel: "phone",
        },
        password: process.env.RUSHBOX_DEFAULT_PASSWORD,
      });
    }
  }

  if (response.ok) {
    await Rus_continuation_token.updateOne(
      {
        phone,
      },
      {
        $set: {
          type,
          data: response.data,
        },
        $setOnInsert: {
          _id: crypto.randomUUID(),
          created: Date.now(),
        },
      },
      { upsert: true },
    );
  }
  return {
    ok: response.ok || false,
    message: response.message,
    data: { phone },
  };
};

const signin = async (req) => {
  let { body, services, db } = req;
  let { code, phone } = body;

  let Cont_tokens = await db.folder("Rus:continuation_tokens");
  let val = await Cont_tokens.findOne({ phone });

  let Profile = await services("profiles");
  let response = await Profile.call(
    val?.type === "signin" ? "two_factor_signin" : "two_factor_signup",
    {
      continuation_token: val.data.continuation_token,
      otp: code,
      profile_type: process.env.USER_PROFILE_TYPE,
    },
  );

  if (response.ok) {
    await Cont_tokens.deleteOne({ _id: val._id });
  }

  return response;
};

const email_signin = async (req) => {
  let { db, body, services } = req;
  let { social } = body;

  let Profile = await services("profiles");
  let res = await Profile.call("signup", {
    social,
    profile_type: process.env.USER_PROFILE_TYPE,
    password: process.env.RUSHBOX_DEFAULT_PASSWORD,
  });

  return res;
};

const update_phone = async (req) => {
  let { headers, db, body, services } = req;
  let { phone } = body;

  let Profile = await services("profiles");
  let res = await Profile.call(
    "update_profile_identity",
    {
      identity: { phone },
    },
    { token: headers.authorization },
  );

  if (res.ok) {
    let Rus_continuation_token = await db.folder("Rus:continuation_tokens");

    await Rus_continuation_token.updateOne(
      {
        phone,
        type: "update_identity",
      },
      {
        $set: {
          data: res.data,
        },
        $setOnInsert: {
          _id: crypto.randomUUID(),
          created: Date.now(),
        },
      },
      { upsert: true },
    );
  }

  return {
    ok: res.ok,
    message: res.message,
    data: { phone },
  };
};

const update_email = async (req) => {
  let { body, db, headers, services } = req;
  let { authorization, profile } = headers;
  let { social } = body;

  let Profile = await services("profiles");
  let res = await Profile.call(
    "update_social_identity",
    {
      social,
    },
    { token: authorization },
  );

  if (res.ok) {
    if (!profile.email) {
      await handle_bank_account(res.data, db);
    }
  }

  return res;
};

const confirm_phone_update = async (req) => {
  let { headers, db, services, body } = req;
  let { phone, code } = body;
  let { profile } = headers;

  let Rus_continuation_token = await db.folder("Rus:continuation_tokens");
  let tok = await Rus_continuation_token.findOne({
    phone,
    type: "update_identity",
  });

  if (!tok) {
    return {
      ok: false,
      message: "No token",
    };
  }

  let Profile = await services("profiles");
  let res = await Profile.call(
    "confirm_update_profile_identity",
    {
      continuation_token: tok?.data?.continuation_token,
      otp: code,
    },
    {
      token: headers.authorization,
    },
  );

  if (res.ok && !profile?.phone) {
    await handle_bank_account(res.data, db);
  }

  return res;
};

const create_api_key = async (req) => {
  let { headers, services, body } = req;
  let { profile, authorization } = headers;
  let { name } = body;

  let res = await (
    await services("profiles")
  ).call(
    "refresh_profile_key",
    {
      name,
    },
    { token: authorization },
  );

  return res;
};

const retrieve_keys = async (req) => {
  let { headers, services, body } = req;
  let { profile, authorization } = headers;

  let res = await (
    await services("profiles")
  ).call("retrieve_profile_keys", null, { token: authorization });

  return res;
};

const delete_key = async (req) => {
  let { headers, services, body } = req;
  let { profile, authorization } = headers;
  let { name } = body;

  let res = await (
    await services("profiles")
  ).call("revoke_profile_key", { name }, { token: authorization });

  return res;
};

export {
  email_signin,
  signin,
  update_email,
  update_phone,
  request_otp,
  create_api_key,
  retrieve_keys,
  delete_key,
  confirm_phone_update,
};
