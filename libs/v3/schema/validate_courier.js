import { validate_node, validate_node_map, isPlainObject } from "./node.js";

const VALID_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const VALID_RESPONSE_TYPES = new Set(["json", "text-prefixed-json"]);
const VALID_VERIFY_TYPES = new Set([
  "hmac",
  "hmac_timestamped_header",
  "hmac_concat",
  "none",
]);

const is_url = (v) => {
  if (typeof v !== "string") return false;
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
};

const requires_equals_or_exists = (node, path, errors) => {
  if (node.equals === undefined && node.exists === undefined) {
    errors.push(`${path}: must set "equals" or "exists"`);
  }
};

// ---------------------------------------------------------------- base ----
function validate_courier_base(payload) {
  const errors = [];
  const { name, base_url, staging_base_url } = payload || {};

  if (typeof name !== "string" || !name.trim()) {
    errors.push("name: required non-empty string");
  } else if (!/^[a-z0-9_]+$/.test(name)) {
    errors.push(
      "name: lowercase letters, numbers, underscores only (this is the courier's registry key)",
    );
  }

  if (!is_url(base_url)) {
    errors.push("base_url: required, must be a valid URL");
  }

  if (
    staging_base_url !== undefined &&
    staging_base_url !== null &&
    !is_url(staging_base_url)
  ) {
    errors.push("staging_base_url: must be a valid URL, or null");
  }

  return { errors, warnings: [] };
}

// ---------------------------------------------------------------- auth ----
function validate_auth(auth) {
  if (!isPlainObject(auth))
    return { errors: ["auth: must be an object"], warnings: [] };
  const errors = [];
  const { login, headers } = auth;

  if (login !== undefined) {
    if (!isPlainObject(login)) {
      errors.push("auth.login: must be an object");
    } else {
      if (typeof login.path !== "string" || !login.path.startsWith("/")) {
        errors.push("auth.login.path: required, must start with /");
      }
      if (!VALID_METHODS.has(login.method)) {
        errors.push(
          `auth.login.method: must be one of ${[...VALID_METHODS].join(", ")}`,
        );
      }
      if (login.body_map !== undefined) {
        errors.push(
          ...validate_node_map(login.body_map, "auth.login.body_map"),
        );
      }
      if (
        !isPlainObject(login.extract) ||
        Object.keys(login.extract).length === 0
      ) {
        errors.push("auth.login.extract: required, non-empty object of nodes");
      } else {
        errors.push(...validate_node_map(login.extract, "auth.login.extract"));
      }
    }
  }

  if (headers !== undefined) {
    errors.push(...validate_node_map(headers, "auth.headers"));
  }

  if (login === undefined && headers === undefined) {
    errors.push("auth: must define at least one of login or headers");
  }

  return { errors, warnings: [] };
}

// ------------------------------------------------------------ estimate ----
function validate_estimate(estimate) {
  if (!isPlainObject(estimate))
    return { errors: ["estimate: must be an object"], warnings: [] };
  const errors = [];

  if (typeof estimate.path !== "string" || !estimate.path.startsWith("/")) {
    errors.push("estimate.path: required, must start with /");
  }
  if (!VALID_METHODS.has(estimate.method)) {
    errors.push(
      `estimate.method: must be one of ${[...VALID_METHODS].join(", ")}`,
    );
  }
  if (estimate.body_map !== undefined) {
    errors.push(...validate_node_map(estimate.body_map, "estimate.body_map"));
  }

  if (!isPlainObject(estimate.success_check)) {
    errors.push("estimate.success_check: required node");
  } else {
    errors.push(
      ...validate_node(estimate.success_check, "estimate.success_check"),
    );
    requires_equals_or_exists(
      estimate.success_check,
      "estimate.success_check",
      errors,
    );
  }

  if (
    !isPlainObject(estimate.extract) ||
    estimate.extract.price === undefined
  ) {
    errors.push('estimate.extract: required, must include a "price" node');
  } else {
    errors.push(...validate_node_map(estimate.extract, "estimate.extract"));
  }

  return { errors, warnings: [] };
}

// -------------------------------------------------------- create_delivery -
function validate_create(create) {
  if (!isPlainObject(create))
    return { errors: ["create: must be an object"], warnings: [] };
  const errors = [];

  if (typeof create.path !== "string" || !create.path.startsWith("/")) {
    errors.push("create.path: required, must start with /");
  }
  if (!VALID_METHODS.has(create.method)) {
    errors.push(
      `create.method: must be one of ${[...VALID_METHODS].join(", ")}`,
    );
  }

  const hasBodyMap = create.body_map !== undefined;
  const hasBodyRoot = create.body_root !== undefined;
  if (hasBodyMap === hasBodyRoot) {
    errors.push("create: exactly one of body_map or body_root is required");
  } else if (hasBodyMap) {
    errors.push(...validate_node_map(create.body_map, "create.body_map"));
  } else {
    errors.push(...validate_node(create.body_root, "create.body_root"));
  }

  if (
    create.response_type !== undefined &&
    !VALID_RESPONSE_TYPES.has(create.response_type)
  ) {
    errors.push(
      `create.response_type: must be one of ${[...VALID_RESPONSE_TYPES].join(", ")}`,
    );
  }

  if (
    create.ensure_reference_field !== undefined &&
    typeof create.ensure_reference_field !== "string"
  ) {
    errors.push("create.ensure_reference_field: must be a string");
  }

  if (!isPlainObject(create.success_check)) {
    errors.push("create.success_check: required node");
  } else {
    errors.push(...validate_node(create.success_check, "create.success_check"));
    requires_equals_or_exists(
      create.success_check,
      "create.success_check",
      errors,
    );
  }

  if (create.error_message !== undefined) {
    errors.push(...validate_node(create.error_message, "create.error_message"));
  }

  if (
    !isPlainObject(create.extract) ||
    create.extract.courier_key === undefined ||
    create.extract.courier_response === undefined
  ) {
    errors.push(
      'create.extract: required, must include "courier_key" and "courier_response" nodes',
    );
  } else {
    errors.push(...validate_node_map(create.extract, "create.extract"));
  }

  return { errors, warnings: [] };
}

// --------------------------------------------------------------- webhook --
function validate_verify(verify, path = "webhook.verify") {
  if (!isPlainObject(verify))
    return { errors: [`${path}: required object`], warnings: [] };
  const errors = [];
  const warnings = [];

  if (!VALID_VERIFY_TYPES.has(verify.type)) {
    errors.push(
      `${path}.type: must be one of ${[...VALID_VERIFY_TYPES].join(", ")}`,
    );
    return { errors, warnings };
  }

  if (verify.type === "none") {
    warnings.push(
      `${path}: type:"none" — incoming events are NOT authenticated`,
    );
    return { errors, warnings };
  }

  if (typeof verify.header !== "string" || !verify.header) {
    errors.push(`${path}.header: required string`);
  }
  if (!["sha256", "sha512"].includes(verify.algorithm)) {
    errors.push(`${path}.algorithm: must be "sha256" or "sha512"`);
  }
  if (typeof verify.secret_ref !== "string" || !verify.secret_ref) {
    errors.push(`${path}.secret_ref: required string`);
  }
  if (
    verify.staging_secret_ref !== undefined &&
    typeof verify.staging_secret_ref !== "string"
  ) {
    errors.push(`${path}.staging_secret_ref: must be a string`);
  }
  if (verify.optional !== undefined && typeof verify.optional !== "boolean") {
    errors.push(`${path}.optional: must be a boolean`);
  }
  if (verify.optional === true) {
    warnings.push(
      `${path}.optional is true — a request with NO signature header will be treated as verified`,
    );
  }

  if (verify.type === "hmac_concat") {
    if (
      !Array.isArray(verify.concat_fields) ||
      verify.concat_fields.length === 0
    ) {
      errors.push(
        `${path}.concat_fields: required non-empty array of field paths`,
      );
    } else if (!verify.concat_fields.every((f) => typeof f === "string")) {
      errors.push(`${path}.concat_fields: every entry must be a string`);
    }
  }

  if (verify.type === "hmac_timestamped_header") {
    if (typeof verify.timestamp_key !== "string") {
      errors.push(`${path}.timestamp_key: required string`);
    }
    if (typeof verify.signature_key !== "string") {
      errors.push(`${path}.signature_key: required string`);
    }
    if (
      verify.max_skew_seconds !== undefined &&
      typeof verify.max_skew_seconds !== "number"
    ) {
      errors.push(`${path}.max_skew_seconds: must be a number`);
    }
  }

  return { errors, warnings };
}

function validate_gate(gate, path = "webhook.gate") {
  if (gate === undefined) return [];
  const entries = Array.isArray(gate) ? gate : [gate];
  const errors = [];
  entries.forEach((entry, i) => {
    const p = Array.isArray(gate) ? `${path}[${i}]` : path;
    if (
      !isPlainObject(entry) ||
      typeof entry.from !== "string" ||
      entry.exists !== true
    ) {
      errors.push(`${p}: must be {from: <path>, exists: true}`);
    }
  });
  return errors;
}

function validate_webhook(webhook) {
  if (!isPlainObject(webhook)) {
    return { errors: ["webhook: must be an object"], warnings: [] };
  }
  const errors = [];
  const warnings = [];

  const verifyResult = validate_verify(webhook.verify);
  errors.push(...verifyResult.errors);
  warnings.push(...verifyResult.warnings);

  errors.push(...validate_gate(webhook.gate));

  if (!isPlainObject(webhook.tracking_id)) {
    errors.push("webhook.tracking_id: required node");
  } else {
    errors.push(...validate_node(webhook.tracking_id, "webhook.tracking_id"));
  }

  if (!isPlainObject(webhook.status_value)) {
    errors.push("webhook.status_value: required node");
  } else {
    errors.push(...validate_node(webhook.status_value, "webhook.status_value"));
  }

  if (!isPlainObject(webhook.status_map)) {
    errors.push(
      "webhook.status_map: required object of {STATUS_STRING: ongoing_status_int}",
    );
  } else {
    if (Object.keys(webhook.status_map).length === 0) {
      warnings.push(
        "webhook.status_map is empty — every event will be silently ignored until it's filled in",
      );
    }
    for (const [key, value] of Object.entries(webhook.status_map)) {
      if (!Number.isInteger(value)) {
        errors.push(`webhook.status_map.${key}: must be an integer`);
      }
    }
  }

  if (webhook.replay_protection !== undefined) {
    const rp = webhook.replay_protection;
    if (!isPlainObject(rp)) {
      errors.push("webhook.replay_protection: must be an object");
    } else {
      if (typeof rp.timestamp_field !== "string") {
        errors.push(
          "webhook.replay_protection.timestamp_field: must be a string",
        );
      }
      if (typeof rp.max_skew_seconds !== "number") {
        errors.push(
          "webhook.replay_protection.max_skew_seconds: must be a number",
        );
      }
    }
  }

  return { errors, warnings };
}

const validate_secrets = (secrets) => {
  const errors = [];
  if (!secrets || typeof secrets !== "object" || Array.isArray(secrets)) {
    errors.push("secrets must be a plain object");
    return { errors };
  }
  for (const [key, value] of Object.entries(secrets)) {
    if (typeof key !== "string" || !key.trim()) {
      errors.push(`Invalid secret key: ${key}`);
    }
    if (typeof value !== "string") {
      errors.push(`Secret "${key}" must be a string`);
    }
  }
  return { errors };
};

export {
  validate_secrets,
  validate_courier_base,
  validate_auth,
  validate_estimate,
  validate_create,
  validate_webhook,
};
