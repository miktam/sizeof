// TypeScript 4.1 and later read ts41/indexv2.d.ts
declare module 'object-sizeof' {
/**
 * Calculates the approximate number of bytes that the provided object holds.
 * @param object
 */
	export default function sizeof<T>(object: T): number;
}
