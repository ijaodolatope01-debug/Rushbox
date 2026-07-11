const user = async (req) => {
  let { profile } = req.headers;

  return {
    ok: true,
    data: profile,
    message: "Profile",
  };
};

// const confirm_delete_account = async (req, res) => {
//   let { user_id, otp } = req.body;

//   let usr = await id_exists_(user_id);

//   if (!usr || !verify_otp_(usr.phone, otp)) {
//     return res.json({
//       ok: false,
//       message: "OTP verification failed",
//     });
//   }

//   await (await USERS()).deleteOne({ _id: user_id });

//   await (await ORDERS()).deleteMany({ user_id });

//   res.json({
//     ok: !!usr,
//     message: usr ? "Account successfully deleted" : "Account not found",
//   });
// };

// const delete_account = async (req, res) => {
//   let { user_id } = req.body;

//   let usr = await id_exists_(user_id);
//   if (!usr) {
//     return res.json({
//       ok: false,
//       message: "ID does not exists",
//     });
//   }
//   await request_otp_(usr.phone);

//   res.json({
//     ok: true,
//     message: "Verify OTP",
//   });
// };

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

export { user };
