const estimate_kwikpik = async ({
  pickup_label,
  destination_label,
  source_latitude,
  source_longitude,
  destination_latitude,
  destination_longitude,
}) => {
  try {
    const res = await fetch(
      "https://api.kwikpik.io/partners/requests/estimate",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          insured: false,
          deliveryLocation: {
            latitude: Number(destination_latitude),
            longitude: Number(destination_longitude),
            address: destination_label,
          },
          pickupLocation: {
            latitude: Number(source_latitude),
            longitude: Number(source_longitude),
            address: pickup_label,
          },
        }),
      }
    );

    const data = await res.json();
    if (!data.result) return null;

    return {
      courier: "kwikpik",
      price: data.result.total,
      duration: data.result.duration,
    };
  } catch {
    return null;
  }
};

export { estimate_kwikpik };
