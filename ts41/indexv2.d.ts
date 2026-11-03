/**
 * Calculates the approximate number of bytes that the provided object holds.
 * @param object
 */
declare function sizeof<T>(object: T): number;
declare namespace sizeof {
  // for `import sizeof from 'object-sizeof'` compiled without esModuleInterop
  export { sizeof as default };
}
export = sizeof;
