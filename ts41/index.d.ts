/**
 * Approximate number of bytes held by a value: UTF-8 bytes of strings and
 * property names, 8 per number, 4 per boolean, byteLength of binary data.
 * @param object
 * @returns size in bytes, or -1 if a getter, toJSON or proxy trap threw, or a proxy was revoked
 */
declare function sizeof<T>(object: T): number;
declare namespace sizeof {
  // for `import sizeof from 'object-sizeof'` compiled without esModuleInterop
  export { sizeof as default };
}
export = sizeof;
