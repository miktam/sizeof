'use strict'

const NUMBER_BYTES = 8
const BOOLEAN_BYTES = 4

// Below this length the JS loop beats a call into Node's native code
const NATIVE_MIN_LENGTH = 16

// Node.js's own Buffer, read off globalThis so that bundlers do not inject
// a Buffer polyfill. Used only on Node.js (browser apps often install the
// npm `buffer` polyfill as a global, and its byteLength copies the string),
// and only if it counts unpaired surrogates as UTF-8 does (Bun 1.3 does not).
const NodeBuffer = (function () {
  try {
    const g = typeof globalThis !== 'undefined' ? globalThis : null
    const isNode = g !== null && g.process && g.process.versions && g.process.versions.node
    const candidate = isNode && g.Buffer && typeof g.Buffer.byteLength === 'function' ? g.Buffer : null
    const probe = '\ud800'.repeat(NATIVE_MIN_LENGTH)
    return candidate !== null && candidate.byteLength(probe, 'utf8') === 3 * NATIVE_MIN_LENGTH ? candidate : null
  } catch (ex) {
    // a tampered `process` or Buffer must not stop the module from loading
    return null
  }
})()

const objectTag = Object.prototype.toString

function getter (proto, name) {
  const descriptor = Object.getOwnPropertyDescriptor(proto, name)
  return descriptor ? descriptor.get : null
}

// Getters and methods that read a built-in's internal slot. Calling one is
// a brand check: it throws for anything but the real built-in, cannot be
// fooled by Symbol.toStringTag, a borrowed prototype or an overridden
// method, and works across realms (iframes, vm contexts, Jest).
const TypedArray = Object.getPrototypeOf(Uint8Array.prototype)
const typedArrayByteLength = getter(TypedArray, 'byteLength')
// returns undefined for anything but a typed array, without throwing
const typedArrayTag = getter(TypedArray, Symbol.toStringTag)
const dataViewByteLength = getter(DataView.prototype, 'byteLength')
const arrayBufferByteLength = getter(ArrayBuffer.prototype, 'byteLength')
const sharedArrayBufferByteLength = typeof SharedArrayBuffer === 'function' ? getter(SharedArrayBuffer.prototype, 'byteLength') : null
const mapSize = getter(Map.prototype, 'size')
const setSize = getter(Set.prototype, 'size')
const regExpSource = getter(RegExp.prototype, 'source')
const regExpFlags = getter(RegExp.prototype, 'flags')
const blobSize = typeof Blob === 'function' ? getter(Blob.prototype, 'size') : null
const dateValue = Date.prototype.getTime
const boxedValueOf = {
  String: String.prototype.valueOf,
  Number: Number.prototype.valueOf,
  Boolean: Boolean.prototype.valueOf,
  Symbol: Symbol.prototype.valueOf,
  BigInt: typeof BigInt === 'function' ? BigInt.prototype.valueOf : null
}
// reads size through the object, so through a proxy's get trap
const forwardedSize = function () { return this.size }

/**
 * Calls a slot-reading getter, returning undefined instead of throwing when
 * the object is not the matching built-in
 */
function readSlot (read, object) {
  if (read === null) return undefined
  try {
    return read.call(object)
  } catch (ex) {
    return undefined
  }
}

/**
 * Whether the object lists its own Symbol.toStringTag, or null if a proxy's
 * ownKeys trap throws. Listed through the ownKeys trap, not probed through
 * getOwnPropertyDescriptor, whose trap may create the key it is asked about.
 */
function listsOwnTag (object) {
  try {
    return Object.getOwnPropertySymbols(object).indexOf(Symbol.toStringTag) !== -1
  } catch (ex) {
    return null
  }
}

/**
 * Number of bytes in the UTF-8 encoding of a string, counted without
 * allocating the encoded copy. Longer strings in Node.js are counted natively.
 * Unpaired surrogates count as 3 bytes, as with Buffer and TextEncoder,
 * which replace them with U+FFFD.
 * @param {string} str
 */
function utf8ByteLength (str) {
  if (NodeBuffer !== null && str.length >= NATIVE_MIN_LENGTH) {
    return NodeBuffer.byteLength(str, 'utf8')
  }
  let bytes = 0
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code < 0x80) {
      bytes += 1
    } else if (code < 0x800) {
      bytes += 2
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4
        i++
      } else {
        bytes += 3
      }
    } else {
      bytes += 3
    }
  }
  return bytes
}

/**
 * Own enumerable property keys, symbols included
 */
function ownKeys (object) {
  const keys = Object.keys(object)
  const symbols = Object.getOwnPropertySymbols(object)
  for (let i = 0; i < symbols.length; i++) {
    if (Object.prototype.propertyIsEnumerable.call(object, symbols[i])) {
      keys.push(symbols[i])
    }
  }
  return keys
}

/**
 * An array's length as a loop bound: a proxy can report any value
 */
function arrayLength (array) {
  // converted once: a length object's valueOf could answer differently each time
  const length = Number(array.length)
  return length >= 0 && length <= 0xffffffff ? Math.floor(length) : 0
}

/**
 * Byte length of a typed array or DataView; 0 once its buffer is detached
 * or shrunk out of range (a DataView's getter throws then)
 */
function viewByteLength (view) {
  if (typedArrayTag.call(view) !== undefined) return typedArrayByteLength.call(view)
  return readSlot(dataViewByteLength, view) || 0
}

/**
 * Whether a proxy over a Map or Set that forwards size, as Vue's reactive()
 * and on-change do, or a look-alike such as an Immer 9 draft, hands out an
 * entries() or values() other than the built-in one. A proxy has no internal
 * slots of its own, so the brand check rejects it, and so would the
 * built-in method.
 */
function isForwardingProxy (object, Collection, method) {
  return object instanceof Collection && typeof readSlot(forwardedSize, object) === 'number' &&
    object[method] !== Collection.prototype[method]
}

/**
 * Iterator from such an object's entries() or values(), or null if it
 * rejects the object. Only a method its prototype defines can: a proxy that
 * hands one out unbound makes it see the proxy, which a subclass's #private
 * fields reject. That method's first step is taken here; a look-alike's
 * class method, as Immer 9's drafts have, passes it.
 */
function iterateForwarded (object, method) {
  const own = object[method]
  if (own !== Object.getPrototypeOf(object)[method]) return own.call(object)
  let iterator, first
  try {
    iterator = own.call(object)
    first = iterator.next()
  } catch (ex) {
    return null
  }
  return {
    next () {
      if (first === null) return iterator.next()
      const step = first
      first = null
      return step
    }
  }
}

/**
 * Set of objects already counted. V8 caps a single Set at 2^24 entries, so
 * a new Set is started whenever the current one is full.
 */
function createSeen () {
  const sets = [new Set()]
  return function isNew (object) {
    for (let i = 0; i < sets.length; i++) {
      if (sets[i].has(object)) return false
    }
    try {
      sets[sets.length - 1].add(object)
    } catch (ex) {
      sets.push(new Set([object]))
    }
    return true
  }
}

/**
 * Approximate number of bytes held by a value: UTF-8 bytes of strings and
 * property names, 8 per number, 4 per boolean, byteLength of binary data.
 * Each object is counted once, so shared and circular references are fine.
 *
 * Objects are walked with an explicit stack instead of recursion or
 * serialization, so the extra memory needed grows with the number of
 * distinct objects and the nesting depth, not with the length of strings
 * or arrays.
 *
 * @param {*} value
 * @returns {number} size in bytes, or -1 if a getter, toJSON or proxy trap
 * threw, or a proxy was revoked
 */
function sizeof (value) {
  // primitives need no walk: skip allocating the seen-set, stack and closures
  switch (typeof value) {
    case 'string': return utf8ByteLength(value)
    case 'number': return NUMBER_BYTES
    case 'boolean': return BOOLEAN_BYTES
    case 'undefined': return 0
  }
  if (value === null) return 0

  const isNew = createSeen()
  // Containers being walked, innermost last. Each one yields its children
  // one at a time, so a wide array never gets copied onto the stack.
  const stack = []
  let bytes = 0

  function add (value) {
    switch (typeof value) {
      case 'string':
        bytes += utf8ByteLength(value)
        return
      case 'number':
        bytes += NUMBER_BYTES
        return
      case 'boolean':
        bytes += BOOLEAN_BYTES
        return
      case 'bigint':
        bytes += value.toString().length
        return
      case 'symbol':
        // 'Symbol(description)' -> 'description'
        bytes += utf8ByteLength(String(value).slice(7, -1))
        return
      case 'function':
        if (!isNew(value)) return
        bytes += utf8ByteLength(Function.prototype.toString.call(value))
        return
      case 'object':
        if (value === null || !isNew(value)) return
        if (ArrayBuffer.isView(value)) {
          bytes += viewByteLength(value)
        } else if (Array.isArray(value)) {
          // length is read once, as JSON.stringify does, so an array that
          // grows while it is being walked cannot keep the loop going
          stack.push({ object: value, keys: null, iterator: null, pairs: false, index: 0, length: arrayLength(value) })
        } else {
          addObject(value)
        }
    }
  }

  // set while adding what a toJSON returned: JSON.stringify does not call
  // toJSON again on that value itself, only on the values inside it
  let fromJSON = false
  // set when reading the tag of the object being added created its own
  // Symbol.toStringTag key, as a get trap that creates whatever key it is
  // asked for does
  let tagCreated = false

  function addObject (object) {
    const skipJSON = fromJSON
    fromJSON = false
    tagCreated = false
    const proto = Object.getPrototypeOf(object)
    // plain objects, the common case, skip the built-in checks
    if ((proto !== Object.prototype && proto !== null && addBuiltIn(object)) || (!skipJSON && addJSON(object))) return
    let keys = ownKeys(object)
    if (tagCreated) keys = keys.filter(key => key !== Symbol.toStringTag)
    stack.push({ object, keys, iterator: null, pairs: false, index: 0, length: keys.length })
  }

  // Same-realm Maps, Sets, Dates, RegExps and ArrayBuffers, subclasses
  // included, are recognized with instanceof, whatever their
  // Symbol.toStringTag says; other built-ins, and those from other realms,
  // by their tag. Either way, the internal slot decides.
  function addBuiltIn (object) {
    let kind
    if (object instanceof Map) kind = 'Map'
    else if (object instanceof Set) kind = 'Set'
    else if (object instanceof Date) kind = 'Date'
    else if (object instanceof RegExp) kind = 'RegExp'
    else if (object instanceof ArrayBuffer) kind = 'ArrayBuffer'
    else {
      // the tag is read through a proxy's get trap, which may throw on a
      // symbol key, or create the key it is asked for
      const hadTag = listsOwnTag(object)
      const tag = readSlot(objectTag, object)
      tagCreated = hadTag === false && listsOwnTag(object) === true
      kind = tag === undefined ? '' : tag.slice(8, -1)
    }

    switch (kind) {
      case 'Map': {
        // the object's own entries(): caches such as quick-lru keep their
        // data in private Maps and override it
        let entries
        if (readSlot(mapSize, object) !== undefined) entries = object.entries()
        else if (!isForwardingProxy(object, Map, 'entries') || (entries = iterateForwarded(object, 'entries')) === null) return false
        stack.push({ object, keys: null, iterator: entries, pairs: true, index: 0, length: 0 })
        return true
      }
      case 'Set': {
        let values
        if (readSlot(setSize, object) !== undefined) values = object.values()
        else if (!isForwardingProxy(object, Set, 'values') || (values = iterateForwarded(object, 'values')) === null) return false
        stack.push({ object, keys: null, iterator: values, pairs: false, index: 0, length: 0 })
        return true
      }
      case 'Date':
        if (readSlot(dateValue, object) === undefined) return false
        bytes += NUMBER_BYTES
        return true
      case 'RegExp': {
        const source = readSlot(regExpSource, object)
        if (source === undefined) return false
        bytes += utf8ByteLength('/' + source + '/' + (readSlot(regExpFlags, object) || ''))
        return true
      }
      case 'ArrayBuffer':
      case 'SharedArrayBuffer': {
        const length = readSlot(kind === 'ArrayBuffer' ? arrayBufferByteLength : sharedArrayBufferByteLength, object)
        if (length === undefined) return false
        bytes += length
        return true
      }
      case 'Blob':
      case 'File': {
        const size = readSlot(blobSize, object)
        if (size === undefined) return false
        bytes += size
        return true
      }
      case 'String':
      case 'Number':
      case 'Boolean':
      case 'Symbol':
      case 'BigInt': {
        // boxed primitive, e.g. new String('abc')
        const primitive = readSlot(boxedValueOf[kind], object)
        if (primitive === undefined) return false
        add(primitive)
        return true
      }
      default:
        return false
    }
  }

  // An object with a toJSON method is measured by what toJSON returns, as
  // JSON.stringify would serialize it: a moment or Decimal is its string,
  // not its internals and shared locale tables
  function addJSON (object) {
    // `in` first: a proxy that creates whatever key is read, as a
    // defaultdict does, would otherwise grow a toJSON child at every level
    if (!('toJSON' in object) || typeof object.toJSON !== 'function') return false
    const json = object.toJSON('')
    // as JSON.stringify does, the keys are listed after toJSON ran
    if (json === object) return false
    fromJSON = true
    add(json)
    fromJSON = false
    return true
  }

  try {
    add(value)
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]
      if (frame.iterator !== null) {
        const step = frame.iterator.next()
        if (step.done) {
          stack.pop()
        } else if (frame.pairs) {
          add(step.value[0])
          add(step.value[1])
        } else {
          add(step.value)
        }
      } else if (frame.index < frame.length) {
        const index = frame.index++
        // leaving before the last child is walked keeps a long chain, such
        // as a linked list, from holding a frame per level
        if (frame.index >= frame.length) stack.pop()
        if (frame.keys !== null) {
          const key = frame.keys[index]
          add(key)
          add(frame.object[key])
        } else {
          add(frame.object[index])
        }
      } else {
        stack.pop()
      }
    }
  } catch (ex) {
    // a getter, toJSON or proxy trap threw; do not let measuring crash the caller
    return -1
  }

  return bytes
}

module.exports = sizeof
// lets `import sizeof from 'object-sizeof'` work when compiled to CommonJS without esModuleInterop
module.exports.default = sizeof
