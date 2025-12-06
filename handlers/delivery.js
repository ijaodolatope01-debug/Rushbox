import { authenticate_fez, authenticate_kwik } from "./utils/couriers.js";
import { thirty_mins } from "./order_estimate.js";
import { ORDERS } from "../ds/folders.js";

const DELIVERY_STATUSES = ["ongoing", "completed", "canceled"];

const store_delivery = async (response, body) => {
  if (!response?.courier_key) {
    return { _id: 0 };
  }
  console.log(`Storing delivery...`, response);
  let order = {
    courier: body.courier,
    sender_email: body.sender_email,
    sender_name: body.sender_name,
    courier_response: response.courier_response,
    courier_key: response.courier_key,
    pickup_address: body.pickup_address,
    dropoff_address: body.recipient_address,
    pickup_lat: body.pickup_latitude,
    pickup_lng: body.pickup_longitude,
    dropoff_lat: body.latitude,
    dropoff_lng: body.longitude,
    estimated_fare: body.value_of_item,
    actual_fare: null,
    payment_reference: body.payment_reference,
    payment_status: body.payment_status,
    status: "ongoing",
    user_id: body.user_id,
    created: new Date().toISOString(),
    _id: crypto.randomUUID(),
  };

  let res = await (await ORDERS(body.user_id, "ongoing")).insertOne(order);
  console.log(res);

  return res;
};

const create_delivery = async (req, res) => {
  let { courier, details, user_id } = req.body;
  details = { ...details, ...details.meta };
  let {
      delivery_fare,
      geoid,
      sender_name,
      sender_email,
      company_id,
      delivery_landmark,
      sender_phone,
      dropoff_latitute: latitude,
      dropoff_longitude: longitude,
      pickup_notes,
      order_number,
      recipient_email,
      pickup_latitude,
      pickup_longitude,
      recipient_phone,
      package_detail,
      delivery_notes,
      order_name,
      recipient_state,
      recipient_country,
      recipient_name,
      package_weight,
      value_of_item,
      reference,
      recipient_address,
      pickup_state,
      pickup_address,
      recipient_city,
      local_govt,
      fee_id,
    } = details,
    data;

  courier = courier && courier.toLowerCase();
  let reply = {};

  if (courier === "errandlr") {
    let url = "https://commerce.errandlr.com/request";
    let options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${process.env.ERRANDLR_TOKEN}`,
      },
      body: JSON.stringify({
        geoId: geoid,
        name: sender_name,
        email: sender_email,
        phone: sender_phone,
        latitude,
        longitude,
        pickupNotes: pickup_notes,
        deliverToInformation: [
          {
            order: order_number,
            name: order_name,
            phone: recipient_phone,
            packageDetail: package_detail,
            deliveryNotes: delivery_notes,
          },
        ],
        state: recipient_state,
        country: recipient_country,
        city: recipient_city,
        localGovt: local_govt,
      }),
    };

    try {
      let response = await fetch(url, options);
      data = await response.json();

      if (data?.status === 200) {
        reply.courier_key = data?.trackingId;
        reply.courier_response = data;
      }
    } catch (error) {
      console.error(error);
    }
  } else if (courier === "chowdeck") {
    const options = {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        Authorization: `Bearer ${process.env.CHOW_TOKEN}`,
      },
      body: JSON.stringify({
        destination_contact: {
          country_code: "NG",
          name: recipient_name,
          phone: recipient_phone,
        },
        source_contact: {
          country_code: "NG",
          name: sender_name,
          phone: sender_phone,
          email: sender_email,
        },
        user_action: "sending",
        fee_id,
        item_type: order_name,
        estimated_order_amount: value_of_item,
        customer_delivery_note: package_detail,
      }),
    };

    try {
      let response = await fetch(
        "https://api.chowdeck.com/relay/delivery",
        options
      );
      data = await response.json();
      data = data?.data || data;
      reply.courier_key = data?.id;
      reply.courier_response = data;
    } catch (e) {
      console.log(e);
    }
  } else if (courier === "fez") {
    let url = "https://apisandbox.fezdelivery.co/v1/order";

    let body = [
      {
        recipientAddress: recipient_address,
        recipientState: recipient_state,
        recipientName: recipient_name,
        recipientPhone: recipient_phone,
        uniqueID: reference,
        BatchID: reference,
        valueOfItem: value_of_item,
        weight: package_weight,
        additionalDetails: package_detail,
        pickUpState: pickup_state,
        pickUpAddress: pickup_address,
      },
    ];
    try {
      let auth = await authenticate_fez();

      let response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.authDetails.authToken}`,
          "secret-key": process.env.FEZ_TOKEN,
        },
        body: JSON.stringify(body),
      });

      let result = await response.json();
      data = result;

      try {
        if (data.status === "Success") {
          reply.courier_response = result;
          reply.courier_key = result.orderNos[reference];
        }
      } catch (e) {}
    } catch (error) {
      console.error("Error:", error);
    }
  } else if (courier === "kwik") {
    let url =
      "https://staging-api-test.kwik.delivery/v2/create_task_via_vendor";

    let body = {
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
          latitude: Number(pickup_latitude),
          longitude: Number(pickup_longitude),
          time: new Date().toISOString(),
          phone: sender_phone,
          email: sender_email,
        },
      ],
      deliveries: [
        {
          address: recipient_address,
          name: recipient_name,
          latitude: Number(latitude),
          longitude: Number(longitude),
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
    };

    try {
      let auth = await authenticate_kwik();
      body.access_token = auth?.data?.access_token;
      body.vendor_id = auth?.data?.vendor_details.vendor_id;

      let response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      let result = await response.json();
      if (result?.status === 200) {
        data = result?.data;
        reply.courier_key = data?.unique_order_id;
        reply.courier_response = data;
      } else data = result;
    } catch (error) {
      console.error("Error:", error);
    }
  } else if (courier === "dellyman") {
    try {
      let res = await fetch("https://dev.dellyman.com/api/v3.0/BookOrder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${process.env.DELLYMAN_TOKEN}`,
        },
        body: JSON.stringify({
          OrderRef: reference,
          CompanyID: company_id,
          PaymentMode: "online",
          Vehicle: "Bike",
          PickUpContactName: sender_name,
          PickUpContactNumber: "0".concat(sender_phone.slice(4)),
          PickUpGooglePlaceAddress: pickup_address,
          PickUpLandmark: "N/A",
          IsProductOrder: 0,
          IsInstantDelivery: 0,
          PickUpRequestedDate:
            new Date().getFullYear() +
            "/" +
            String(new Date().getMonth() + 1).padStart(2, "0") +
            "/" +
            String(new Date().getDate()).padStart(2, "0"),
          PickUpRequestedTime: thirty_mins(),
          DeliveryRequestedTime: thirty_mins(),
          DeliveryTimeline: "sameDay",
          Packages: [
            {
              PackageDescription: package_detail,
              DeliveryContactName: recipient_name,
              DeliveryContactNumber: "0".concat(recipient_phone.slice(4)),
              PackageWeight: package_weight,
              DeliveryGooglePlaceAddress: recipient_address,
              DeliveryLandmark: delivery_landmark,
              ProductAmount: value_of_item,
            },
          ],
        }),
      });

      data = await res.json();

      console.log(data);
      try {
        if (data.ResponseMessage === "Success") {
          reply.courier_key = data.OrderID;
          reply.courier_response = data;
        }
      } catch (e) {
        console.log(e.message);
      }
    } catch (e) {}
  } else if (courier === "kwikpik") {
    try {
      let response = await fetch(
        "https://api.kwikpik.io/partners/requests/initiate",
        {
          method: "POST",
          headers: {
            accept: "application/json",
            "Content-Type": "application/json",
            "x-api-key": process.env.KWIKPIK_TOKEN,
          },
          body: JSON.stringify({
            vehicleType: "car",
            deliveryLocation: {
              latitude: Number(latitude),
              longitude: Number(longitude),
              address: recipient_address,
            },
            pickupLocation: {
              latitude: Number(pickup_latitude),
              longitude: Number(pickup_longitude),
              address: pickup_address,
            },
            senderName: sender_name,
            senderEmail: sender_email,
            senderPhoneNumber: sender_phone,
            recipientName: recipient_name,
            recipientPhoneNumber: recipient_phone,
            description: package_detail,
            itemCategory: order_name,
            itemValue: value_of_item,
            itemWeight: package_weight,
            itemName: order_name,
            insured: false,
            image: "https://share.google/images/08A0YjdFyd5iB5WxO",
            // itemQuantity: 0
          }),
        }
      );

      data = await response.json();

      if (data.result) {
        reply.courier_key = data?.result?.id;
        reply.courier_response = data?.result;
      }
    } catch (error) {
      console.error("Error initiating delivery:", error);
    }
  }

  if (reply?.courier_key)
    data.rushbox_id = (
      await store_delivery(reply, { ...details, user_id, courier })
    )._id;

  res.json({
    ok: !!reply?.courier_key && true,
    data: normalise_order_response(data),
  });
};

function normalise_order_response(data) {}

export { create_delivery, DELIVERY_STATUSES };
