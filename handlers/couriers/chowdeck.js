const estimate_chowdeck = async ({
  source_latitude,
  source_longitude,
  destination_latitude,
  destination_longitude,
}) => {
  try {
    const res = await fetch("https://api.chowdeck.com/relay/delivery/fee", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        Authorization: `Bearer ${process.env.CHOW_TOKEN}`,
      },
      body: JSON.stringify({
        source_address: {
          latitude: source_latitude,
          longitude: source_longitude,
        },
        destination_address: {
          latitude: destination_latitude,
          longitude: destination_longitude,
        },
      }),
    });

    const data = await res.json();

    if (data.status !== "success") return null;

    return {
      courier: "chowdeck",
      price: data.data.total_amount / 100,
      meta: { fee_id: data.data.id },
    };
  } catch {
    return null;
  }
};

export { estimate_chowdeck };
