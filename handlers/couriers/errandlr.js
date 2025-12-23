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

export { estimate_errandlr };
