const test_estimates = async (req, res) => {
  let domain = `http://${req.headers.host}`;
  let headers = {
    "Content-Type": "application/json",
  };
  console.log("Testing estimates...", domain);

  fetch(`${domain}/fetch_estimates`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      pickup_placeid: "Admiralty way, Lekki, Lagos, Nigeria",
      pickup_label: "Admiralty way, Lekki, Lagos, Nigeria",
      destination_placeid: "53 Itire St, Surulere 101283, Lagos, Nigeria",
      destination_label: "53 Itire St, Surulere 101283, Lagos, Nigeria",
      destination_latitude: "6.578996999999999",
      destination_longitude: "3.3494666",
      source_latitude: "6.500065424541259",
      source_longitude: "3.3778568041495247",
      pick_up_state: "Lagos",
      destination_state: "Lagos",
      destination_city: "Surulere",
      pickup_city: "Lekki",
      package_weight: 2,
    }),
  })
    .then((d) => d.json())
    .then((ress) => {
      console.log(ress);
      res.json(ress);
    });
};

const test_create_delivery = async (req, res) => {
  let domain = `http://${req.headers.host}`;
  let headers = {
    "Content-Type": "application/json",
  };
  console.log("Testing create delivery...", domain);

  fetch(`${domain}/create_delivery`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      user_id:
        "c2ade644bdbd5dda90ddca2279d79fcaac9adb23de31468f233e71c2080b4c1d",
      courier: "Errandlr",
      details: {
        geoid: "/KyU1ILZmef/uo8BPP8vJA==",
        latitude: "7.294063545481192",
        longitude: "5.150198253292087",
        pickup_notes: "Done.",
        order_number: 1,
        delivery_notes: "call me.",
        recipient_state: "lagos",
        recipient_country: "nigeria",
        recipient_city: "isolo",
        local_govt: "isolo",
        // chowdeck
        recipient_name: "lola",
        fee_id: 127151726,
        // Fez
        recipient_address: "53 Itire St, Surulere 101283, Lagos, Nigeria",
        pickup_address: "Admiralty way, Lekki, Lagos, Nigeria",
        reference: "192644",
        value_of_item: 9500,
        package_weight: 3,
        // Kwik
        pickup_latitude: 30.7172888,
        pickup_longitude: 76.8035087,
        // Errandlr & Chowdeck
        recipient_phone: "+2348035356942",
        sender_name: "savvy",
        sender_email: "immanuelsavvy@gmail.com",
        sender_phone: "+2349011167699",
        order_name: "rice",
        package_detail: "A bag of rice",
        // Dellyman
        company_id: 643,
        delivery_landmark: "",
      },
    }),
  })
    .then((d) => d.json())
    .then((ress) => {
      console.log(ress);
      res.json(ress);
    });
};

export { test_estimates, test_create_delivery };
