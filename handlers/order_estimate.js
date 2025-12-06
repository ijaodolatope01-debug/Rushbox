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

const fetch_estimates = async (req, res) => {
  let {
    pickup_placeid,
    pickup_label,
    destination_placeid,
    destination_latitude,
    destination_longitude,
    source_latitude,
    source_longitude,
    pick_up_state,
    destination_state,
    destination_label,
    sender_name,
    recipient_name,
    recipient_phone,
    sender_phone,
    package_weight,
  } = req.body;

  let estimates = {};
  let url = "https://commerce.errandlr.com/v2/estimate";
  let options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${process.env.ERRANDLR_TOKEN}`,
    },
    body: JSON.stringify({
      dropoffLocations: [
        {
          id: destination_placeid,
          label: destination_label,
        },
      ],
      pickupLocation: {
        id: pickup_placeid,
        label: pickup_label,
      },
    }),
  };

  try {
    let response = await fetch(url, options);
    let data = await response.json();

    if (data.status === "success") {
      estimates["Errandlr"] = {
        price: data.estimate,
        goeId: data.geoId,
        duration: data.estimateLabel,
      };
    } else console.log(data);
  } catch (error) {
    console.error(error);
  }

  const chowdeck_options = {
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
  };

  try {
    let chow_response = await fetch(
      "https://api.chowdeck.com/relay/delivery/fee",
      chowdeck_options
    );
    let chow_data = await chow_response.json();
    if (chow_data.status === "success") {
      estimates["Chowdeck"] = {
        price: chow_data.data.total_amount,
        id: chow_data.data.id,
      };
    } else console.log(chow_data);
  } catch (e) {}

  try {
    let auth = await fetch(
      "https://apisandbox.fezdelivery.co/v1/user/authenticate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: "ijaodolatope@gmail.com",
          password: process.env.FEZ_PASSWORD,
        }),
      }
    );
    auth = await auth.json();

    let data = await fetch("https://apisandbox.fezdelivery.co/v1/order/cost", {
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

    data = await data.json();

    if (data.status === "Success") {
      estimates["Fez"] = { price: data.Cost.cost };
    } else console.log(data);
  } catch (e) {
    console.log(e.message);
  }

  try {
    let response = await fetch(
      "https://staging-api-test.kwik.delivery/vendor_login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain_name: "staging-client-panel.kwik.delivery",
          email: "ijaodolatope@gmail.com",
          password: process.env.KWIK_PASSWORD,
          api_login: 1,
        }),
      }
    );

    let data = await response.json();

    data = data.data;

    let kwik_response = await fetch(
      "https://staging-api-test.kwik.delivery/send_payment_for_task",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          custom_field_template: "pricing-template",
          access_token: data.access_token,
          domain_name: "staging-client-panel.kwik.delivery",
          timezone: -330,
          vendor_id: data.vendor_details.vendor_id,
          is_multiple_tasks: 1,
          layout_type: 0,
          pickup_custom_field_template: "pricing-template",
          deliveries: [
            {
              address: destination_label,
              name: recipient_name,
              latitude: Number(destination_latitude),
              longitude: Number(destination_longitude),
              phone: recipient_phone,
              has_return_task: false,
              is_package_insured: 0,
            },
          ],
          has_pickup: 1,
          has_delivery: 1,
          auto_assignment: 1,
          user_id: 1,
          pickups: [
            {
              address: pickup_label,
              name: sender_name,
              latitude: Number(source_latitude),
              longitude: Number(source_longitude),
              phone: sender_phone,
            },
          ],
          payment_method: 32,
          form_id: 2,
          vehicle_id: 4,
          delivery_instruction:
            "Hey, Please deliver the parcel with safety. Thanks in advance",
          // is_loader_required: 1,
          // loaders_amount: 40,
          // loaders_count: 4,
          // is_cod_job: 1,
          // parcel_amount: 1000
        }),
      }
    );

    kwik_response = await kwik_response.json();

    if (kwik_response.status === 200) {
      estimates["Kwik"] = { price: Number(kwik_response.data.per_task_cost) };
    } else console.log(kwik_response);
  } catch (error) {
    console.error("Error:", error);
  }

  try {
    let data = await fetch("https://dev.dellyman.com/api/v3.0/GetQuotes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${process.env.DELLYMAN_TOKEN}`,
      },
      body: JSON.stringify({
        PaymentMode: "online",
        Vehicle: "Bike",
        IsInstantDelivery: 0,
        PickupRequestedTime: thirty_mins(),
        IsProductOrder: 0,
        ProductAmount: [],
        PickupRequestedDate: new Date().toLocaleDateString(),
        PickupAddress: pickup_label,
        DeliveryAddress: [destination_label],
      }),
    });

    data = await data.json();
    if (data && data.ResponseMessage === "Success") {
      estimates["Dellyman"] = {
        price: data.Companies[0]?.TotalPrice,
        duration: "Next day",
      };
    }
  } catch (e) {
    console.log(e);
  }

  try {
    const response = await fetch(
      "https://api.kwikpik.io/partners/requests/estimate",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          insured: false,
          itemValue: 0,
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

    const data = await response.json();
    if (data.result) {
      estimates["Kwikpik"] = {
        price: data.result.total,
        duration: data.result.duration,
      };
    }
    // console.log("Estimate:", data);
  } catch (error) {
    console.error("Error fetching estimate:", error);
  }

  for (let courier in estimates) {
    let data = estimates[courier];
    let price = data.price;
    if (price > 300) {
      data.charge = 500;
    } else data.charge = 300;

    data.total_price = data.price + data.charge;
  }

  res.json({
    ok: true,
    data: estimates,
  });
};

export { fetch_estimates, thirty_mins };
