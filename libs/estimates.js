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
  let total_price = Math.ceil(estimate.price) + charge;

  delete estimate.price;

  return {
    ...estimate,
    total_price,
    duration: estimate.duration || DEFAULT_DURATION,
  };
};

let swaps = [];

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
