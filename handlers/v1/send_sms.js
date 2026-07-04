import axios from "axios";

/**
 * Send custom SMS (with your OTP inside)
 */
const send_sms = async (phone, message) => {
  const TERMII_API_KEY = process.env.TERMII_API_KEY;
  const TERMII_BASE_URL = process.env.TERMII_BASE_URL;
  try {
    const response = await axios.post(`${TERMII_BASE_URL}/sms/send`, {
      api_key: TERMII_API_KEY,
      to: phone,
      from: "N-Alert", // Must be approved sender ID on Termii
      sms: message,
      type: "plain", // plain text SMS
      channel: "dnd", // whatsapp
    });

    console.log("SMS sent:", response.data);
    return response.data;
  } catch (err) {
    console.error("Error sending SMS:", err.response?.data || err.message);
  }
};

export default send_sms;
