// See engine.js for the schema shape and how each node type is resolved.
//
// CHANGELOG (aligning these configs to how the engine actually parses them):
// - chowdeck, dellyman: `auth: { type: "bearer", ... }` isn't a shape
//   resolve_auth understands (it only reads auth.login / auth.headers) —
//   both couriers were going out with NO Authorization header. Moved to
//   auth.headers.Authorization using source:"secret" + prefix:"Bearer ".
// - dellyman: PickupRequestedTime/PickupRequestedDate/PickUpRequestedDate/
//   PickUpRequestedTime/DeliveryRequestedTime used
//   `{ source: "computed", from: "<COMPUTED key>" }`, which reads the raw
//   COMPUTED function (never invoked) — JSON.stringify drops it, so these
//   fields were silently missing from the request body. Switched to
//   `default_computed`, which is the only path that actually calls the
//   function.
// - dellyman: DeliveryAddress's single_item array wrapped its leaf in
//   `{ schema: { ... } }` with no `type`, so build_node never treated it as
//   an object OR recognized the inner leaf — it resolved to `[undefined]`.
//   The `items` node for a single scalar must BE the leaf.
// - dellyman: OrderRef's `fallback: "$none"` was dead code (always resolves
//   to undefined via get()) — removed, `default: null` alone has identical
//   behavior.
//
// Each courier now exposes a dedicated `env` object that lists every
// environment variable it needs (including staging variants). This makes
// secret resolution explicit and easy to audit.

export const kwik = {
  name: "kwik",
  // NOTE: both estimate_kwik and create_kwik hit the staging host
  // unconditionally today, regardless of process.env.STAGING — kept that
  // behavior as-is (no staging_base_url, base_url IS the staging host).
  // Flag me if there's a real prod host you want wired up.
  base_url: "https://staging-api-test.kwik.delivery",
  staging_base_url: null,

  env: {
    TOPE_EMAIL: { required: true },
    KWIK_PASSWORD: { required: true },
  },

  auth: {
    login: {
      path: "/vendor_login",
      method: "POST",
      body_map: {
        domain_name: { const: "staging-client-panel.kwik.delivery" },
        // The util you pasted hardcoded "ijaodolatope@gmail.com" here while
        // estimate_kwik used process.env.TOPE_EMAIL — used the env var
        // consistently since baking a personal email into shared code seems
        // like a bug, not intentional. Flag if it should actually differ.
        email: { source: "secret", secret_ref: "TOPE_EMAIL" },
        password: { source: "secret", secret_ref: "KWIK_PASSWORD" },
        api_login: { const: 1 },
      },
      extract: {
        access_token: { from: "data.access_token" },
        vendor_id: { from: "data.vendor_details.vendor_id" },
      },
    },
    // No headers — Kwik's auth values go into the request bodies below instead.
  },

  estimate: {
    method: "POST",
    path: "/send_payment_for_task",
    body_map: {
      custom_field_template: { const: "pricing-template" },
      access_token: {
        source: "computed",
        from: "auth.access_token",
        required: true,
      },
      domain_name: { const: "staging-client-panel.kwik.delivery" },
      timezone: { const: -330 },
      vendor_id: { source: "computed", from: "auth.vendor_id", required: true },
      is_multiple_tasks: { const: 1 },
      layout_type: { const: 0 },
      pickup_custom_field_template: { const: "pricing-template" },
      deliveries: {
        type: "array",
        single_item: true,
        items: {
          type: "object",
          schema: {
            address: { from: "destination_address", required: true },
            name: { from: "recipient_name", required: true },
            latitude: {
              from: "destination_latitude",
              type: "number",
              required: true,
            },
            longitude: {
              from: "destination_longitude",
              type: "number",
              required: true,
            },
            phone: { from: "recipient_phone", required: true },
            has_return_task: { const: false },
            is_package_insured: { const: 0 },
          },
        },
      },
      has_pickup: { const: 1 },
      has_delivery: { const: 1 },
      auto_assignment: { const: 1 },
      user_id: { const: 1 },
      pickups: {
        type: "array",
        single_item: true,
        items: {
          type: "object",
          schema: {
            address: { from: "pickup_address", required: true },
            name: { from: "sender_name", required: true },
            latitude: {
              from: "pickup_latitude",
              type: "number",
              required: true,
            },
            longitude: {
              from: "pickup_longitude",
              type: "number",
              required: true,
            },
            phone: { from: "sender_phone", required: true },
          },
        },
      },
      payment_method: { const: 32 },
      form_id: { const: 2 },
      vehicle_id: { const: 4 },
      delivery_instruction: {
        const: "Hey, Please deliver the parcel with safety. Thanks in advance",
      },
    },
    success_check: { from: "status", equals: 200 },
    extract: {
      price: { from: "data.per_task_cost", transform: "to_number" },
    },
  },

  create: {
    method: "POST",
    path: "/v2/create_task_via_vendor",
    body_map: {
      domain_name: { const: "staging-client-panel.kwik.delivery" },
      is_multiple_tasks: { const: 1 },
      fleet_id: { const: "" },
      latitude: { const: 0 },
      longitude: { const: 0 },
      timezone: { const: 60 },
      has_pickup: { const: 1 },
      has_delivery: { const: 1 },
      pickup_delivery_relationship: { const: 0 },
      layout_type: { const: 0 },
      auto_assignment: { const: 1 },
      team_id: { const: "" },
      pickups: {
        type: "array",
        single_item: true,
        items: {
          type: "object",
          schema: {
            // Original create_kwik does NOT Number()-cast these (unlike
            // estimate_kwik, which does) — preserved that inconsistency
            // rather than silently "fixing" behavior you may be relying on.
            address: { from: "pickup_address", required: true },
            name: { from: "sender_name", required: true },
            latitude: { from: "pickup_latitude", required: true },
            longitude: { from: "pickup_longitude", required: true },
            time: { default_computed: "now_iso" },
            phone: { from: "sender_phone", required: true },
            email: { from: "sender_email" },
          },
        },
      },
      deliveries: {
        type: "array",
        single_item: true,
        items: {
          type: "object",
          schema: {
            address: { from: "destination_address", required: true },
            name: { from: "recipient_name", required: true },
            latitude: { from: "destination_latitude", required: true },
            longitude: { from: "destination_longitude", required: true },
            time: { default_computed: "now_iso" },
            phone: { from: "recipient_phone", required: true },
            email: { from: "recipient_email" },
            has_return_task: { const: false },
            is_package_insured: { const: 0 },
            hadVairablePayment: { const: 1 }, // typo preserved from original field name
            hadFixedPayment: { const: 0 },
            is_task_otp_required: { const: 0 },
          },
        },
      },
      insurance_amount: { const: 0 },
      total_no_of_tasks: { const: 1 },
      total_service_charge: { const: 0 },
      payment_method: { const: 524288 },
      amount: { from: "value_of_item", transform: "to_string" },
      surge_cost: { const: 0 },
      surge_type: { const: 0 },
      delivery_instruction: { const: "" },
      loaders_amount: { const: 0 },
      loaders_count: { const: 0 },
      is_loader_required: { const: 0 },
      delivery_images: { const: "" },
      vehicle_id: { const: 1 },
      sareaId: { const: "6" },
      access_token: { source: "computed", from: "auth.access_token" },
      vendor_id: { source: "computed", from: "auth.vendor_id" },
    },
    success_check: { from: "status", equals: 200 },
    extract: {
      courier_key: { from: "data.unique_order_id" },
      courier_response: { from: "data" },
    },
  },

  // No webhook block — webhook_kwik was a no-op in the original code too;
  // runWebhook already returns false when config.webhook is missing.
};

export const fez = {
  name: "fez",
  base_url: "https://api.fezdelivery.co",
  staging_base_url: "https://apisandbox.fezdelivery.co",

  env: {
    TOPE_EMAIL: { required: true },
    FEZ_PASSWORD: { required: true },
    FEZ_TOKEN: { required: true },
    FEZ_TEST_TOKEN: { required: true, staging: true },
  },

  auth: {
    login: {
      path: "/v1/user/authenticate",
      method: "POST",
      body_map: {
        user_id: { source: "secret", secret_ref: "TOPE_EMAIL" },
        password: { source: "secret", secret_ref: "FEZ_PASSWORD" },
      },
      extract: {
        token: { from: "authDetails.authToken" },
      },
    },
    headers: {
      Authorization: {
        source: "computed",
        from: "auth.token",
        prefix: "Bearer ",
      },
      "secret-key": {
        source: "secret",
        secret_ref: "FEZ_TOKEN",
        staging_secret_ref: "FEZ_TEST_TOKEN",
      },
    },
  },

  estimate: {
    method: "POST",
    path: "/v1/order/cost",
    body_map: {
      weight: { from: "package_weight", required: true },
      pickUpState: { from: "pickup_state", required: true },
      state: { from: "destination_state", required: true },
    },
    success_check: { from: "status", equals: "Success" },
    extract: {
      price: { from: "totalCost" },
    },
  },

  create: {
    method: "POST",
    path: "/v1/order",
    // Fez wants a client-generated reference echoed back as the key of
    // `orderNos` in the response — generate it up front so body + extract agree.
    ensure_reference_field: "reference",
    body_root: {
      type: "array",
      single_item: true,
      items: {
        type: "object",
        schema: {
          recipientAddress: { from: "destination_address", required: true },
          recipientState: { from: "destination_state", required: true },
          recipientName: { from: "recipient_name", required: true },
          recipientPhone: { from: "recipient_phone", required: true },
          uniqueID: { from: "reference", required: true },
          BatchID: { from: "reference", required: true },
          valueOfItem: { from: "value_of_item" },
          weight: { from: "package_weight" },
          additionalDetails: { from: "package_detail" },
          pickUpState: { from: "pickup_state", required: true },
          pickUpAddress: { from: "pickup_address", required: true },
        },
      },
    },
    success_check: { from: "status", equals: "Success" },
    error_message: { from: "orderNos", transform: "first_value" },
    extract: {
      courier_key: {
        dynamic_key: { parent: "orderNos", key_from: "reference" },
      },
      courier_response: { from: "$root" },
    },
  },

  webhook: {
    verify: {
      type: "hmac_concat",
      header: "x-signature",
      algorithm: "sha256",
      secret_ref: "FEZ_TOKEN",
      staging_secret_ref: "FEZ_TEST_TOKEN",
      concat_fields: ["orderNumber", "status", "headers.x-timestamp"],
    },
    replay_protection: {
      timestamp_field: "headers.x-timestamp",
      max_skew_seconds: 300,
    },
    gate: [
      { from: "orderNumber", exists: true },
      { from: "status", exists: true },
    ],
    tracking_id: { from: "orderNumber" },
    status_value: { from: "status" },
    status_map: {
      // TODO — the old webhook_fez forwarded Fez's raw `status` string
      // straight into update_ongoing_status without ever mapping it to an
      // ongoing_status int, so I have no record of Fez's actual status
      // vocabulary (e.g. "PICKED_UP" / "DELIVERED" / whatever it really sends).
      // Left empty on purpose — as written, every Fez webhook event will be
      // silently ignored until this is filled in. Send me the raw values
      // (or check Fez's docs/old logs) and I'll fill this in before you expose it.
    },
  },
};

export const dellyman = {
  name: "dellyman",
  base_url: "https://dellyman.com/api/v3.0",
  staging_base_url: "https://dev.dellyman.com/api/v3.0",

  env: {
    DELLYMAN_TOKEN: { required: true },
    DELLYMAN_TEST_TOKEN: { required: true, staging: true },
    DELLYMAN_WEBHOOK_SECRET: { required: true },
    DELLYMAN_WEBHOOK_SECRET_TEST: { required: true, staging: true },
  },

  auth: {
    headers: {
      Authorization: {
        source: "secret",
        secret_ref: "DELLYMAN_TOKEN",
        staging_secret_ref: "DELLYMAN_TEST_TOKEN",
        prefix: "Bearer ",
      },
    },
  },

  estimate: {
    method: "POST",
    path: "/GetQuotes",
    body_map: {
      PaymentMode: { const: "online" },
      Vehicle: { const: "Bike" },
      PickupRequestedTime: { default_computed: "now_plus_30min" },
      PickupRequestedDate: { default_computed: "today_locale" },
      PickupAddress: { from: "pickup_address", required: true },
      DeliveryAddress: {
        type: "array",
        single_item: true,
        // Dellyman wants the raw address string, not an object, inside the
        // array — for a single scalar, `items` IS the leaf directly (no
        // `type`/`schema` wrapper — build_node falls through straight to
        // resolve_leaf for it).
        items: { from: "destination_address", required: true },
      },
    },
    success_check: { from: "ResponseMessage", equals: "Success" },
    extract: {
      price: { from: "Companies.0.TotalPrice" },
      duration: { const: "Next day" },
    },
  },

  create: {
    method: "POST",
    path: "/BookOrder",
    response_type: "text-prefixed-json", // Dellyman sometimes prefixes junk before the JSON
    body_map: {
      OrderRef: { from: "reference", default: null },
      CompanyID: { const: 643 },
      PaymentMode: { const: "online" },
      Vehicle: { const: "Bike" },
      PickUpContactName: { from: "sender_name", required: true },
      PickUpContactNumber: {
        from: "sender_phone",
        required: true,
        transform: "strip_ng_prefix",
      },
      PickUpGooglePlaceAddress: { from: "pickup_address", required: true },
      PickUpLandmark: { const: "N/A" },
      IsProductOrder: { const: 0 },
      IsInstantDelivery: { const: 0 },
      PickUpRequestedDate: { default_computed: "today_ymd" },
      PickUpRequestedTime: { default_computed: "now_plus_30min" },
      DeliveryRequestedTime: { default_computed: "now_plus_30min" },
      DeliveryTimeline: { const: "sameDay" },
      Packages: {
        type: "array",
        single_item: true,
        items: {
          type: "object",
          schema: {
            PackageDescription: { from: "package_detail" },
            DeliveryContactName: { from: "recipient_name", required: true },
            DeliveryContactNumber: {
              from: "recipient_phone",
              required: true,
              transform: "strip_ng_prefix",
            },
            PackageWeight: { from: "package_weight", type: "number" },
            DeliveryGooglePlaceAddress: {
              from: "destination_address",
              required: true,
            },
            DeliveryLandmark: {
              from: "delivery_landmark",
              fallback: "destination_address",
            },
            ProductAmount: { from: "value_of_item" },
          },
        },
      },
    },
    success_check: { from: "ResponseMessage", equals: "Success" },
    extract: {
      courier_key: { from: "OrderID", transform: "to_string" },
      courier_response: { from: "$root" },
    },
  },

  webhook: {
    verify: {
      type: "hmac",
      header: "x-dellyman-signature",
      algorithm: "sha256",
      secret_ref: "DELLYMAN_WEBHOOK_SECRET",
      staging_secret_ref: "DELLYMAN_WEBHOOK_SECRET_TEST",
    },
    // original code used `status` purely as an "is this a real event" gate,
    // then read the actual status off a completely different field
    gate: { from: "status", exists: true },
    tracking_id: { from: "order.OrderID" },
    status_value: { from: "order.OrderStatus" },
    status_map: {
      PENDING: 2,
      INTRANSIT: 4,
      COMPLETED: 10,
      CANCELLED: -1,
    },
  },
};

export const chowdeck = {
  name: "chowdeck",
  base_url: "https://api.chowdeck.com",
  staging_base_url: null, // chowdeck has no separate staging host — token differs instead

  env: {
    CHOWDECK_TOKEN: { required: true },
    CHOW_TEST_TOKEN: { required: true, staging: true },
  },

  auth: {
    headers: {
      Authorization: {
        source: "secret",
        secret_ref: "CHOWDECK_TOKEN",
        staging_secret_ref: "CHOW_TEST_TOKEN",
        prefix: "Bearer ",
      },
    },
  },

  estimate: {
    method: "POST",
    path: "/relay/delivery/fee",
    body_map: {
      source_address: {
        type: "object",
        schema: {
          latitude: { from: "pickup_latitude", required: true },
          longitude: { from: "pickup_longitude", required: true },
        },
      },
      destination_address: {
        type: "object",
        schema: {
          latitude: { from: "destination_latitude", required: true },
          longitude: { from: "destination_longitude", required: true },
        },
      },
    },
    success_check: { from: "status", equals: "success" },
    extract: {
      price: { from: "data.total_amount", transform: "divide_100" },
      meta: {
        type: "object",
        schema: { fee_id: { from: "data.id" } },
      },
    },
  },

  create: {
    method: "POST",
    path: "/relay/delivery",
    body_map: {
      destination_contact: {
        type: "object",
        schema: {
          country_code: { const: "NG" },
          name: { from: "recipient_name", required: true },
          phone: { from: "recipient_phone", required: true },
        },
      },
      source_contact: {
        type: "object",
        schema: {
          country_code: { const: "NG" },
          name: { from: "sender_name", required: true },
          phone: { from: "sender_phone", required: true },
          email: { from: "sender_email" },
        },
      },
      user_action: { const: "sending" },
      fee_id: { from: "fee_id", required: true },
      item_type: { from: "order_name" },
      estimated_order_amount: { from: "value_of_item" },
      customer_delivery_note: { from: "package_detail" },
    },
    // Original response body is either `{data:{...}}` or the record itself —
    // extraction just reads both possible spots and takes whichever exists.
    success_check: { from: "data.id", exists: true },
    extract: {
      courier_key: { from: "data.id", fallback: "id" },
      courier_response: { from: "data", fallback: "$root" },
    },
  },

  // NOTE: original webhook_chowdeck had its signature check commented out
  // (and never imported crypto) — every incoming event was trusted
  // unverified. This turns it back on. Flag me if that was intentional
  // and you want `verify: { type: "none" }` instead.
  webhook: {
    verify: {
      type: "hmac",
      header: "x-chowdeck-signature",
      algorithm: "sha512",
      secret_ref: "CHOWDECK_TOKEN",
      staging_secret_ref: "CHOW_TEST_TOKEN",
    },
    tracking_id: { from: "data.tracking.0.trackingId" },
    status_value: { from: "status", split: ".", index: 1 },
    status_map: {
      ORDER_CREATED: 2,
      ORDER_ASSIGNED: 4,
      ORDER_AWAITING_PICKUP: 5,
      ORDER_PICKED_UP: 7,
      ORDER_ARRIVED_AT_CUSTOMER_LOCATION: 8,
      ORDER_COMPLETE: 10,
    },
  },
};

// One judgment call still needs your sign-off — see kwikpik.webhook below:
// the original code treated a MISSING x-kwikpik-signature header as
// automatically verified, and its signing line referenced an undefined
// `payload` variable (would have thrown ReferenceError any time the header
// WAS present — verification was broken outright either way). I've assumed
// `payload` should be `req.body` (the only sensible read) and defaulted to
// the stricter behavior (missing header = reject, via `optional` left
// unset). If you actually want missing-header events accepted, set
// `optional: true` on the verify block.

export const errandlr = {
  name: "errandlr",
  // Original code's staging branch was `process.env.STAGING && false ?
  // green : commerce` — the `&& false` makes it permanently dead, so
  // commerce.errandlr.com is ALWAYS used regardless of STAGING. Preserved
  // that (staging_base_url: null) rather than silently "fixing" it — only
  // the auth token differs by staging, same pattern as Chowdeck. Flag if
  // the green/staging host was actually meant to be reachable.
  base_url: "https://commerce.errandlr.com",
  staging_base_url: null,

  env: {
    ERRANDLR_TOKEN: { required: true },
    ERRANDLR_TEST_TOKEN: { required: true, staging: true },
  },

  auth: {
    headers: {
      Authorization: {
        source: "secret",
        secret_ref: "ERRANDLR_TOKEN",
        staging_secret_ref: "ERRANDLR_TEST_TOKEN",
        prefix: "Bearer ",
      },
    },
  },

  estimate: {
    method: "POST",
    path: "/v2/estimate",
    body_map: {
      dropoffLocations: {
        type: "array",
        single_item: true,
        items: {
          type: "object",
          schema: {
            id: {
              join: {
                fields: ["destination_latitude", "destination_longitude"],
                separator: ",",
              },
            },
            label: { from: "destination_address", required: true },
          },
        },
      },
      pickupLocation: {
        type: "object",
        schema: {
          id: {
            join: {
              fields: ["pickup_latitude", "pickup_longitude"],
              separator: ",",
            },
          },
          label: { from: "pickup_address", required: true },
        },
      },
    },
    success_check: { from: "status", equals: "success" },
    extract: {
      price: { from: "estimate" },
      duration: { from: "estimateLabel" },
      meta: {
        type: "object",
        schema: { geoid: { from: "geoId" } },
      },
    },
  },

  create: {
    method: "POST",
    path: "/request",
    body_map: {
      geoId: { from: "geoid" },
      name: { from: "sender_name", required: true },
      email: { from: "sender_email" },
      phone: { from: "sender_phone", required: true },
      latitude: { from: "pickup_latitude", required: true },
      longitude: { from: "pickup_longitude", required: true },
      pickupNotes: { from: "pickup_notes" },
      deliverToInformation: {
        type: "array",
        single_item: true,
        items: {
          type: "object",
          schema: {
            order: { const: 1 },
            name: { from: "order_name" },
            phone: { from: "recipient_phone", required: true },
            packageDetail: { from: "package_detail" },
            deliveryNotes: { from: "delivery_notes" },
          },
        },
      },
      state: { from: "destination_state" },
      country: { from: "destination_country" },
      city: { from: "destination_city" },
      localGovt: { from: "local_govt" },
    },
    success_check: { from: "status", equals: 200 },
    extract: {
      courier_key: { from: "trackingId" },
      courier_response: { from: "$root" },
    },
  },

  webhook: {
    verify: {
      type: "hmac",
      header: "x-errandlr-signature",
      algorithm: "sha512",
      secret_ref: "ERRANDLR_TOKEN",
      staging_secret_ref: "ERRANDLR_TEST_TOKEN",
    },
    tracking_id: { from: "data.tracking.0.trackingId" },
    status_value: { from: "status", split: ".", index: 1 },
    status_map: {
      CREATED: 2,
      ACCEPTED: 4,
      COLLECTED: 7,
      COMPLETED: 10,
      CLOSED: 10,
    },
  },
};

export const kwikpik = {
  name: "kwikpik",
  base_url: "https://logistics-api.kwikpik.io",
  staging_base_url: "https://logistics-sandbox.kwikpik.io",

  env: {
    KWIKPIK_TOKEN: { required: true },
    KWIKPIK_TEST_TOKEN: { required: true, staging: true },
  },

  auth: {
    headers: {
      "x-api-key": {
        source: "secret",
        secret_ref: "KWIKPIK_TOKEN",
        staging_secret_ref: "KWIKPIK_TEST_TOKEN",
      },
    },
  },

  estimate: {
    method: "POST",
    path: "/api/v2/orders/estimate",
    body_map: {
      packages: {
        type: "array",
        single_item: true,
        items: {
          type: "object",
          schema: {
            deliveryAddress: { from: "destination_address", required: true },
          },
        },
      },
      pickupAddress: { from: "pickup_address", required: true },
    },
    success_check: { from: "data", exists: true },
    extract: {
      price: { from: "data.totalEstimatedPrice" },
      duration: { from: "data.totalEstimatedDuration" },
    },
  },

  create: {
    method: "POST",
    path: "/api/v2/orders/unified",
    // Matches original's `reference || crypto.randomUUID()` exactly (falls
    // back on "" too, not just null/undefined) — same mechanism used for
    // Fez's client-generated reference.
    ensure_reference_field: "reference",
    body_map: {
      orders: {
        type: "array",
        single_item: true,
        items: {
          type: "object",
          schema: {
            merchantPackageNumber: { from: "reference", required: true },
            pickupAddress: { from: "pickup_address", required: true },
            pickupLatitude: { from: "pickup_latitude", required: true },
            pickupLongitude: { from: "pickup_longitude", required: true },
            pickupContactName: { from: "sender_name", required: true },
            pickupContactPhone: { from: "sender_phone", required: true },
            pickupContactEmail: { from: "sender_email" },
            deliveryAddress: { from: "destination_address", required: true },
            deliveryLatitude: { from: "destination_latitude", required: true },
            deliveryLongitude: {
              from: "destination_longitude",
              required: true,
            },
            deliveryContactName: { from: "recipient_name", required: true },
            deliveryContactPhone: { from: "recipient_phone", required: true },
            deliveryContactEmail: { from: "recipient_email" },
            deliveryNotes: { from: "delivery_note" },
            description: { from: "package_detail" },
            packageWeightInKg: { from: "package_weight" },
            quantity: { const: 1 },
            packageValue: { from: "value_of_item" },
            items: {
              type: "array",
              single_item: true,
              items: {
                type: "object",
                schema: {
                  name: { from: "order_name" },
                  quantity: { const: 1 },
                },
              },
            },
            metadata: { type: "object", schema: {} },
          },
        },
      },
    },
    // Original unwraps `data = data?.data` before checking `data.successful`
    // — paths below are written against the raw (un-unwrapped) response,
    // so everything is prefixed with "data." to land in the same spot.
    success_check: { from: "data.successful", exists: true },
    extract: {
      courier_key: { from: "data.successful.0.packageInformation.trackingId" },
      courier_response: { from: "data.result" },
    },
  },

  webhook: {
    verify: {
      type: "hmac_timestamped_header",
      header: "x-kwikpik-signature",
      algorithm: "sha256",
      secret_ref: "KWIKPIK_TOKEN",
      staging_secret_ref: "KWIKPIK_TEST_TOKEN",
      timestamp_key: "t",
      signature_key: "v1",
      max_skew_seconds: 300, // matches original's 5-minute window
      // optional: true   <- uncomment to restore "missing header = accept" behavior
    },
    // Original reads `event.status || event?.data?.status` and
    // `event.requestId || event?.data?.trackingId` — same fallback shape.
    tracking_id: { from: "requestId", fallback: "data.trackingId" },
    status_value: { from: "status", fallback: "data.status" },
    status_map: {
      PENDING: 2,
      CONFIRMED: 2,
      ACCPETED: 4,
      PICKED_UP: 5,
      IN_TRANSIT: 7,
      ARRIVED_DESTINATION: 8,
      COMPLETED: 10,
      CANCELLED: -1,
    },
  },
};

export default [chowdeck, dellyman, fez, kwik, errandlr, kwikpik];
