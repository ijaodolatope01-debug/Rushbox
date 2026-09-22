import { generate_random_string } from "../../libs/utils/user.js";
import { debug } from "./delivery.js";

const CONTINUATION_TOKEN_TTL = 5 * 60 * 1000; // 5 minutes

const request_otp = async (req) => {
  let { body, db, services } = req;
  let { phone } = body;

  if (phone === process.env.RUSHBOX_DEFAULT_PHONE) {
    return {
      ok: true,
      message: "OTP sent successfully",
      data: { phone },
    };
  }

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

  debug(response, "how");
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
          referral_code: generate_random_string(5, "alnum").toUpperCase(),
          avatar: 1,
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
        type,
      },
      {
        $set: {
          data: response.data,
          updated: Date.now(),
          expiresAt: new Date(Date.now() + CONTINUATION_TOKEN_TTL),
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

  let Profile = await services("profiles");

  if (phone === process.env.RUSHBOX_DEFAULT_PHONE) {
    if (!code || code !== process.env.RUSHBOX_DEFAULT_OTP) {
      return {
        ok: false,
        message: "Invalid OTP",
      };
    }
    let res = await Profile.call("get_profile", {
      profile_type: process.env.USER_PROFILE_TYPE,
      _id: process.env.RUSHBOX_DEFAULT_USER_ID,
    });

    debug(res, "default user profile response");
    return res.ok
      ? {
          ok: true,
          message: "Signed in successfully",
          data: res.data,
        }
      : {
          ok: false,
          message: "Failed to sign in",
        };
  }

  let Cont_tokens = await db.folder("Rus:continuation_tokens");

  let val = await Cont_tokens.findOne({ phone });

  if (!val) {
    return {
      ok: false,
      message: "Code not found",
    };
  }

  let response = await Profile.call(
    val.type === "signin" ? "two_factor_signin" : "two_factor_signup",
    {
      continuation_token: val.data.continuation_token,
      otp: code,
      profile_type: process.env.USER_PROFILE_TYPE,
    },
  );

  if (response.ok) {
    await Cont_tokens.deleteOne({
      _id: val._id,
    });
  }

  return response;
};

const email_signin = async (req) => {
  let { body, services } = req;
  let { social, details } = body;

  let Profile = await services("profiles");

  let res = await Profile.call("signup", {
    social,
    details: {
      ...details,
      referral_code: generate_random_string(5, "alnum").toUpperCase(),
    },
    profile_type: process.env.USER_PROFILE_TYPE,
    password: process.env.RUSHBOX_DEFAULT_PASSWORD,
  });

  return res;
};

const update_phone = async (req) => {
  let { headers, db, body, services, gp } = req;
  let { phone } = body;

  let Profile = await services("profiles");

  let call_update = async () => {
    let res = await Profile.call(
      "update_profile_identity",
      {
        identity: {
          phone,
        },
      },
      {
        token: headers.authorization,
      },
    );

    if (res.ok) {
      let Rus_continuation_token = await db.folder(
        "Rus:continuation_tokens:update_identity",
      );

      await Rus_continuation_token.updateOne(
        {
          phone,
          type: "update_identity",
        },
        {
          $set: {
            data: res.data,
            updated: Date.now(),
            expiresAt: new Date(Date.now() + CONTINUATION_TOKEN_TTL),
          },
          $setOnInsert: {
            _id: crypto.randomUUID(),
            created: Date.now(),
          },
        },
        {
          upsert: true,
        },
      );
    }

    return res;
  };
  let res = await call_update();

  if (!res.ok) {
    if (res.status_code === "identity_already_in_use") {
      let ans = await Profile.call("get_profiles", {
        profile_type: process.env.USER_PROFILE_TYPE,
        filter: {
          phone,
        },
      });

      ans = ans.ok && ans.data[0];

      if (ans && !ans.email) {
        let d = await Profile.call("mark_for_deletion", {
          profile_id: ans._id,
          profile_type: process.env.USER_PROFILE_TYPE,
          category: "merge",
        });

        if (d.ok) {
          res = await call_update();
          await gp.route_table.remove_auth_cache(ans._id);
        }
      }
    }
  }

  return {
    ok: res.ok,
    message: res.message,
    status_code: res.status_code,
    data: {
      phone,
    },
  };
};

const update_email = async (req) => {
  let { body, headers, services, gp } = req;
  let { authorization } = headers;
  let { social } = body;

  let Profile = await services("profiles");

  let call_update = async () => {
    let res = await Profile.call(
      "update_social_identity",
      {
        social,
      },
      {
        token: authorization,
      },
    );

    if (res.ok) {
      if (res.data?.marked_for_deletion) {
        await Profile.call("remove_from_deletion", {
          profile_id: res.data._id,
          profile_type: process.env.USER_PROFILE_TYPE,
        });

        await gp.route_table.remove_auth_cache(res.data._id);
      }
    }

    return res;
  };

  let res = await call_update();

  if (!res.ok) {
    if (res.status_code === "identity_already_in_use") {
      let profil = await Profile.call("get_profiles", {
        ids: [res.data.profile_id],
        profile_type: process.env.USER_PROFILE_TYPE,
        filter: {},
      });

      if (profil.ok) {
        profil = profil.data[0];

        if (profil && !profil.phone) {
          let d = await Profile.call("mark_for_deletion", {
            profile_id: profil._id,
            profile_type: process.env.USER_PROFILE_TYPE,
            category: "merge",
          });

          if (d.ok) {
            res = await call_update();
            await gp.route_table.remove_auth_cache(profil._id);
          }
        }
      }
    }
  }

  return res;
};

const confirm_phone_update = async (req) => {
  let { headers, db, services, body, gp } = req;
  let { phone, code } = body;
  let { profile } = headers;

  let Rus_continuation_token = await db.folder(
    "Rus:continuation_tokens:update_identity",
  );

  let tok = await Rus_continuation_token.findOne({
    phone,
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
      continuation_token: tok.data.continuation_token,
      otp: code,
    },
    {
      token: headers.authorization,
    },
  );

  if (res.ok) {
    await Rus_continuation_token.deleteOne({
      _id: tok._id,
    });

    if (res.data?.marked_for_deletion) {
      await Profile.call("remove_from_deletion", {
        profile_id: res.data._id,
        profile_type: process.env.USER_PROFILE_TYPE,
      });
      await gp.route_table.remove_auth_cache(res.data._id);
    }
  }

  return res;
};

const refresh_api_key = async (req) => {
  let { headers, services, query } = req;
  let { authorization, profile } = headers;
  let { staging } = query;

  let res = await (
    await services("profiles")
  ).call(
    "refresh_profile_key",
    {
      name: staging ? `test:${profile._id}` : profile._id,
    },
    {
      token: authorization,
    },
  );

  return res;
};

const retrieve_keys = async (req) => {
  let { headers, services, query } = req;
  let { authorization } = headers;
  let { context } = query;

  let res = await (
    await services("profiles")
  ).call(
    "retrieve_profile_keys",
    ["live", "staging"].includes(context)
      ? { name: context === "live" ? profile._id : `test:${profile._id}` }
      : null,
    {
      token: authorization,
    },
  );

  return res;
};

const agent_signin = async (req) => {
  let { headers, services, body } = req;
  let { email, password } = body;

  let Profile = await services("profiles");

  let res = await Profile.call("signin", {
    profile_type: process.env.ADMIN_PROFILE_TYPE,
    credentials: {
      email,
      password,
    },
  });

  return res;
};

const confirm_agent_signin = async (req) => {
  let { headers, services, body } = req;
  let { continuation_token, otp } = body;

  let Profile = await services("profiles");

  let res = await Profile.call("two_factor_signin", {
    profile_type: process.env.ADMIN_PROFILE_TYPE,
    continuation_token,
    otp,
  });

  return res;
};

export {
  email_signin,
  agent_signin,
  signin,
  confirm_agent_signin,
  update_email,
  update_phone,
  request_otp,
  refresh_api_key,
  retrieve_keys,
  confirm_phone_update,
};
