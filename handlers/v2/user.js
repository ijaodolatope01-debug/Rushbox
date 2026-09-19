const user = async (req) => {
  let { profile } = req.headers;

  return {
    ok: true,
    data: profile,
    message: "Profile",
  };
};

const confirm_delete_account = async (req) => {
  let { headers, db, services, body } = req;
  let { phone, code } = body;
  let { profile } = headers;

  let Rus_continuation_token = await db.folder(
    "Rus:continuation_tokens:delete_profile",
  );
  let tok = await Rus_continuation_token.findOne({
    phone,
  });

  console.log(tok);
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

    await (
      await db.folder("$CACHE-auth")
    ).deleteOne({
      profile_id: profile._id,
      type: "third_party",
    });

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

  console.log(res, "howw");
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
    data: {},
  };
};

const update_profile = async (req) => {
  let { headers, db, body, services } = req;
  let { updates } = body;

  let Profile = await services("profiles");

  return await Profile.call(
    "update_profile",
    {
      updates,
    },
    { token: headers.authorization },
  );
};

export { user, delete_account, confirm_delete_account, update_profile };
