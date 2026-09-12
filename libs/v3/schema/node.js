// Validates one "node" as used in body_map / body_root / schema / extract /
// success_check / gate / tracking_id / status_value across all courier
// configs. A node is one of:
//
//   array node   { type:"array", single_item:true, items:<node> }
//   object node  { type:"object", schema:{ key: <node>, ... } }
//   join node    { join: { fields:[...], separator } }
//   dynamic_key  { dynamic_key: { parent, key_from } }
//   leaf node    { from|const|source|default_computed, ... }
//
// This only checks *shape* (is it something the engine can resolve at all),
// not domain meaning — e.g. it won't tell you `from: "totally.wrong.path"`
// points nowhere, since that depends on data the engine only sees at
// runtime.

const VALID_SOURCES = new Set(["computed", "secret"]);

const isPlainObject = (v) =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const err = (path, message) => `${path}: ${message}`;

function validate_node(node, path = "$") {
  if (!isPlainObject(node)) return [err(path, "must be an object")];

  // --- array node -----------------------------------------------------
  if (node.type === "array") {
    const errors = [];
    if (node.single_item !== true) {
      errors.push(
        err(path, `type:"array" currently only supports single_item:true`),
      );
    }
    if (node.items === undefined) {
      errors.push(err(path, `array node requires "items"`));
    } else {
      errors.push(...validate_node(node.items, `${path}.items`));
    }
    return errors;
  }

  // --- object node ------------------------------------------------------
  if (node.type === "object") {
    const errors = [];
    if (!isPlainObject(node.schema)) {
      errors.push(err(path, `object node requires "schema" (an object)`));
    } else {
      for (const [key, child] of Object.entries(node.schema)) {
        errors.push(...validate_node(child, `${path}.schema.${key}`));
      }
    }
    return errors;
  }

  // --- join node --------------------------------------------------------
  if (node.join) {
    const errors = [];
    const { fields, separator } = node.join;
    if (!Array.isArray(fields) || fields.length < 2) {
      errors.push(err(path, `join.fields must be an array of 2+ strings`));
    } else if (!fields.every((f) => typeof f === "string")) {
      errors.push(err(path, `join.fields must all be strings`));
    }
    if (typeof separator !== "string") {
      errors.push(err(path, `join.separator must be a string`));
    }
    return errors;
  }

  // --- dynamic_key node ---------------------------------------------------
  if (node.dynamic_key) {
    const errors = [];
    const { parent, key_from } = node.dynamic_key;
    if (typeof parent !== "string" || !parent) {
      errors.push(err(path, `dynamic_key.parent must be a non-empty string`));
    }
    if (typeof key_from !== "string" || !key_from) {
      errors.push(err(path, `dynamic_key.key_from must be a non-empty string`));
    }
    return errors;
  }

  // --- leaf node ----------------------------------------------------------
  const errors = [];
  const producers = ["from", "const", "source", "default_computed"].filter(
    (k) => node[k] !== undefined,
  );

  if (producers.length === 0) {
    errors.push(
      err(
        path,
        `leaf node needs one of: from, const, source, default_computed, join, dynamic_key`,
      ),
    );
  }

  if (node.source !== undefined) {
    if (!VALID_SOURCES.has(node.source)) {
      errors.push(err(path, `source must be "computed" or "secret"`));
    }
    if (node.source === "computed" && typeof node.from !== "string") {
      errors.push(
        err(path, `source:"computed" requires "from" (the computed key)`),
      );
    }
    if (node.source === "secret" && typeof node.secret_ref !== "string") {
      errors.push(err(path, `source:"secret" requires "secret_ref"`));
    }
  }

  if (
    node.staging_secret_ref !== undefined &&
    typeof node.staging_secret_ref !== "string"
  ) {
    errors.push(err(path, `staging_secret_ref must be a string`));
  }

  if (
    node.default_computed !== undefined &&
    typeof node.default_computed !== "string"
  ) {
    errors.push(err(path, `default_computed must be a string`));
  }

  if (node.from !== undefined && typeof node.from !== "string") {
    errors.push(err(path, `from must be a string path`));
  }

  if (node.fallback !== undefined && typeof node.fallback !== "string") {
    errors.push(err(path, `fallback must be a string path`));
  }

  if (node.prefix !== undefined && typeof node.prefix !== "string") {
    errors.push(err(path, `prefix must be a string`));
  }

  if (node.required !== undefined && typeof node.required !== "boolean") {
    errors.push(err(path, `required must be a boolean`));
  }

  if (node.transform !== undefined && typeof node.transform !== "string") {
    errors.push(err(path, `transform must be a string`));
  }

  if (node.type !== undefined && !["number", "string"].includes(node.type)) {
    errors.push(err(path, `leaf type must be "number" or "string"`));
  }

  if (node.exists !== undefined && typeof node.exists !== "boolean") {
    errors.push(err(path, `exists must be a boolean`));
  }

  if (node.split !== undefined && typeof node.split !== "string") {
    errors.push(err(path, `split must be a string`));
  }

  if (node.index !== undefined && typeof node.index !== "number") {
    errors.push(err(path, `index must be a number`));
  }

  return errors;
}

const validate_node_map = (map, path = "$") => {
  if (!isPlainObject(map)) return [err(path, "must be an object of nodes")];
  const errors = [];
  for (const [key, node] of Object.entries(map)) {
    errors.push(...validate_node(node, `${path}.${key}`));
  }
  return errors;
};

export { validate_node, validate_node_map, isPlainObject, err };
