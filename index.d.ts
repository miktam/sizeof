// For TypeScript 4.0 and older, and tools that ignore typesVersions;
// TypeScript 4.1 and later read ts41/index.d.ts
/**
 * Approximate number of bytes held by a value: UTF-8 bytes of strings and
 * property names, 8 per number, 4 per boolean, byteLength of binary data.
 * @param object
 * @returns size in bytes, or -1 if a getter, toJSON or proxy trap threw, or a proxy was revoked
 */
export default function sizeof<T>(object: T): number;
