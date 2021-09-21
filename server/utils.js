const toCamel = (s) => {
  return s.replace(/([-_][a-z])/gi, ($1) => {
    return $1.toUpperCase().replace("-", "").replace("_", "");
  });
};

const isArray = function (a) {
  return Array.isArray(a);
};

const isObject = function (o) {
  return o === Object(o) && !isArray(o) && typeof o !== "function";
};

export const keysToCamel = function (o) {
  if (isObject(o)) {
    const n = {};

    Object.keys(o).forEach((k) => {
      n[toCamel(k)] = keysToCamel(o[k]);
    });

    return n;
  } else if (isArray(o)) {
    return o.map((i) => {
      return keysToCamel(i);
    });
  }

  return o;
};

export const keysToUnderscore = (obj) => {
  if (typeof obj != "object") return obj;

  for (var oldName in obj) {
    // Camel to underscore
    const newName = oldName.replace(/([A-Z])/g, function ($1) {
      return "_" + $1.toLowerCase();
    });

    // Only process if names are different
    if (newName != oldName) {
      // Check for the old property name to avoid a ReferenceError in strict mode.
      if (obj.hasOwnProperty(oldName)) {
        obj[newName] = obj[oldName];
        delete obj[oldName];
      }
    }

    // Recursion
    if (typeof obj[newName] == "object") {
      obj[newName] = keysToUnderscore(obj[newName]);
    }
  }
  return obj;
};
