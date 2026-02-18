import { thirty_mins } from "../order_estimate.js";

const estimate_dellyman = async ({ pickup_label, destination_label }) => {
  try {
    const res = await fetch("https://dev.dellyman.com/api/v3.0/GetQuotes", {
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

    const data = await res.json();
    if (data.ResponseMessage !== "Success") return null;

    return {
      courier: "dellyman",
      price: data.Companies[0]?.TotalPrice,
      duration: "Next day",
    };
  } catch {
    return null;
  }
};

async function create_dellyman(details) {
  const {
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

  try {
    const res = await fetch("https://dev.dellyman.com/api/v3.0/BookOrder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${process.env.DELLYMAN_TOKEN}`,
      },
      body: JSON.stringify({
        OrderRef: reference,
        CompanyID: company_id,
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

export { estimate_dellyman, create_dellyman };
