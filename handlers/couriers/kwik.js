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
      },
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
      },
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

import { authenticate_kwik } from "../utils/couriers.js";

async function create_kwik(details) {
  const {
    pickup_address,
    sender_name,
    pickup_latitude,
    pickup_longitude,
    sender_phone,
    sender_email,
    recipient_address,
    recipient_name,
    dropoff_latitude,
    dropoff_longitude,
    recipient_phone,
    recipient_email,
    value_of_item,
  } = details;

  let reply = {};
  let data;

  try {
    const auth = await authenticate_kwik();

    const body = {
      domain_name: "staging-client-panel.kwik.delivery",
      is_multiple_tasks: 1,
      fleet_id: "",
      latitude: 0,
      longitude: 0,
      timezone: 60,
      has_pickup: 1,
      has_delivery: 1,
      pickup_delivery_relationship: 0,
      layout_type: 0,
      auto_assignment: 1,
      team_id: "",
      pickups: [
        {
          address: pickup_address,
          name: sender_name,
          latitude: pickup_latitude,
          longitude: pickup_longitude,
          time: new Date().toISOString(),
          phone: sender_phone,
          email: sender_email,
        },
      ],
      deliveries: [
        {
          address: recipient_address,
          name: recipient_name,
          latitude: dropoff_latitude,
          longitude: dropoff_longitude,
          time: new Date().toISOString(),
          phone: recipient_phone,
          email: recipient_email,
          has_return_task: false,
          is_package_insured: 0,
          hadVairablePayment: 1,
          hadFixedPayment: 0,
          is_task_otp_required: 0,
        },
      ],
      insurance_amount: 0,
      total_no_of_tasks: 1,
      total_service_charge: 0,
      payment_method: 524288,
      amount: value_of_item.toString(),
      surge_cost: 0,
      surge_type: 0,
      delivery_instruction: "",
      loaders_amount: 0,
      loaders_count: 0,
      is_loader_required: 0,
      delivery_images: "",
      vehicle_id: 1,
      sareaId: "6",
      access_token: auth?.data?.access_token,
      vendor_id: auth?.data?.vendor_details.vendor_id,
    };

    const response = await fetch(
      "https://staging-api-test.kwik.delivery/v2/create_task_via_vendor",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    const result = await response.json();

    if (result?.status === 200) {
      data = result?.data;
      reply.courier_key = data?.unique_order_id;
      reply.courier_response = data;
    } else {
      data = result;
    }
  } catch (error) {
    console.error("Error:", error);
  }

  return reply;
}

const webhook_kwik = async () => {};

export { estimate_kwik, create_kwik, webhook_kwik };
