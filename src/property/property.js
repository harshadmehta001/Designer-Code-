(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.property = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

/**
 * Expose `parse`.
 */

module.exports = parse;

/**
 * Tests for browser support.
 */

var innerHTMLBug = false;
var bugTestDiv;
if (typeof document !== 'undefined') {
  bugTestDiv = document.createElement('div');
  // Setup
  bugTestDiv.innerHTML = '  <link/><table></table><a href="/a">a</a><input type="checkbox"/>';
  // Make sure that link elements get serialized correctly by innerHTML
  // This requires a wrapper element in IE
  innerHTMLBug = !bugTestDiv.getElementsByTagName('link').length;
  bugTestDiv = undefined;
}

/**
 * Wrap map from jquery.
 */

var map = {
  legend: [1, '<fieldset>', '</fieldset>'],
  tr: [2, '<table><tbody>', '</tbody></table>'],
  col: [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>'],
  // for script/link/style tags to work in IE6-8, you have to wrap
  // in a div with a non-whitespace character in front, ha!
  _default: innerHTMLBug ? [1, 'X<div>', '</div>'] : [0, '', '']
};

map.td =
map.th = [3, '<table><tbody><tr>', '</tr></tbody></table>'];

map.option =
map.optgroup = [1, '<select multiple="multiple">', '</select>'];

map.thead =
map.tbody =
map.colgroup =
map.caption =
map.tfoot = [1, '<table>', '</table>'];

map.polyline =
map.ellipse =
map.polygon =
map.circle =
map.text =
map.line =
map.path =
map.rect =
map.g = [1, '<svg xmlns="http://www.w3.org/2000/svg" version="1.1">','</svg>'];

/**
 * Parse `html` and return a DOM Node instance, which could be a TextNode,
 * HTML DOM Node of some kind (<div> for example), or a DocumentFragment
 * instance, depending on the contents of the `html` string.
 *
 * @param {String} html - HTML string to "domify"
 * @param {Document} doc - The `document` instance to create the Node for
 * @return {DOMNode} the TextNode, DOM Node, or DocumentFragment instance
 * @api private
 */

function parse(html, doc) {
  if ('string' != typeof html) throw new TypeError('String expected');

  // default to the global `document` object
  if (!doc) doc = document;

  // tag name
  var m = /<([\w:]+)/.exec(html);
  if (!m) return doc.createTextNode(html);

  html = html.replace(/^\s+|\s+$/g, ''); // Remove leading/trailing whitespace

  var tag = m[1];

  // body support
  if (tag == 'body') {
    var el = doc.createElement('html');
    el.innerHTML = html;
    return el.removeChild(el.lastChild);
  }

  // wrap map
  var wrap = map[tag] || map._default;
  var depth = wrap[0];
  var prefix = wrap[1];
  var suffix = wrap[2];
  var el = doc.createElement('div');
  el.innerHTML = prefix + html + suffix;
  while (depth--) el = el.lastChild;

  // one element
  if (el.firstChild == el.lastChild) {
    return el.removeChild(el.firstChild);
  }

  // several elements
  var fragment = doc.createDocumentFragment();
  while (el.firstChild) {
    fragment.appendChild(el.removeChild(el.firstChild));
  }

  return fragment;
}

},{}],2:[function(require,module,exports){
/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/* Native method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates a function that invokes `func` with the `this` binding of the
 * created function and arguments from `start` and beyond provided as an array.
 *
 * **Note:** This method is based on the [rest parameter](https://developer.mozilla.org/Web/JavaScript/Reference/Functions/rest_parameters).
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 * @example
 *
 * var say = _.restParam(function(what, names) {
 *   return what + ' ' + _.initial(names).join(', ') +
 *     (_.size(names) > 1 ? ', & ' : '') + _.last(names);
 * });
 *
 * say('hello', 'fred', 'barney', 'pebbles');
 * // => 'hello fred, barney, & pebbles'
 */
function restParam(func, start) {
  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  start = nativeMax(start === undefined ? (func.length - 1) : (+start || 0), 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        rest = Array(length);

    while (++index < length) {
      rest[index] = args[start + index];
    }
    switch (start) {
      case 0: return func.call(this, rest);
      case 1: return func.call(this, args[0], rest);
      case 2: return func.call(this, args[0], args[1], rest);
    }
    var otherArgs = Array(start + 1);
    index = -1;
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = rest;
    return func.apply(this, otherArgs);
  };
}

module.exports = restParam;

},{}],3:[function(require,module,exports){
var keys = require('../object/keys');

/**
 * A specialized version of `_.assign` for customizing assigned values without
 * support for argument juggling, multiple sources, and `this` binding `customizer`
 * functions.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @param {Function} customizer The function to customize assigned values.
 * @returns {Object} Returns `object`.
 */
function assignWith(object, source, customizer) {
  var index = -1,
      props = keys(source),
      length = props.length;

  while (++index < length) {
    var key = props[index],
        value = object[key],
        result = customizer(value, source[key], key, object, source);

    if ((result === result ? (result !== value) : (value === value)) ||
        (value === undefined && !(key in object))) {
      object[key] = result;
    }
  }
  return object;
}

module.exports = assignWith;

},{"../object/keys":23}],4:[function(require,module,exports){
var baseCopy = require('./baseCopy'),
    keys = require('../object/keys');

/**
 * The base implementation of `_.assign` without support for argument juggling,
 * multiple sources, and `customizer` functions.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @returns {Object} Returns `object`.
 */
function baseAssign(object, source) {
  return source == null
    ? object
    : baseCopy(source, keys(source), object);
}

module.exports = baseAssign;

},{"../object/keys":23,"./baseCopy":5}],5:[function(require,module,exports){
/**
 * Copies properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property names to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @returns {Object} Returns `object`.
 */
function baseCopy(source, props, object) {
  object || (object = {});

  var index = -1,
      length = props.length;

  while (++index < length) {
    var key = props[index];
    object[key] = source[key];
  }
  return object;
}

module.exports = baseCopy;

},{}],6:[function(require,module,exports){
/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

module.exports = baseProperty;

},{}],7:[function(require,module,exports){
var identity = require('../utility/identity');

/**
 * A specialized version of `baseCallback` which only supports `this` binding
 * and specifying the number of arguments to provide to `func`.
 *
 * @private
 * @param {Function} func The function to bind.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {number} [argCount] The number of arguments to provide to `func`.
 * @returns {Function} Returns the callback.
 */
function bindCallback(func, thisArg, argCount) {
  if (typeof func != 'function') {
    return identity;
  }
  if (thisArg === undefined) {
    return func;
  }
  switch (argCount) {
    case 1: return function(value) {
      return func.call(thisArg, value);
    };
    case 3: return function(value, index, collection) {
      return func.call(thisArg, value, index, collection);
    };
    case 4: return function(accumulator, value, index, collection) {
      return func.call(thisArg, accumulator, value, index, collection);
    };
    case 5: return function(value, other, key, object, source) {
      return func.call(thisArg, value, other, key, object, source);
    };
  }
  return function() {
    return func.apply(thisArg, arguments);
  };
}

module.exports = bindCallback;

},{"../utility/identity":25}],8:[function(require,module,exports){
var bindCallback = require('./bindCallback'),
    isIterateeCall = require('./isIterateeCall'),
    restParam = require('../function/restParam');

/**
 * Creates a `_.assign`, `_.defaults`, or `_.merge` function.
 *
 * @private
 * @param {Function} assigner The function to assign values.
 * @returns {Function} Returns the new assigner function.
 */
function createAssigner(assigner) {
  return restParam(function(object, sources) {
    var index = -1,
        length = object == null ? 0 : sources.length,
        customizer = length > 2 ? sources[length - 2] : undefined,
        guard = length > 2 ? sources[2] : undefined,
        thisArg = length > 1 ? sources[length - 1] : undefined;

    if (typeof customizer == 'function') {
      customizer = bindCallback(customizer, thisArg, 5);
      length -= 2;
    } else {
      customizer = typeof thisArg == 'function' ? thisArg : undefined;
      length -= (customizer ? 1 : 0);
    }
    if (guard && isIterateeCall(sources[0], sources[1], guard)) {
      customizer = length < 3 ? undefined : customizer;
      length = 1;
    }
    while (++index < length) {
      var source = sources[index];
      if (source) {
        assigner(object, source, customizer);
      }
    }
    return object;
  });
}

module.exports = createAssigner;

},{"../function/restParam":2,"./bindCallback":7,"./isIterateeCall":13}],9:[function(require,module,exports){
var baseProperty = require('./baseProperty');

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

module.exports = getLength;

},{"./baseProperty":6}],10:[function(require,module,exports){
var isNative = require('../lang/isNative');

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

module.exports = getNative;

},{"../lang/isNative":20}],11:[function(require,module,exports){
var getLength = require('./getLength'),
    isLength = require('./isLength');

/**
 * Checks if `value` is array-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 */
function isArrayLike(value) {
  return value != null && isLength(getLength(value));
}

module.exports = isArrayLike;

},{"./getLength":9,"./isLength":14}],12:[function(require,module,exports){
/** Used to detect unsigned integer values. */
var reIsUint = /^\d+$/;

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

module.exports = isIndex;

},{}],13:[function(require,module,exports){
var isArrayLike = require('./isArrayLike'),
    isIndex = require('./isIndex'),
    isObject = require('../lang/isObject');

/**
 * Checks if the provided arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call, else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
      ? (isArrayLike(object) && isIndex(index, object.length))
      : (type == 'string' && index in object)) {
    var other = object[index];
    return value === value ? (value === other) : (other !== other);
  }
  return false;
}

module.exports = isIterateeCall;

},{"../lang/isObject":21,"./isArrayLike":11,"./isIndex":12}],14:[function(require,module,exports){
/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

module.exports = isLength;

},{}],15:[function(require,module,exports){
/**
 * Checks if `value` is object-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

module.exports = isObjectLike;

},{}],16:[function(require,module,exports){
var isArguments = require('../lang/isArguments'),
    isArray = require('../lang/isArray'),
    isIndex = require('./isIndex'),
    isLength = require('./isLength'),
    keysIn = require('../object/keysIn');

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * A fallback implementation of `Object.keys` which creates an array of the
 * own enumerable property names of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function shimKeys(object) {
  var props = keysIn(object),
      propsLength = props.length,
      length = propsLength && object.length;

  var allowIndexes = !!length && isLength(length) &&
    (isArray(object) || isArguments(object));

  var index = -1,
      result = [];

  while (++index < propsLength) {
    var key = props[index];
    if ((allowIndexes && isIndex(key, length)) || hasOwnProperty.call(object, key)) {
      result.push(key);
    }
  }
  return result;
}

module.exports = shimKeys;

},{"../lang/isArguments":17,"../lang/isArray":18,"../object/keysIn":24,"./isIndex":12,"./isLength":14}],17:[function(require,module,exports){
var isArrayLike = require('../internal/isArrayLike'),
    isObjectLike = require('../internal/isObjectLike');

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Native method references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * Checks if `value` is classified as an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  return isObjectLike(value) && isArrayLike(value) &&
    hasOwnProperty.call(value, 'callee') && !propertyIsEnumerable.call(value, 'callee');
}

module.exports = isArguments;

},{"../internal/isArrayLike":11,"../internal/isObjectLike":15}],18:[function(require,module,exports){
var getNative = require('../internal/getNative'),
    isLength = require('../internal/isLength'),
    isObjectLike = require('../internal/isObjectLike');

/** `Object#toString` result references. */
var arrayTag = '[object Array]';

/** Used for native method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/* Native method references for those with the same name as other `lodash` methods. */
var nativeIsArray = getNative(Array, 'isArray');

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(function() { return arguments; }());
 * // => false
 */
var isArray = nativeIsArray || function(value) {
  return isObjectLike(value) && isLength(value.length) && objToString.call(value) == arrayTag;
};

module.exports = isArray;

},{"../internal/getNative":10,"../internal/isLength":14,"../internal/isObjectLike":15}],19:[function(require,module,exports){
var isObject = require('./isObject');

/** `Object#toString` result references. */
var funcTag = '[object Function]';

/** Used for native method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in older versions of Chrome and Safari which return 'function' for regexes
  // and Safari 8 which returns 'object' for typed array constructors.
  return isObject(value) && objToString.call(value) == funcTag;
}

module.exports = isFunction;

},{"./isObject":21}],20:[function(require,module,exports){
var isFunction = require('./isFunction'),
    isObjectLike = require('../internal/isObjectLike');

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var fnToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(fnToString.call(value));
  }
  return isObjectLike(value) && reIsHostCtor.test(value);
}

module.exports = isNative;

},{"../internal/isObjectLike":15,"./isFunction":19}],21:[function(require,module,exports){
/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

module.exports = isObject;

},{}],22:[function(require,module,exports){
var assignWith = require('../internal/assignWith'),
    baseAssign = require('../internal/baseAssign'),
    createAssigner = require('../internal/createAssigner');

/**
 * Assigns own enumerable properties of source object(s) to the destination
 * object. Subsequent sources overwrite property assignments of previous sources.
 * If `customizer` is provided it's invoked to produce the assigned values.
 * The `customizer` is bound to `thisArg` and invoked with five arguments:
 * (objectValue, sourceValue, key, object, source).
 *
 * **Note:** This method mutates `object` and is based on
 * [`Object.assign`](http://ecma-international.org/ecma-262/6.0/#sec-object.assign).
 *
 * @static
 * @memberOf _
 * @alias extend
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @param {Function} [customizer] The function to customize assigned values.
 * @param {*} [thisArg] The `this` binding of `customizer`.
 * @returns {Object} Returns `object`.
 * @example
 *
 * _.assign({ 'user': 'barney' }, { 'age': 40 }, { 'user': 'fred' });
 * // => { 'user': 'fred', 'age': 40 }
 *
 * // using a customizer callback
 * var defaults = _.partialRight(_.assign, function(value, other) {
 *   return _.isUndefined(value) ? other : value;
 * });
 *
 * defaults({ 'user': 'barney' }, { 'age': 36 }, { 'user': 'fred' });
 * // => { 'user': 'barney', 'age': 36 }
 */
var assign = createAssigner(function(object, source, customizer) {
  return customizer
    ? assignWith(object, source, customizer)
    : baseAssign(object, source);
});

module.exports = assign;

},{"../internal/assignWith":3,"../internal/baseAssign":4,"../internal/createAssigner":8}],23:[function(require,module,exports){
var getNative = require('../internal/getNative'),
    isArrayLike = require('../internal/isArrayLike'),
    isObject = require('../lang/isObject'),
    shimKeys = require('../internal/shimKeys');

/* Native method references for those with the same name as other `lodash` methods. */
var nativeKeys = getNative(Object, 'keys');

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/6.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
var keys = !nativeKeys ? shimKeys : function(object) {
  var Ctor = object == null ? undefined : object.constructor;
  if ((typeof Ctor == 'function' && Ctor.prototype === object) ||
      (typeof object != 'function' && isArrayLike(object))) {
    return shimKeys(object);
  }
  return isObject(object) ? nativeKeys(object) : [];
};

module.exports = keys;

},{"../internal/getNative":10,"../internal/isArrayLike":11,"../internal/shimKeys":16,"../lang/isObject":21}],24:[function(require,module,exports){
var isArguments = require('../lang/isArguments'),
    isArray = require('../lang/isArray'),
    isIndex = require('../internal/isIndex'),
    isLength = require('../internal/isLength'),
    isObject = require('../lang/isObject');

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  if (object == null) {
    return [];
  }
  if (!isObject(object)) {
    object = Object(object);
  }
  var length = object.length;
  length = (length && isLength(length) &&
    (isArray(object) || isArguments(object)) && length) || 0;

  var Ctor = object.constructor,
      index = -1,
      isProto = typeof Ctor == 'function' && Ctor.prototype === object,
      result = Array(length),
      skipIndexes = length > 0;

  while (++index < length) {
    result[index] = (index + '');
  }
  for (var key in object) {
    if (!(skipIndexes && isIndex(key, length)) &&
        !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = keysIn;

},{"../internal/isIndex":12,"../internal/isLength":14,"../lang/isArguments":17,"../lang/isArray":18,"../lang/isObject":21}],25:[function(require,module,exports){
/**
 * This method returns the first argument provided to it.
 *
 * @static
 * @memberOf _
 * @category Utility
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'user': 'fred' };
 *
 * _.identity(object) === object;
 * // => true
 */
function identity(value) {
  return value;
}

module.exports = identity;

},{}],26:[function(require,module,exports){
module.exports = require('domify');
},{"domify":1}],27:[function(require,module,exports){
'use strict';

/* global window */
var domify = require('min-dom/lib/domify');
var kendoInstance = window.kendo;
var jQuery = window.jQuery;

/**
 * A properties panel implementation.
 *
 * @param {Object} config
 * @param {EventBus} eventBus
 * @param {Modeling} modeling
 * @param {CommandStack} commandStack
 * @param {Canvas} canvas
 * @param {Model} model
 */
function PropertiesPanel(config, eventBus, modeling, commandStack, canvas, model) {
    this._eventBus = eventBus;
    this._modeling = modeling;
    this._commandStack = commandStack;
    this._canvas = canvas;
    this._model = model;
    this._element = null;
    this._parentInitialStateId = null;
    this._oldData = {};
    this._init();
}

PropertiesPanel.$inject = ['config.propertiesPanel', 'eventBus', 'modeling', 'commandStack', 'canvas', 'model'];

module.exports = PropertiesPanel;

PropertiesPanel.prototype._init = function () {
    var eventBus = this._eventBus;
    var self = this;

    eventBus.on('propertywindow.changed', function (e) {
        var newElement = e.element[0], parentNode;

        if (newElement) {
            parentNode = self._canvas._container.parentElement.parentNode;
            if (parentNode) {
                attachTo.call(self, parentNode);
                self._element = newElement;
                self._oldData = JSON.stringify(newElement.businessObject);
                update.call(self, newElement);
                self._propertyWindow.center();
                self._propertyWindow.open();
            } else {
                throw 'Not able to resolve parent node';
            }
        } else if (self._container) {
            detach.call(this);
        }
    });
};

function attachTo(parentNode) {
    var propertyWindow;
    this._container = domify('<div id="impactWrightPropertyEditor"></div>');
    parentNode.appendChild(this._container);

    propertyWindow = jQuery('#impactWrightPropertyEditor')
        .kendoWindow({
            iframe: true,
            title: 'Edit Properties',
            resizable: true,
            draggable: true,
            modal: true
        })
        .data('kendoWindow');

    this._propertyWindow = propertyWindow;

    this._emit('attach');
}

function detach() {
    var container = this._container,
        parentNode = container.parentNode;

    if (!parentNode) {
        return;
    }

    this._emit('detach');

    parentNode.removeChild(container);

    this._container = null;
    this._propertyWindow.close();
}

function update(element) {
    var self = this; //PropertiesPanel Object
    var currentBO = element.businessObject;

    var viewModel = kendoInstance.observable(currentBO);

    create.call(this, viewModel);

    kendoInstance.bind(this._container, viewModel);

    viewModel.bind('change', function (e) {
        var parent, newLabel;
        if (e.field === 'gfx.labelVisible') {
            currentBO.gfx.labelVisible = this.gfx.labelVisible;
            newLabel = this['action'];
            self._modeling.updateLabel(element, newLabel);
        } else {
            currentBO[e.field] = this[e.field];
            if (e.field === 'name' || e.field === 'action') {
                newLabel = this[e.field];
                self._modeling.updateLabel(element, newLabel);
            } else if (e.field === 'tracksHistory' || e.field === 'withHistory') {
                self._modeling.redraw(element);
            } else if (e.field === 'isInitial') {
                parent = currentBO.parentId === null ? self._model : self._model.children[currentBO.parentId];
                if (typeof parent.initialStateId !== 'undefined') {
                    self._parentInitialStateId = parent.initialStateId;
                    if (currentBO.state === 'start') {
                        currentBO.state = 'intermediate';
                        parent.initialStateId = null;
                    } else {
                        currentBO.state = 'start';
                        parent.initialStateId = currentBO.id;
                    }
                }
                self._modeling.redraw(element);
            }
        }
    });

    return viewModel;
}

function create(viewModel) {

    var containerNode = this._container;

    var editorFields = getEditorFields.call(this, viewModel);

    containerNode.appendChild(editorFields);

    attachActions.call(this);
}

function getEditorFields(viewModel) {
    var returnNode = '';

    if (viewModel.type === 'atomic-state') {
        if (viewModel.state === 'final') {
            returnNode = getFieldsForFinal();
        }
        else {
            returnNode = getFieldsForAtomic();
        }
    }
    else if (viewModel.type === 'compound-state') {
        returnNode = getFieldsForCompound();
    } else if (viewModel.type === 'parallel-state') {
        returnNode = getFieldsForParallel();
    } else if (viewModel.type === 'region') {
        returnNode = getFieldsForRegion();
    } else if (viewModel.type === 'transition') {
        returnNode =
            viewModel.sourceStateId === viewModel.targetStateId
                ? getFieldsForSelfTransition()
                : getFieldsForTransition();
    }

    returnNode = domify(returnNode + getActions());

    return returnNode;
}

function attachActions() {
    var self = this;
    var parent, oldData, label, ele;
    oldData = JSON.parse(self._oldData);
    if (oldData.type === 'atomic-state' || oldData.type === 'parallel-state' || oldData.type === 'compound-state') {
        self._parentInitialStateId = getParentInitialStateId(oldData, self._model);
        if (self._parentInitialStateId !== null && self._parentInitialStateId !== oldData.id) {
            jQuery('#checkInitial').attr('disabled', true);
            jQuery('#checkInitial').parent().append('<span class="PropertyEditor">Parent initial state already set</span>');
        }
    }
    jQuery('#impactWrightPropertyEditor').find('#btnOk').click(function () {
        // render current data 
        ele = self._element; label = ele.businessObject.name || ele.businessObject.action;
        self._modeling.updateLabel(ele, label);
        self._modeling.redraw(ele);
        detach.call(self);
    });

    jQuery('#impactWrightPropertyEditor').find('#btnCancel').click(function () {
        //render old data
        self._element.businessObject = oldData;
        ele = self._element; label = ele.businessObject.name || ele.businessObject.action;
        self._modeling.updateLabel(ele, label);
        if (typeof oldData.isInitial !== 'undefined') {
            parent = getParent(oldData, self._model);
            if (typeof parent.initialStateId !== 'undefined') {
                parent.initialStateId = self._parentInitialStateId;
            }
        }
        self._modeling.redraw(self._element);
        detach.call(self);
    });
}

function getParent(bo, model) {
    var parent;
    parent = (bo.parentId === null ? model : model.children[bo.parentId]);
    return parent;
}

function getParentInitialStateId(bo, model) {
    var parent, initialStateId;
    parent = getParent(bo, model);
    if (typeof parent.initialStateId !== 'undefined') {
        initialStateId = parent.initialStateId;
    }
    return initialStateId;
}

function getBaseFieldForRender() {
    var innerHtml =
        '<tr>' +
        '<td width="140px" style="text-align:left;">Key:</td>' +
        '<td><input type="text" id="txtKey"  data-bind="value: key" style="width: 300px;" /></td>' +
        '</tr>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Name:</td>' +
        '<td><input type="text" id="txtName"  data-bind="value: name" style="width: 300px;" /></td>' +
        '</tr>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;vertical-align: top;">Guard:</td>' +
        '<td><textarea rows="4" id="txtGuard" data-bind="value: guard" style="width: 300px;resize: none;" ></textarea></td>' +
        '</tr>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;vertical-align: top;">Guard Error Message:</td>' +
        '<td><textarea rows="4" id="txtGuardMessage" data-bind="value: guardMessage" style="width: 300px;resize: none;" ></textarea></td>' +
        '</tr>';

    return innerHtml;
}

function getFieldsForAtomic() {
    var inputNode =
        '<div class="PropertyEditor">' +
        '<table>' +
        getBaseFieldForRender() +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Reset History:</td>' +
        '<td><input type="checkbox" id="chkResetH"  data-bind="checked: resetHistory" /></td>' +
        '</tr>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Is Initial:</td>' +
        '<td><input type="checkbox" id="checkInitial"  data-bind="checked: isInitial" /></td>' +
        '</tr>' +
        '</table>' +
        '</div>';

    return inputNode;
}

function getFieldsForFinal() {
    var inputNode =
        '<div class="PropertyEditor">' +
        '<table>' +
        getBaseFieldForRender() +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Reset History:</td>' +
        '<td><input type="checkbox" id="chkResetH"  data-bind="checked: resetHistory" /></td>' +
        '</tr>' +
        '<tr>' +
        '</table>' +
        '</div>';

    return inputNode;
}

function getFieldsForCompound() {
    var inputNode =
        '<div class="PropertyEditor">' +
        '<table>' +
        getBaseFieldForRender() +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Tracks History:</td>' +
        '<td><input type="checkbox" id="checkTrackH"  data-bind="checked: tracksHistory" /></td>' +
        '</tr>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Is Initial:</td>' +
        '<td><input type="checkbox" id="checkInitial"  data-bind="checked: isInitial" /></td>' +
        '</tr>' +
        '</table>' +
        '</div>';

    return inputNode;
}

function getFieldsForParallel() {
    var inputNode =
        '<div class="PropertyEditor">' +
        '<table>' +
        getBaseFieldForRender() +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Is Initial:</td>' +
        '<td><input type="checkbox" id="checkInitial"  data-bind="checked: isInitial" /></td>' +
        '</tr>' +
        '</table>' +
        '</div>';

    return inputNode;
}

function getFieldsForRegion() {
    var inputNode =
        '<div class="PropertyEditor">' +
        '<table>' +
        getBaseFieldForRender() +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Tracks History:</td>' +
        '<td><input type="checkbox" id="checkRegionTH"  data-bind="checked: tracksHistory" /></td>' +
        '</tr>' +
        '</table>' +
        '</div>';

    return inputNode;
}

function getFieldsForTransition() {
    var inputNode =
        '<div class="PropertyEditor">' +
        '<table>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Action:</td>' +
        '<td><input type="text" id="txtTranAction"  data-bind="value: action" style="width: 300px;" /></td>' +
        '</tr>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;">With History:</td>' +
        '<td><input type="checkbox" id="chkWithH"  data-bind="checked: withHistory" /></td>' +
        '</tr>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Show Label:</td>' +
        '<td><input type="checkbox" id="chkLblVisible"  data-bind="checked: gfx.labelVisible"  /></td>' +
        '</tr>' +
        '</table>' +
        '</div>';

    return inputNode;
}

function getFieldsForSelfTransition() {
    var inputNode =
        '<div class="PropertyEditor">' +
        '<table>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Action:</td>' +
        '<td><input type="text" id="txtTranAction"  data-bind="value: action" style="width: 300px;" /></td>' +
        '</tr>' +
        '<tr>' +
        '<td width="140px" style="text-align:left;">Show Label:</td>' +
        '<td><input type="checkbox" id="chkLblVisible"  data-bind="checked: gfx.labelVisible"  /></td>' +
        '</tr>' +
        '</table>' +
        '</div>';

    return inputNode;
}
function getActions() {
    var buttonNode =
        '<hr><div style="float:right;"><input type="button" id="btnOk" name="Ok" value="OK"> <input type="button" id="btnCancel" name="Cancel" value="Cancel"></div>';

    return buttonNode;
}

PropertiesPanel.prototype._emit = function (event) {
    this._eventBus.fire('propertiesPanel.' + event, { panel: this });
};

},{"min-dom/lib/domify":26}],28:[function(require,module,exports){
'use strict';

var assign = require('lodash/object/assign');

/**
 * A provider for Property Window option elements context pad
 * 
 * @param {ContextPad} contextPad
 * @param {Modeling} modeling
 * @param {Translate} translate
 */
function PropertyContextPadProvider(contextPad, modeling, translate) {
    contextPad.registerProvider(this);

    this._modeling = modeling;
    this._translate = translate;
}

PropertyContextPadProvider.$inject = [ 'contextPad', 'modeling', 'translate' ];

module.exports = PropertyContextPadProvider;

PropertyContextPadProvider.prototype.getContextPadEntries = function(element) {
    
    var modeling = this._modeling,
        translate = this._translate;

    var actions = {};

    if (element.type === 'label' || (element.type ==='transition' && element.isAuto === true)) {
        return actions;
    }

    assign(actions, {
        openpropertywindow: {
            group: 'custom-property-impact-kendo',
            className: 'wright-icon-property-edit',
            title: translate('Edit Properties'),
            action: {
                click: function(event, element) {
                    modeling.openPropertyWindow({ element: [element] });
                }
            }
        }
    });

    return actions;
};

},{"lodash/object/assign":22}],29:[function(require,module,exports){
'use strict';

module.exports.propertyWindow  = {
    __init__: [ 'propertiesPanel', 'propertyContextPadProvider' ],
    propertiesPanel: [ 'type', require('./PropertiesPanel')],
    propertyContextPadProvider: ['type', require('./PropertyContextPadProvider')]
};

},{"./PropertiesPanel":27,"./PropertyContextPadProvider":28}]},{},[29])(29)
});