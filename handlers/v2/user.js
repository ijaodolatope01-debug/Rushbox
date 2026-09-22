const user = async (req) => {
  let { profile } = req.headers;

  throw new Error("HEy ");
  return {
    ok: true,
    data: profile,
    message: "Profile",
  };
};

const confirm_delete_account = async (req) => {
  let { headers, db, services, body, gp } = req;
  let { phone, code } = body;
  let { profile } = headers;

  let Rus_continuation_token = await db.folder(
    "Rus:continuation_tokens:delete_profile",
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
    "confirm_delete_profile",
    {
      continuation_token: tok?.data?.continuation_token,
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

    await gp.route_table.remove_auth_cache(profile._id);

    if (!profile?.phone) {
      // await handle_bank_account(res.data, db);
    }
  }

  return res;
};

const delete_account = async (req) => {
  let { headers, db, services } = req;
  let { profile } = headers;

  let Profile = await services("profiles");
  let res = await Profile.call(
    "delete_profile",
    {},
    { token: headers.authorization },
  );

  if (res.ok) {
    let Rus_continuation_token = await db.folder(
      "Rus:continuation_tokens:delete_profile",
    );

    await Rus_continuation_token.updateOne(
      {
        phone: profile.phone,
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
  };
};

const update_profile = async (req) => {
  let { headers, body, services, gp } = req;
  let { updates } = body;
  let { debug } = gp.utils;

  let Profile = await services("profiles");

  let res = await Profile.call(
    "update_profile",
    {
      updates,
    },
    { token: headers.authorization },
  );

  if (res.ok) {
    debug(await gp.route_table.remove_auth_cache(res.data._id), "howww");
  }

  return res;
};

export { user, delete_account, confirm_delete_account, update_profile };
