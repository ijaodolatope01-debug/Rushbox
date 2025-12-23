const estimate_fez = async ({
  package_weight,
  pick_up_state,
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
      }
    );

    auth = await auth.json();

    const res = await fetch("https://apisandbox.fezdelivery.co/v1/order/cost", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.authDetails.authToken}`,
        "secret-key": process.env.FEZ_TOKEN,
      },
      body: JSON.stringify({
        weight: package_weight,
        pickUpState: pick_up_state,
        state: destination_state,
      }),
    });

    const data = await res.json();
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

export { estimate_fez };
