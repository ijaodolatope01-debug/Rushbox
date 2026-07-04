import {
  id_exists_,
  request_otp_,
  verify_otp_,
} from "../../libs/utils/user.js";
import { ORDERS, USERS } from "../../ds/folders.js";
import { handle_bank_account } from "../../libs/utils/payment_gateway.js";

const user = async (req, res) => {
  let { _id } = req.params;

  let usr = await (await USERS()).findOne({ _id });
  let response = {
    ok: !!usr,
    data: usr,
  };

  if (usr) {
    response.message = `User retrieved`;
  } else response.message = `ID does not exists`;

  res.json(response);
};

const confirm_delete_account = async (req, res) => {
  let { user_id, otp } = req.body;

  let usr = await id_exists_(user_id);

  if (!usr || !verify_otp_(usr.phone, otp)) {
    return res.json({
      ok: false,
      message: "OTP verification failed",
    });
  }

  await (await USERS()).deleteOne({ _id: user_id });

  await (await ORDERS()).deleteMany({ user_id });

  res.json({
    ok: !!usr,
    message: usr ? "Account successfully deleted" : "Account not found",
  });
};

const delete_account = async (req, res) => {
  let { user_id } = req.body;

  let usr = await id_exists_(user_id);
  if (!usr) {
    return res.json({
      ok: false,
      message: "ID does not exists",
    });
  }
  await request_otp_(usr.phone);

  res.json({
    ok: true,
    message: "Verify OTP",
  });
};

const update_profile = async (req, res) => {
  let { property, _id, value, updates } = req.body;

  let Users = await USERS();
  let usr = await Users.findOne({ _id });
  if (!usr)
    return res.json({
      ok: false,
      message: "User is not found",
    });
  if (property === "_id") {
    return res.json({
      ok: false,
      message: "Cannot update an _id property",
    });
  }

  let user = await Users.findOne({ _id });

  usr = await Users.findOneAndUpdate(
    { _id },
    { $set: { ...(updates || { [property]: value }), updated: new Date() } },
    { returnDocument: "after" }, // use { returnOriginal: false } for older drivers
  );

  if (!user.email && usr.email) {
    await Users.updateOne({ _id }, { $unset: { is_new: 1 } });
    delete usr.is_new;
    await handle_bank_account(usr);
  }

  res.json({
    ok: true,
    message: "User updated successfully",
    data: usr,
  });
};

export { update_profile, user, delete_account, confirm_delete_account };
