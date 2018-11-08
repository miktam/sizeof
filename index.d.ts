declare module 'object-sizeof'{
    /**
     * Calculates Bytes for the provided parameter
     * 
     * @param object The given object/string/boolean/buffer
     * @returns The size
     */
    export default function sizeof<T>(object: T): number;
}
