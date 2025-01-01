export function cleanObject<T extends Record<string, any>>(obj: T, ignoreNull = false): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  // Create a new object to avoid mutating the original
  const cleanedObj: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if ((!ignoreNull && value === null) || value === undefined || value === '') {
      continue; // Skip null, undefined, and empty string values
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      // Recursively clean nested objects
      const cleanedValue = cleanObject(value);
      if (Object.keys(cleanedValue).length > 0) {
        cleanedObj[key] = cleanedValue;
      }
    } else if (Array.isArray(value)) {
      // Clean arrays
      const cleanedArray = value
        .map((item) => (typeof item === 'object' ? cleanObject(item, ignoreNull) : item))
        .filter((item) => (!ignoreNull && item !== null) && item !== undefined && item !== '');

      if (cleanedArray.length > 0) {
        cleanedObj[key] = cleanedArray;
      }
    } else {
      cleanedObj[key] = value;
    }
  }

  return cleanedObj as T;
}

/**
 * Sets a deep property in an object, creating nested objects as needed.
 * @param obj - The target object.
 * @param value - The value to set at the given path.
 * @param path - The path to the property, specified as a rest parameter.
 */
export function setDeepProp(obj: Record<string, any>, value: any, ...path: (string | number)[]): void {
  if (!obj || path.length === 0) {
    throw new Error('Target object and path must be provided.');
  }

  let current: any = obj;

  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    const isLast = i === path.length - 1;

    if (isLast) {
      current[key] = value; // Set the final value
    } else {
      if (current[key] === undefined || current[key] === null) {
        // Create an object or array if the next key is numeric
        current[key] = typeof path[i + 1] === 'number' ? [] : {};
      }

      if (typeof current[key] !== 'object') {
        throw new Error(`Cannot set property at path ${path.slice(0, i + 1).join('.')}.`);
      }

      current = current[key];
    }
  }
}

export function safeSum(a: number | undefined, b: number | undefined) {
  return (a ?? 0) + (b ?? 0);
}

export function max(num1: number, num2: number): number {
  return Math.max(num1, num2)
}
