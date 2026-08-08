import { debug } from "../../handlers/v2/delivery.js";
import { thirty_mins } from "../estimates.js";
import update_ongoing_status from "../utils/update_ongoing_status.js";

let estimate_dellyman = async ({ pickup_label, destination_label }) => {
  try {
    let res = await fetch("https://dev.dellyman.com/api/v3.0/GetQuotes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DELLYMAN_TOKEN}`,
      },
      body: JSON.stringify({
        PaymentMode: "online",
        Vehicle: "Bike",
        PickupRequestedTime: thirty_mins(),
        PickupRequestedDate: new Date().toLocaleDateString(),
        PickupAddress: pickup_label,
        DeliveryAddress: [destination_label],
      }),
    });

    let data = await res.json();
    debug(data, "delly mom");

    if (data.ResponseMessage !== "Success") return null;

    return {
      courier: "dellyman",
      price: data.Companies[0]?.TotalPrice,
      duration: "Next day",
    };
  } catch (e) {
    console.log(e);
    debug(9886517674);
    return null;
  }
};

async function create_dellyman(details) {
  let {
    reference,
    company_id,
    sender_name,
    sender_phone,
    pickup_address,
    recipient_name,
    recipient_phone,
    package_weight,
    recipient_address,
    delivery_landmark,
    value_of_item,
    package_detail,
  } = details;

  let reply = {};
  let data;

  reference = reference || crypto.randomUUID();
  try {
    let res = await fetch("https://dev.dellyman.com/api/v3.0/BookOrder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${process.env.DELLYMAN_TOKEN}`,
      },
      body: JSON.stringify({
        OrderRef: reference,
        CompanyID: 643,
        PaymentMode: "online",
        Vehicle: "Bike",
        PickUpContactName: sender_name,
        PickUpContactNumber: "0".concat(sender_phone.slice(4)),
        PickUpGooglePlaceAddress: pickup_address,
        PickUpLandmark: "N/A",
        IsProductOrder: 0,
        IsInstantDelivery: 0,
        PickUpRequestedDate:
          new Date().getFullYear() +
          "/" +
          String(new Date().getMonth() + 1).padStart(2, "0") +
          "/" +
          String(new Date().getDate()).padStart(2, "0"),
        PickUpRequestedTime: thirty_mins(),
        DeliveryRequestedTime: thirty_mins(),
        DeliveryTimeline: "sameDay",
        Packages: [
          {
            PackageDescription: package_detail,
            DeliveryContactName: recipient_name,
            DeliveryContactNumber: "0".concat(recipient_phone.slice(4)),
            PackageWeight: package_weight,
            DeliveryGooglePlaceAddress: recipient_address,
            DeliveryLandmark: delivery_landmark,
            ProductAmount: value_of_item,
          },
        ],
      }),
    });

    data = await res.json();

    if (data.ResponseMessage === "Success") {
      reply.courier_key = data.OrderID;
      reply.courier_response = data;
    }
  } catch (e) {
    console.log(e);
  }

  return reply;
}

let webhook_dellyman = async () => {
  let hash = crypto
    .createHmac("sha256", process.env.DELLYMAN_TOKEN)
    .update(JSON.stringify(req.body))
    .digest("hex");

  let event = req.body;
  let { status, order } = event;

  if (!status || hash != req.headers["X-Dellyman-Signature"]) {
    return false;
  }

  // Retrieve the request's body

  let id = order?.OrderID;

  return await update_ongoing_status(id, order.OrderStatus, "dellyman");
};

export { estimate_dellyman, create_dellyman, webhook_dellyman };
