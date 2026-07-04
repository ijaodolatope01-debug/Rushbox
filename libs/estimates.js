const thirty_mins = () => {
  return (
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }) +
    " to " +
    new Date(Date.now() + 30 * 60000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  );
};

const DEFAULT_DURATION = "Same day";

const applyCharges = (estimate) => {
  if (!estimate) return null;

  const charge = estimate.price > 300 ? 500 : 300;

  return {
    ...estimate,
    charge,
    total_price: estimate.price + charge,
    duration: estimate.duration || DEFAULT_DURATION,
  };
};

let swaps = [
  ["pick_up_state", "recipient_state"],
  ["pickup_city", "recipient_city"],
  ["local_govt", "local_govt"],
  ["destination_latitude", "dropoff_latitude"],
  ["destination_longitude", "dropoff_longitude"],
  ["destination_placeid", "recipient_address"],
  ["pickup_placeid", "pickup_address"],
  ["source_longitude", "pickup_longitude", true],
  ["source_latitude", "pickup_latitude", true],
];

const swap_payload_key = (payload) => {
  swaps.map((sp) => {
    let [i, v, t] = sp;
    let val = payload[i];

    delete payload[i];
    if (t) val = Number(val);

    payload[v] = val;
  });

  return payload;
};

export { thirty_mins, applyCharges, swap_payload_key };
