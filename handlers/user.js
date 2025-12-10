import { hash } from "godprotocol/utils/hash.js";
import { id_exists_, request_otp_, verify_otp_ } from "./utils/user.js";
import { ORDERS, USERS } from "../ds/folders.js";

const user = async (req, res) => {
  let { _id } = req.params;

  console.log("Fetching user:", _id);
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
  let { id, otp } = req.body;

  if (!verify_otp_(id, otp)) {
    return res.json({
      ok: false,
      message: "OTP verification failed",
    });
  }

  let user_id = hash(id);

  let usr = await (await USERS()).deleteOne({ _id: user_id });

  await (await ORDERS()).deleteMany({ user_id });

  res.json({
    ok: !!usr,
    message: usr ? "Account successfully deleted" : "Account not found",
  });
};

const delete_account = async (req, res) => {
  let { id } = req.body;

  if (!(await id_exists_(id))) {
    return res.json({
      ok: false,
      message: "ID does not exists",
    });
  }
  await request_otp_(id);

  res.json({
    ok: true,
    message: "Verify OTP",
  });
};

const update_profile = async (req, res) => {
  let { property, _id, value } = req.body;

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

  usr = await Users.findOneAndUpdate(
    { _id },
    { $set: { [property]: value } },
    { returnDocument: "after" } // use { returnOriginal: false } for older drivers
  );

  res.json({
    ok: true,
    message: "User updated successfully",
    data: usr,
  });
};

export { update_profile, user, delete_account, confirm_delete_account };
