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

  console.log(phone, code);

  let Rus_continuation_token = await db.folder("Rus:continuation_tokens");
  let tok = await Rus_continuation_token.findOne({
    phone,
    type: "delete_profile",
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

    if (!profile?.phone) {
      // await handle_bank_account(res.data, db);
    }
  }

  await (
    await db.folder("$CACHE-auth")
  ).deleteOne({
    type: "third_party",
    authorization: headers.authorization.replace("Bearer", ""),
  });

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
    let Rus_continuation_token = await db.folder("Rus:continuation_tokens");

    await Rus_continuation_token.updateOne(
      {
        phone: profile.phone,
        type: "delete_profile",
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

// const update_profile = async (req, res) => {
//   let { property, value, updates } = req.body;

//   let Users = await USERS();
//   let usr = await Users.findOne({ _id });
//   if (!usr)
//     return res.json({
//       ok: false,
//       message: "User is not found",
//     });
//   if (property === "_id") {
//     return res.json({
//       ok: false,
//       message: "Cannot update an _id property",
//     });
//   }

//   let user = await Users.findOne({ _id });

//   usr = await Users.findOneAndUpdate(
//     { _id },
//     { $set: { ...(updates || { [property]: value }), updated: new Date() } },
//     { returnDocument: "after" }, // use { returnOriginal: false } for older drivers
//   );

//   if (!user.email && usr.email) {
//     await Users.updateOne({ _id }, { $unset: { is_new: 1 } });
//     delete usr.is_new;
//     await handle_bank_account(usr);
//   }

//   res.json({
//     ok: true,
//     message: "User updated successfully",
//     data: usr,
//   });
// };

export { user, delete_account, confirm_delete_account };
