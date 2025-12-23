const estimate_kwik = async ({
  pickup_label,
  destination_label,
  sender_name,
  recipient_name,
  sender_phone,
  recipient_phone,
  source_latitude,
  source_longitude,
  destination_latitude,
  destination_longitude,
}) => {
  try {
    let auth = await fetch(
      "https://staging-api-test.kwik.delivery/vendor_login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain_name: "staging-client-panel.kwik.delivery",
          email: process.env.TOPE_EMAIL,
          password: process.env.KWIK_PASSWORD,
          api_login: 1,
        }),
      }
    );

    auth = await auth.json();
    const vendor = auth.data;

    const res = await fetch(
      "https://staging-api-test.kwik.delivery/send_payment_for_task",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          custom_field_template: "pricing-template",
          access_token: vendor.access_token,
          domain_name: "staging-client-panel.kwik.delivery",
          timezone: -330,
          vendor_id: vendor.vendor_details.vendor_id,
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

    const data = await res.json();
    // console.log(data);
    if (data.status !== 200) return null;

    return {
      courier: "kwik",
      price: Number(data.data.per_task_cost),
    };
  } catch (e) {
    console.log(e);
    return null;
  }
};

export { estimate_kwik };
