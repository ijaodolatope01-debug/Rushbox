import admin from "./firebase.js";
import { getDeviceTokens } from "./device_token.js";

const send_notification = async (user, msg) => {
  let tokens = await getDeviceTokens(user);

  const message = {
    tokens,
    notification: {
      title: msg.title || "Rushbox Logistics",
      body: msg.text || "Order status",
    },
    data: {
      messageId: String(msg._id),
      userId: String(user_id),
      type: msg.type || "agent_message",
      ...msg.data,
    },
  };

  let response;
  try {
    response = await admin.messaging().sendEachForMulticast(message);
    // console.log('[PUSH] Sent:', response);

    if (response.failureCount > 0) {
      response.responses.forEach((res, idx) => {
        if (!res.success) {
          console.log("[PUSH] Failed token:", tokens[idx], res.error?.message);
        }
      });
    }
  } catch (err) {
    console.log("[PUSH] Error:", err);
  }

  return response;
};

export { send_notification };
