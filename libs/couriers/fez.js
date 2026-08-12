import { debug } from "../../handlers/v2/delivery.js";
import { authenticate_fez } from "../utils/couriers.js";

let estimate_fez = async ({
  package_weight,
  pickup_state,
  destination_state,
}) => {
  try {
    let auth = await fetch(
      "https://apisandbox.fezdelivery.co/v1/user/authenticate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: process.env.TOPE_EMAIL,
          password: process.env.FEZ_PASSWORD,
        }),
      },
    );

    auth = await auth.json();

    let res = await fetch("https://apisandbox.fezdelivery.co/v1/order/cost", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.authDetails.authToken}`,
        "secret-key": process.env.FEZ_TOKEN,
      },
      body: JSON.stringify({
        weight: package_weight,
        pickUpState: pickup_state,
        state: destination_state,
      }),
    });

    let data = await res.json();
    console.log(data);
    if (data.status !== "Success") return null;

    return {
      courier: "fez",
      price: data.Cost.cost,
    };
  } catch (e) {
    console.log(e);
    return null;
  }
};

async function create_fez(details) {
  let {
    destination_address,
    destination_state,
    recipient_name,
    recipient_phone,
    reference,
    value_of_item,
    package_weight,
    package_detail,
    pickup_state,
    pickup_address,
  } = details;

  debug({
    destination_address,
    destination_state,
    recipient_name,
    recipient_phone,
    reference,
    value_of_item,
    package_weight,
    package_detail,
    pickup_state,
    pickup_address,
  });
  let reply = {};
  let data;

  reference = reference || crypto.randomUUID();

  try {
    let auth = await authenticate_fez();

    let response = await fetch("https://apisandbox.fezdelivery.co/v1/order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.authDetails.authToken}`,
        "secret-key": process.env.FEZ_TOKEN,
      },
      body: JSON.stringify([
        {
          recipientAddress: destination_address,
          recipientState: destination_state,
          recipientName: recipient_name,
          recipientPhone: recipient_phone,
          uniqueID: reference,
          BatchID: reference,
          valueOfItem: value_of_item,
          weight: package_weight,
          additionalDetails: package_detail,
          pickUpState: pickup_state,
          pickUpAddress: pickup_address,
        },
      ]),
    });

    data = await response.json();

    debug("[Fez Response]", data);
    if (data.status === "Success") {
      reply.courier_response = data;
      reply.courier_key = data.orderNos[reference];
    } else {
      reply.message = Object.values(data.orderNos)[0];
    }
  } catch (error) {
    console.error("Error:", error);
  }

  return reply;
}

let webhook_fez = async () => {};

export { estimate_fez, create_fez, webhook_fez };
