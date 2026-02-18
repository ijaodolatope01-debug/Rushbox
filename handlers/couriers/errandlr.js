const estimate_errandlr = async ({
  pickup_placeid,
  pickup_label,
  destination_placeid,
  destination_label,
}) => {
  try {
    const response = await fetch("https://commerce.errandlr.com/v2/estimate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${process.env.ERRANDLR_TOKEN}`,
      },
      body: JSON.stringify({
        dropoffLocations: [
          { id: destination_placeid, label: destination_label },
        ],
        pickupLocation: { id: pickup_placeid, label: pickup_label },
      }),
    });

    const data = await response.json();

    if (data.status === "success") {
      return {
        courier: "errandlr",
        price: data.estimate,
        duration: data.estimateLabel,
        meta: { geoid: data.geoId },
      };
    }
  } catch (e) {}

  return null;
};

async function create_errandlr(details) {
  const {
    geoid,
    sender_name,
    sender_email,
    sender_phone,
    dropoff_latitude,
    dropoff_longitude,
    pickup_notes,
    order_number,
    order_name,
    recipient_phone,
    package_detail,
    delivery_notes,
    recipient_state,
    recipient_country,
    recipient_city,
    local_govt,
  } = details;

  let reply = {};
  let data;

  try {
    const response = await fetch("https://commerce.errandlr.com/request", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${process.env.ERRANDLR_TOKEN}`,
      },
      body: JSON.stringify({
        geoId: geoid,
        name: sender_name,
        email: sender_email,
        phone: sender_phone,
        latitude: dropoff_latitude,
        longitude: dropoff_longitude,
        pickupNotes: pickup_notes,
        deliverToInformation: [
          {
            order: order_number,
            name: order_name,
            phone: recipient_phone,
            packageDetail: package_detail,
            deliveryNotes: delivery_notes,
          },
        ],
        state: recipient_state,
        country: recipient_country,
        city: recipient_city,
        localGovt: local_govt,
      }),
    });

    data = await response.json();

    if (data?.status === 200) {
      reply.courier_key = data?.trackingId;
      reply.courier_response = data;
    }
  } catch (error) {
    console.error(error);
  }

  return reply;
}

export { estimate_errandlr, create_errandlr };
