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

export { estimate_dellyman };
