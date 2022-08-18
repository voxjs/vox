/**
 * Make a map and return a function for checking if a key
 * is in that map.
 * IMPORTANT: all calls of this function must be prefixed with
 * \/\*#\_\_PURE\_\_\*\/
 * So that rollup can tree-shake them if necessary.
 */
function makeMap(str, expectsLowerCase) {
    const map = Object.create(null);
    const list = str.split(',');
    for (let i = 0; i < list.length; i++) {
        map[list[i]] = true;
    }
    return expectsLowerCase ? val => !!map[val.toLowerCase()] : val => !!map[val];
}
const extend = Object.assign;
const hasOwnProperty = Object.prototype.hasOwnProperty;
const hasOwn = (val, key) => hasOwnProperty.call(val, key);
const isArray = Array.isArray;
const isMap = (val) => toTypeString(val) === '[object Map]';
const isString = (val) => typeof val === 'string';
const isSymbol = (val) => typeof val === 'symbol';
const isObject = (val) => val !== null && typeof val === 'object';
const objectToString = Object.prototype.toString;
const toTypeString = (value) => objectToString.call(value);
const toRawType = (value) => {
    // extract "RawType" from strings like "[object RawType]"
    return toTypeString(value).slice(8, -1);
};
const isIntegerKey = (key) => isString(key) &&
    key !== 'NaN' &&
    key[0] !== '-' &&
    '' + parseInt(key, 10) === key;
const cacheStringFunction = (fn) => {
    const cache = Object.create(null);
    return ((str) => {
        const hit = cache[str];
        return hit || (cache[str] = fn(str));
    });
};
const camelizeRE = /-(\w)/g;
/**
 * @private
 */
const camelize = cacheStringFunction((str) => {
    return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''));
});
const hyphenateRE = /\B([A-Z])/g;
/**
 * @private
 */
const hyphenate = cacheStringFunction((str) => str.replace(hyphenateRE, '-$1').toLowerCase());
// compare whether a value has changed, accounting for NaN.
const hasChanged = (value, oldValue) => !Object.is(value, oldValue);

let activeEffectScope;
function recordEffectScope(effect, scope = activeEffectScope) {
    if (scope && scope.active) {
        scope.effects.push(effect);
    }
}

const createDep = (effects) => {
    const dep = new Set(effects);
    dep.w = 0;
    dep.n = 0;
    return dep;
};
const wasTracked = (dep) => (dep.w & trackOpBit) > 0;
const newTracked = (dep) => (dep.n & trackOpBit) > 0;
const initDepMarkers = ({ deps }) => {
    if (deps.length) {
        for (let i = 0; i < deps.length; i++) {
            deps[i].w |= trackOpBit; // set was tracked
        }
    }
};
const finalizeDepMarkers = (effect) => {
    const { deps } = effect;
    if (deps.length) {
        let ptr = 0;
        for (let i = 0; i < deps.length; i++) {
            const dep = deps[i];
            if (wasTracked(dep) && !newTracked(dep)) {
                dep.delete(effect);
            }
            else {
                deps[ptr++] = dep;
            }
            // clear bits
            dep.w &= ~trackOpBit;
            dep.n &= ~trackOpBit;
        }
        deps.length = ptr;
    }
};

const targetMap = new WeakMap();
// The number of effects currently being tracked recursively.
let effectTrackDepth = 0;
let trackOpBit = 1;
/**
 * The bitwise track markers support at most 30 levels of recursion.
 * This value is chosen to enable modern JS engines to use a SMI on all platforms.
 * When recursion depth is greater, fall back to using a full cleanup.
 */
const maxMarkerBits = 30;
let activeEffect;
const ITERATE_KEY = Symbol('');
const MAP_KEY_ITERATE_KEY = Symbol('');
class ReactiveEffect {
    constructor(fn, scheduler = null, scope) {
        this.fn = fn;
        this.scheduler = scheduler;
        this.active = true;
        this.deps = [];
        this.parent = undefined;
        recordEffectScope(this, scope);
    }
    run() {
        if (!this.active) {
            return this.fn();
        }
        let parent = activeEffect;
        let lastShouldTrack = shouldTrack;
        while (parent) {
            if (parent === this) {
                return;
            }
            parent = parent.parent;
        }
        try {
            this.parent = activeEffect;
            activeEffect = this;
            shouldTrack = true;
            trackOpBit = 1 << ++effectTrackDepth;
            if (effectTrackDepth <= maxMarkerBits) {
                initDepMarkers(this);
            }
            else {
                cleanupEffect(this);
            }
            return this.fn();
        }
        finally {
            if (effectTrackDepth <= maxMarkerBits) {
                finalizeDepMarkers(this);
            }
            trackOpBit = 1 << --effectTrackDepth;
            activeEffect = this.parent;
            shouldTrack = lastShouldTrack;
            this.parent = undefined;
            if (this.deferStop) {
                this.stop();
            }
        }
    }
    stop() {
        // stopped while running itself - defer the cleanup
        if (activeEffect === this) {
            this.deferStop = true;
        }
        else if (this.active) {
            cleanupEffect(this);
            if (this.onStop) {
                this.onStop();
            }
            this.active = false;
        }
    }
}
function cleanupEffect(effect) {
    const { deps } = effect;
    if (deps.length) {
        for (let i = 0; i < deps.length; i++) {
            deps[i].delete(effect);
        }
        deps.length = 0;
    }
}
let shouldTrack = true;
const trackStack = [];
function pauseTracking() {
    trackStack.push(shouldTrack);
    shouldTrack = false;
}
function resetTracking() {
    const last = trackStack.pop();
    shouldTrack = last === undefined ? true : last;
}
function track(target, type, key) {
    if (shouldTrack && activeEffect) {
        let depsMap = targetMap.get(target);
        if (!depsMap) {
            targetMap.set(target, (depsMap = new Map()));
        }
        let dep = depsMap.get(key);
        if (!dep) {
            depsMap.set(key, (dep = createDep()));
        }
        trackEffects(dep);
    }
}
function trackEffects(dep, debuggerEventExtraInfo) {
    let shouldTrack = false;
    if (effectTrackDepth <= maxMarkerBits) {
        if (!newTracked(dep)) {
            dep.n |= trackOpBit; // set newly tracked
            shouldTrack = !wasTracked(dep);
        }
    }
    else {
        // Full cleanup mode.
        shouldTrack = !dep.has(activeEffect);
    }
    if (shouldTrack) {
        dep.add(activeEffect);
        activeEffect.deps.push(dep);
    }
}
function trigger(target, type, key, newValue, oldValue, oldTarget) {
    const depsMap = targetMap.get(target);
    if (!depsMap) {
        // never been tracked
        return;
    }
    let deps = [];
    if (type === "clear" /* CLEAR */) {
        // collection being cleared
        // trigger all effects for target
        deps = [...depsMap.values()];
    }
    else if (key === 'length' && isArray(target)) {
        depsMap.forEach((dep, key) => {
            if (key === 'length' || key >= newValue) {
                deps.push(dep);
            }
        });
    }
    else {
        // schedule runs for SET | ADD | DELETE
        if (key !== void 0) {
            deps.push(depsMap.get(key));
        }
        // also run for iteration key on ADD | DELETE | Map.SET
        switch (type) {
            case "add" /* ADD */:
                if (!isArray(target)) {
                    deps.push(depsMap.get(ITERATE_KEY));
                    if (isMap(target)) {
                        deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
                    }
                }
                else if (isIntegerKey(key)) {
                    // new index added to array -> length changes
                    deps.push(depsMap.get('length'));
                }
                break;
            case "delete" /* DELETE */:
                if (!isArray(target)) {
                    deps.push(depsMap.get(ITERATE_KEY));
                    if (isMap(target)) {
                        deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
                    }
                }
                break;
            case "set" /* SET */:
                if (isMap(target)) {
                    deps.push(depsMap.get(ITERATE_KEY));
                }
                break;
        }
    }
    if (deps.length === 1) {
        if (deps[0]) {
            {
                triggerEffects(deps[0]);
            }
        }
    }
    else {
        const effects = [];
        for (const dep of deps) {
            if (dep) {
                effects.push(...dep);
            }
        }
        {
            triggerEffects(createDep(effects));
        }
    }
}
function triggerEffects(dep, debuggerEventExtraInfo) {
    // spread into array for stabilization
    const effects = isArray(dep) ? dep : [...dep];
    for (const effect of effects) {
        if (effect.computed) {
            triggerEffect(effect);
        }
    }
    for (const effect of effects) {
        if (!effect.computed) {
            triggerEffect(effect);
        }
    }
}
function triggerEffect(effect, debuggerEventExtraInfo) {
    if (effect !== activeEffect || effect.allowRecurse) {
        if (effect.scheduler) {
            effect.scheduler();
        }
        else {
            effect.run();
        }
    }
}

const isNonTrackableKeys = /*#__PURE__*/ makeMap(`__proto__,__v_isRef,__isVue`);
const builtInSymbols = new Set(
/*#__PURE__*/
Object.getOwnPropertyNames(Symbol)
    // ios10.x Object.getOwnPropertyNames(Symbol) can enumerate 'arguments' and 'caller'
    // but accessing them on Symbol leads to TypeError because Symbol is a strict mode
    // function
    .filter(key => key !== 'arguments' && key !== 'caller')
    .map(key => Symbol[key])
    .filter(isSymbol));
const get = /*#__PURE__*/ createGetter();
const readonlyGet = /*#__PURE__*/ createGetter(true);
const shallowReadonlyGet = /*#__PURE__*/ createGetter(true, true);
const arrayInstrumentations = /*#__PURE__*/ createArrayInstrumentations();
function createArrayInstrumentations() {
    const instrumentations = {};
    ['includes', 'indexOf', 'lastIndexOf'].forEach(key => {
        instrumentations[key] = function (...args) {
            const arr = toRaw(this);
            for (let i = 0, l = this.length; i < l; i++) {
                track(arr, "get" /* GET */, i + '');
            }
            // we run the method using the original args first (which may be reactive)
            const res = arr[key](...args);
            if (res === -1 || res === false) {
                // if that didn't work, run it again using raw values.
                return arr[key](...args.map(toRaw));
            }
            else {
                return res;
            }
        };
    });
    ['push', 'pop', 'shift', 'unshift', 'splice'].forEach(key => {
        instrumentations[key] = function (...args) {
            pauseTracking();
            const res = toRaw(this)[key].apply(this, args);
            resetTracking();
            return res;
        };
    });
    return instrumentations;
}
function createGetter(isReadonly = false, shallow = false) {
    return function get(target, key, receiver) {
        if (key === "__v_isReactive" /* IS_REACTIVE */) {
            return !isReadonly;
        }
        else if (key === "__v_isReadonly" /* IS_READONLY */) {
            return isReadonly;
        }
        else if (key === "__v_isShallow" /* IS_SHALLOW */) {
            return shallow;
        }
        else if (key === "__v_raw" /* RAW */ &&
            receiver ===
                (isReadonly
                    ? shallow
                        ? shallowReadonlyMap
                        : readonlyMap
                    : shallow
                        ? shallowReactiveMap
                        : reactiveMap).get(target)) {
            return target;
        }
        const targetIsArray = isArray(target);
        if (!isReadonly && targetIsArray && hasOwn(arrayInstrumentations, key)) {
            return Reflect.get(arrayInstrumentations, key, receiver);
        }
        const res = Reflect.get(target, key, receiver);
        if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
            return res;
        }
        if (!isReadonly) {
            track(target, "get" /* GET */, key);
        }
        if (shallow) {
            return res;
        }
        if (isRef(res)) {
            // ref unwrapping - skip unwrap for Array + integer key.
            return targetIsArray && isIntegerKey(key) ? res : res.value;
        }
        if (isObject(res)) {
            // Convert returned value into a proxy as well. we do the isObject check
            // here to avoid invalid value warning. Also need to lazy access readonly
            // and reactive here to avoid circular dependency.
            return isReadonly ? readonly(res) : reactive(res);
        }
        return res;
    };
}
const set = /*#__PURE__*/ createSetter();
function createSetter(shallow = false) {
    return function set(target, key, value, receiver) {
        let oldValue = target[key];
        if (isReadonly(oldValue) && isRef(oldValue) && !isRef(value)) {
            return false;
        }
        if (!shallow && !isReadonly(value)) {
            if (!isShallow(value)) {
                value = toRaw(value);
                oldValue = toRaw(oldValue);
            }
            if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
                oldValue.value = value;
                return true;
            }
        }
        const hadKey = isArray(target) && isIntegerKey(key)
            ? Number(key) < target.length
            : hasOwn(target, key);
        const result = Reflect.set(target, key, value, receiver);
        // don't trigger if target is something up in the prototype chain of original
        if (target === toRaw(receiver)) {
            if (!hadKey) {
                trigger(target, "add" /* ADD */, key, value);
            }
            else if (hasChanged(value, oldValue)) {
                trigger(target, "set" /* SET */, key, value);
            }
        }
        return result;
    };
}
function deleteProperty(target, key) {
    const hadKey = hasOwn(target, key);
    target[key];
    const result = Reflect.deleteProperty(target, key);
    if (result && hadKey) {
        trigger(target, "delete" /* DELETE */, key, undefined);
    }
    return result;
}
function has(target, key) {
    const result = Reflect.has(target, key);
    if (!isSymbol(key) || !builtInSymbols.has(key)) {
        track(target, "has" /* HAS */, key);
    }
    return result;
}
function ownKeys(target) {
    track(target, "iterate" /* ITERATE */, isArray(target) ? 'length' : ITERATE_KEY);
    return Reflect.ownKeys(target);
}
const mutableHandlers = {
    get,
    set,
    deleteProperty,
    has,
    ownKeys
};
const readonlyHandlers = {
    get: readonlyGet,
    set(target, key) {
        return true;
    },
    deleteProperty(target, key) {
        return true;
    }
};
// Props handlers are special in the sense that it should not unwrap top-level
// refs (in order to allow refs to be explicitly passed down), but should
// retain the reactivity of the normal readonly object.
const shallowReadonlyHandlers = /*#__PURE__*/ extend({}, readonlyHandlers, {
    get: shallowReadonlyGet
});

const toShallow = (value) => value;
const getProto = (v) => Reflect.getPrototypeOf(v);
function get$1(target, key, isReadonly = false, isShallow = false) {
    // #1772: readonly(reactive(Map)) should return readonly + reactive version
    // of the value
    target = target["__v_raw" /* RAW */];
    const rawTarget = toRaw(target);
    const rawKey = toRaw(key);
    if (!isReadonly) {
        if (key !== rawKey) {
            track(rawTarget, "get" /* GET */, key);
        }
        track(rawTarget, "get" /* GET */, rawKey);
    }
    const { has } = getProto(rawTarget);
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
    if (has.call(rawTarget, key)) {
        return wrap(target.get(key));
    }
    else if (has.call(rawTarget, rawKey)) {
        return wrap(target.get(rawKey));
    }
    else if (target !== rawTarget) {
        // #3602 readonly(reactive(Map))
        // ensure that the nested reactive `Map` can do tracking for itself
        target.get(key);
    }
}
function has$1(key, isReadonly = false) {
    const target = this["__v_raw" /* RAW */];
    const rawTarget = toRaw(target);
    const rawKey = toRaw(key);
    if (!isReadonly) {
        if (key !== rawKey) {
            track(rawTarget, "has" /* HAS */, key);
        }
        track(rawTarget, "has" /* HAS */, rawKey);
    }
    return key === rawKey
        ? target.has(key)
        : target.has(key) || target.has(rawKey);
}
function size(target, isReadonly = false) {
    target = target["__v_raw" /* RAW */];
    !isReadonly && track(toRaw(target), "iterate" /* ITERATE */, ITERATE_KEY);
    return Reflect.get(target, 'size', target);
}
function add(value) {
    value = toRaw(value);
    const target = toRaw(this);
    const proto = getProto(target);
    const hadKey = proto.has.call(target, value);
    if (!hadKey) {
        target.add(value);
        trigger(target, "add" /* ADD */, value, value);
    }
    return this;
}
function set$1(key, value) {
    value = toRaw(value);
    const target = toRaw(this);
    const { has, get } = getProto(target);
    let hadKey = has.call(target, key);
    if (!hadKey) {
        key = toRaw(key);
        hadKey = has.call(target, key);
    }
    const oldValue = get.call(target, key);
    target.set(key, value);
    if (!hadKey) {
        trigger(target, "add" /* ADD */, key, value);
    }
    else if (hasChanged(value, oldValue)) {
        trigger(target, "set" /* SET */, key, value);
    }
    return this;
}
function deleteEntry(key) {
    const target = toRaw(this);
    const { has, get } = getProto(target);
    let hadKey = has.call(target, key);
    if (!hadKey) {
        key = toRaw(key);
        hadKey = has.call(target, key);
    }
    get ? get.call(target, key) : undefined;
    // forward the operation before queueing reactions
    const result = target.delete(key);
    if (hadKey) {
        trigger(target, "delete" /* DELETE */, key, undefined);
    }
    return result;
}
function clear() {
    const target = toRaw(this);
    const hadItems = target.size !== 0;
    // forward the operation before queueing reactions
    const result = target.clear();
    if (hadItems) {
        trigger(target, "clear" /* CLEAR */, undefined, undefined);
    }
    return result;
}
function createForEach(isReadonly, isShallow) {
    return function forEach(callback, thisArg) {
        const observed = this;
        const target = observed["__v_raw" /* RAW */];
        const rawTarget = toRaw(target);
        const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
        !isReadonly && track(rawTarget, "iterate" /* ITERATE */, ITERATE_KEY);
        return target.forEach((value, key) => {
            // important: make sure the callback is
            // 1. invoked with the reactive map as `this` and 3rd arg
            // 2. the value received should be a corresponding reactive/readonly.
            return callback.call(thisArg, wrap(value), wrap(key), observed);
        });
    };
}
function createIterableMethod(method, isReadonly, isShallow) {
    return function (...args) {
        const target = this["__v_raw" /* RAW */];
        const rawTarget = toRaw(target);
        const targetIsMap = isMap(rawTarget);
        const isPair = method === 'entries' || (method === Symbol.iterator && targetIsMap);
        const isKeyOnly = method === 'keys' && targetIsMap;
        const innerIterator = target[method](...args);
        const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
        !isReadonly &&
            track(rawTarget, "iterate" /* ITERATE */, isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY);
        // return a wrapped iterator which returns observed versions of the
        // values emitted from the real iterator
        return {
            // iterator protocol
            next() {
                const { value, done } = innerIterator.next();
                return done
                    ? { value, done }
                    : {
                        value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
                        done
                    };
            },
            // iterable protocol
            [Symbol.iterator]() {
                return this;
            }
        };
    };
}
function createReadonlyMethod(type) {
    return function (...args) {
        return type === "delete" /* DELETE */ ? false : this;
    };
}
function createInstrumentations() {
    const mutableInstrumentations = {
        get(key) {
            return get$1(this, key);
        },
        get size() {
            return size(this);
        },
        has: has$1,
        add,
        set: set$1,
        delete: deleteEntry,
        clear,
        forEach: createForEach(false, false)
    };
    const shallowInstrumentations = {
        get(key) {
            return get$1(this, key, false, true);
        },
        get size() {
            return size(this);
        },
        has: has$1,
        add,
        set: set$1,
        delete: deleteEntry,
        clear,
        forEach: createForEach(false, true)
    };
    const readonlyInstrumentations = {
        get(key) {
            return get$1(this, key, true);
        },
        get size() {
            return size(this, true);
        },
        has(key) {
            return has$1.call(this, key, true);
        },
        add: createReadonlyMethod("add" /* ADD */),
        set: createReadonlyMethod("set" /* SET */),
        delete: createReadonlyMethod("delete" /* DELETE */),
        clear: createReadonlyMethod("clear" /* CLEAR */),
        forEach: createForEach(true, false)
    };
    const shallowReadonlyInstrumentations = {
        get(key) {
            return get$1(this, key, true, true);
        },
        get size() {
            return size(this, true);
        },
        has(key) {
            return has$1.call(this, key, true);
        },
        add: createReadonlyMethod("add" /* ADD */),
        set: createReadonlyMethod("set" /* SET */),
        delete: createReadonlyMethod("delete" /* DELETE */),
        clear: createReadonlyMethod("clear" /* CLEAR */),
        forEach: createForEach(true, true)
    };
    const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator];
    iteratorMethods.forEach(method => {
        mutableInstrumentations[method] = createIterableMethod(method, false, false);
        readonlyInstrumentations[method] = createIterableMethod(method, true, false);
        shallowInstrumentations[method] = createIterableMethod(method, false, true);
        shallowReadonlyInstrumentations[method] = createIterableMethod(method, true, true);
    });
    return [
        mutableInstrumentations,
        readonlyInstrumentations,
        shallowInstrumentations,
        shallowReadonlyInstrumentations
    ];
}
const [mutableInstrumentations, readonlyInstrumentations, shallowInstrumentations, shallowReadonlyInstrumentations] = /* #__PURE__*/ createInstrumentations();
function createInstrumentationGetter(isReadonly, shallow) {
    const instrumentations = shallow
        ? isReadonly
            ? shallowReadonlyInstrumentations
            : shallowInstrumentations
        : isReadonly
            ? readonlyInstrumentations
            : mutableInstrumentations;
    return (target, key, receiver) => {
        if (key === "__v_isReactive" /* IS_REACTIVE */) {
            return !isReadonly;
        }
        else if (key === "__v_isReadonly" /* IS_READONLY */) {
            return isReadonly;
        }
        else if (key === "__v_raw" /* RAW */) {
            return target;
        }
        return Reflect.get(hasOwn(instrumentations, key) && key in target
            ? instrumentations
            : target, key, receiver);
    };
}
const mutableCollectionHandlers = {
    get: /*#__PURE__*/ createInstrumentationGetter(false, false)
};
const readonlyCollectionHandlers = {
    get: /*#__PURE__*/ createInstrumentationGetter(true, false)
};
const shallowReadonlyCollectionHandlers = {
    get: /*#__PURE__*/ createInstrumentationGetter(true, true)
};

const reactiveMap = new WeakMap();
const shallowReactiveMap = new WeakMap();
const readonlyMap = new WeakMap();
const shallowReadonlyMap = new WeakMap();
function targetTypeMap(rawType) {
    switch (rawType) {
        case 'Object':
        case 'Array':
            return 1 /* COMMON */;
        case 'Map':
        case 'Set':
        case 'WeakMap':
        case 'WeakSet':
            return 2 /* COLLECTION */;
        default:
            return 0 /* INVALID */;
    }
}
function getTargetType(value) {
    return value["__v_skip" /* SKIP */] || !Object.isExtensible(value)
        ? 0 /* INVALID */
        : targetTypeMap(toRawType(value));
}
function reactive(target) {
    // if trying to observe a readonly proxy, return the readonly version.
    if (isReadonly(target)) {
        return target;
    }
    return createReactiveObject(target, false, mutableHandlers, mutableCollectionHandlers, reactiveMap);
}
/**
 * Creates a readonly copy of the original object. Note the returned copy is not
 * made reactive, but `readonly` can be called on an already reactive object.
 */
function readonly(target) {
    return createReactiveObject(target, true, readonlyHandlers, readonlyCollectionHandlers, readonlyMap);
}
/**
 * Returns a reactive-copy of the original object, where only the root level
 * properties are readonly, and does NOT unwrap refs nor recursively convert
 * returned properties.
 * This is used for creating the props proxy object for stateful components.
 */
function shallowReadonly(target) {
    return createReactiveObject(target, true, shallowReadonlyHandlers, shallowReadonlyCollectionHandlers, shallowReadonlyMap);
}
function createReactiveObject(target, isReadonly, baseHandlers, collectionHandlers, proxyMap) {
    if (!isObject(target)) {
        return target;
    }
    // target is already a Proxy, return it.
    // exception: calling readonly() on a reactive object
    if (target["__v_raw" /* RAW */] &&
        !(isReadonly && target["__v_isReactive" /* IS_REACTIVE */])) {
        return target;
    }
    // target already has corresponding Proxy
    const existingProxy = proxyMap.get(target);
    if (existingProxy) {
        return existingProxy;
    }
    // only specific value types can be observed.
    const targetType = getTargetType(target);
    if (targetType === 0 /* INVALID */) {
        return target;
    }
    const proxy = new Proxy(target, targetType === 2 /* COLLECTION */ ? collectionHandlers : baseHandlers);
    proxyMap.set(target, proxy);
    return proxy;
}
function isReactive(value) {
    if (isReadonly(value)) {
        return isReactive(value["__v_raw" /* RAW */]);
    }
    return !!(value && value["__v_isReactive" /* IS_REACTIVE */]);
}
function isReadonly(value) {
    return !!(value && value["__v_isReadonly" /* IS_READONLY */]);
}
function isShallow(value) {
    return !!(value && value["__v_isShallow" /* IS_SHALLOW */]);
}
function toRaw(observed) {
    const raw = observed && observed["__v_raw" /* RAW */];
    return raw ? toRaw(raw) : observed;
}
const toReactive = (value) => isObject(value) ? reactive(value) : value;
const toReadonly = (value) => isObject(value) ? readonly(value) : value;
function isRef(r) {
    return !!(r && r.__v_isRef === true);
}

const define = Object.defineProperties;

const descriptor = Object.getOwnPropertyDescriptor;

const directives = [
  'skip',
  'vox',
  'for',
  'if',
  'el',
  'init',
  '*',
  'exit'
];

const map = (...data) => extend(
  Object.create(null),
  ...data
);

const keys = map({
  'accept-charset': 'acceptCharset',
  'accesskey': 'accessKey',
  'colspan': 'colSpan',
  'contenteditable': 'contentEditable',
  'crossorigin': 'crossOrigin',
  'dirname': 'dirName',
  'enterkeyhint': 'enterKeyHint',
  'formaction': 'formAction',
  'formenctype': 'formEnctype',
  'formmethod': 'formMethod',
  'formnovalidate': 'formNoValidate',
  'formtarget': 'formTarget',
  'html': 'innerHTML',
  'http-equiv': 'httpEquiv',
  'inputmode': 'inputMode',
  'ismap': 'isMap',
  'maxlength': 'maxLength',
  'minlength': 'minLength',
  'nomodule': 'noModule',
  'novalidate': 'noValidate',
  'readonly': 'readOnly',
  'referrerpolicy': 'referrerPolicy',
  'tabindex': 'tabIndex',
  'text': 'textContent',
  'usemap': 'useMap'
});

const noop = () => {};

const normalize = (value) => {
  let classes;
  if (isString(value)) {
    classes = (
      value.split(/\s+/)
        .filter(Boolean)
    );
  } else {
    classes = [];
    if (isArray(value)) {
      for (const item of value) {
        classes.push(
          ...normalize(item)
        );
      }
    } else if (isObject(value)) {
      for (const name in value) {
        if (name && value[name]) {
          classes.push(
            ...normalize(name)
          );
        }
      }
    } else if (value != null) {
      classes.push(value);
    }
  }
  return classes;
};

const reducer = (accumulator, value) => {
  if (value) {
    const _ = value.split(':');
    accumulator[_[0]] = _[1] || _[0];
  }
  return accumulator;
};

const voxRE = /^vox(?::([a-z-]+)([:a-z0-9-]+)?([.:a-z0-9-]+)?)?$/;

const api = define({}, {
  app: {
    value: {
      emit(event, data) {
        (this.el || document)
          .dispatchEvent(
            new CustomEvent(event, {
              bubbles: true,
              cancelable: true,
              composed: true,
              detail: {
                ...data
              }
            })
          );
      }
    },
    configurable: true,
    enumerable: true
  }
});

const cache$1 = (target, key, value, context) => {
  if (!(key in target)) {
    let data = target.data.find(
      (data) => hasOwn(data, key)
    );
    if (!data && value) {
      data = target.data.find(isReactive);
    }
    if (data) {
      const {
        get,
        set,
        writable
      } = (
        descriptor(data, key) || {}
      );
      const _ = {};
      if (get || set) {
        if (get) {
          _.get = () => get.call(context);
        }
        if (set) {
          _.set = (value) => {
            set.call(context, value);
          };
        }
      } else {
        _.get = () => data[key];
        if (writable !== false) {
          _.set = (value) => {
            data[key] = value;
          };
        }
      }
      define(target, {
        [key]: {
          get: _.get || (() => void(0)),
          set: _.set || ((value) => {}),
          configurable: true
        }
      });
    }
  }
  return target;
};

const handler = {
  get: (target, key, context) => (
    (key === Symbol.unscopables)
      ? void(0)
      : Reflect.get(
          cache$1(target, key, false, context),
          key,
          context
        )
  ),
  has: (target, key) => (
    Reflect.has(target, key) ||
    target.data.some(
      (data) => hasOwn(data, key)
    )
  ),
  set: (target, key, value, context) => (
    Reflect.set(
      cache$1(target, key, true, context),
      key,
      value,
      context
    )
  )
};

const context = (...data) => (
  new Proxy(
    define({}, {
      data: {
        value: data,
        configurable: true,
        enumerable: false
      }
    }),
    handler
  )
);

const reaction = (getter, runner) => {
  let value;
  const effect = new ReactiveEffect(
    () => {
      value = getter();
    },
    () => {
      effect.run();
      if (runner) {
        runner(value);
      }
    }
  );
  return {
    run: () => {
      effect.scheduler();
    },
    cleanup: () => {
      effect.fn = noop;
      effect.scheduler = noop;
      effect.stop();
    }
  };
};

let value;

const app = () => {
  if (!value) {
    value = context(
      readonly({
        el: null
      }),
      reactive(api.app)
    );
    value.data.push(
      shallowReadonly({
        app: value,
        els: readonly({}),
        vox: (index) => (
          (index === void(0))
            ? value
            : void(0)
        )
      })
    );
  }
  return value;
};

const cache = map();

const evaluator = (expression) => (
  cache[expression] || (
    cache[expression] = new Function(
      'with(this)return' + (
        (expression)
          ? `(${expression})`
          : ';'
      )
    )
  )
);

const vox = (q = '[vox]') => {
  const _ = {};
  if (isString(q)) {
    const els = (
      document.querySelectorAll(
        `${q}:not(${q} *)`
      )
    );
    _.init = () => {
      for (const el of els) {
        if (!el.vox) {
          vox_init(el);
        }
      }
    };
    _.exit = () => {
      for (const el of els) {
        if (el.vox) {
          vox_exit(el);
        }
      }
    };
  } else {
    let { el } = (q || {});
    if (isString(el)) {
      el = document.querySelector(el);
    }
    _.init = () => {
      if (el && !el.vox) {
        vox_init(el);
      }
    };
    _.exit = () => {
      if (el && el.vox) {
        vox_exit(el);
      }
    };
  }
  return (_);
};

const vox_init = (el) => {
  if (!el.vox) {
    el.vox = context(
      readonly({ el }),
      ...(el.parentNode.vox || app())
        .data.slice(1)
    );
  }
  if (!el.vox_cleanup) {
    el.vox_cleanup = [];
  }
  if (!el.vox_init) {
    el.vox_init = [];
  }
  if (!el.vox_exit) {
    el.vox_exit = [];
  }
  const dirs = (
    el.getAttributeNames()
      .filter((dir) => voxRE.test(dir))
      .sort((dirA, dirB) => {
        const a = (
          dirA
            .split('.')[0]
            .split(':')
        );
        const b = (
          dirB
            .split('.')[0]
            .split(':')
        );
        let i = directives.indexOf(
          (a[1] === void(0))
            ? a[0]
            : a[1]
        );
        let j = directives.indexOf(
          (b[1] === void(0))
            ? b[0]
            : b[1]
        );
        if (i === -1) {
          i = 6;
        }
        if (j === -1) {
          j = 6;
        }
        return (i - j);
      })
  );
  for (const dir of dirs) {
    const result = dir.match(voxRE);
    const name = result[1] || 'vox';
    const key = (result[2] || '').slice(1);
    const flags = (
      (result[3] || '')
        .split('.')
        .reduce(reducer, {})
    );
    const expression = (
      el.getAttribute(dir)
        .trim()
    );
    switch (name) {
      case 'skip': {
        if (!expression || (
          evaluator(expression)
            .call(el.vox)
        )) {
          vox_exit(el);
          return;
        }
        break;
      }
      case 'vox': {
        if (!el.vox_for && !el.vox_if) {
          const { app, vox } = (
            el.vox.data.pop()
          );
          el.vox.data.splice(
            1, 0,
            reactive(
              evaluator(`(api)=>{with(api)return(${expression})}`)
                .call(el.vox)(api)
            )
          );
          el.vox.data.push(
            shallowReadonly({
              app,
              els: readonly({}),
              vox: (index = 0) => (
                (index === 0)
                  ? el.vox
                  : (index > 0)
                    ? vox(index - 1)
                    : void(0)
              )
            })
          );
          if (el.vox.data[1].init) {
            el.vox_init.push(
              el.vox.init.bind(el.vox)
            );
            el.vox.init();
          }
          if (el.vox.data[1].exit) {
            el.vox_exit.push(
              el.vox.exit.bind(el.vox)
            );
          }
        }
        break;
      }
      case 'for': {
        if (!el.vox_for) {
          vox_for(el, expression);
          return;
        }
        break;
      }
      case 'if': {
        if (!el.vox_if) {
          vox_if(el, expression);
          return;
        }
        break;
      }
      case 'el': {
        vox_el(el, expression);
        break;
      }
      case 'init': {
        const init = (
          evaluator(`()=>{${expression}}`)
            .call(el.vox)
        );
        el.vox_init.push(init);
        init();
        break;
      }
      case 'attr':
      case 'aria':
      case 'data': {
        let alias;
        if (name !== 'attr') {
          alias = name;
        }
        vox_attr(el, expression, key, flags, alias);
        break;
      }
      case 'class': {
        vox_class(el, expression, key, flags);
        break;
      }
      case 'event': {
        vox_event(el, expression, key, flags);
        break;
      }
      case 'focus': {
        vox_focus(el, expression);
        break;
      }
      case 'run': {
        vox_run(el, expression);
        break;
      }
      case 'style': {
        vox_style(el, expression, key);
        break;
      }
      case 'exit': {
        el.vox_exit.push(
          evaluator(`()=>{${expression}}`)
            .call(el.vox)
        );
        break;
      }
      default: {
        if (name.slice(0, 2) === 'on') {
          const key = name.slice(2);
          vox_event(el, expression, key, flags);
        } else {
          const key = keys[name] || name;
          if (key in el) {
            vox_bind(el, expression, key);
          }
        }
      }
    }
  }
  (el.vox_content || (
    el.vox_content = (
      Array.from(el.children)
    )
  ))
    .forEach(vox_init);
};

const vox_for = (el, expression) => {
  const vars = expression.match(
    /\w+(?=.*\b(in|of)\b)/g
  );
  for (const i in vars) {
    expression = expression.replace(
      new RegExp(`\\b${vars[i]}\\b`),
      (i)
    );
  }
  expression = expression.replace(
    /\b(in|of)\b/,
    ','
  );
  const content = [];
  const node = document.createTextNode('');
  const { run, cleanup } = reaction(
    () => {
      let value = (
        evaluator(expression)
          .call(el.vox)
      );
      if (isArray(value)) {
        value = Array.from(
          Array.prototype.entries
            .call(value)
        );
      } else if (isObject(value)) {
        value = Object.entries(value);
      } else if (isString(value)) {
        value = Array.from(
          value,
          (char, i) => [ i, char ]
        );
      } else if (
        value > 0 &&
        value < Math.pow(2, 32)
      ) {
        value = Array.from(
          new Array(value),
          (_, i) => [ i, i + 1 ]
        );
      } else {
        value = [];
      }
      return value;
    },
    (value) => {
      let i = 0;
      while (content[i] && value[i]) {
        const data = (
          content[i]
            .vox
            .data[1]
        );
        if (vars[0]) {
          define(data, {
            [vars[0]]: {
              writable: true
            }
          });
          extend(data, {
            [vars[0]]: value[i][1]
          });
          define(data, {
            [vars[0]]: {
              writable: false
            }
          });
        }
        if (vars[1]) {
          define(data, {
            [vars[1]]: {
              writable: true
            }
          });
          extend(data, {
            [vars[1]]: value[i][0]
          });
          define(data, {
            [vars[1]]: {
              writable: false
            }
          });
        }
        if (vars[2]) {
          define(data, {
            [vars[2]]: {
              writable: true
            }
          });
          extend(data, {
            [vars[2]]: i
          });
          define(data, {
            [vars[2]]: {
              writable: false
            }
          });
        }
        (i++);
      }
      while (!content[i] && value[i]) {
        const clone = el.cloneNode(true);
        const scope = {};
        if (vars[0]) {
          define(scope, {
            [vars[0]]: {
              value: value[i][1],
              configurable: true,
              enumerable: true
            }
          });
        }
        if (vars[1]) {
          define(scope, {
            [vars[1]]: {
              value: value[i][0],
              configurable: true,
              enumerable: true
            }
          });
        }
        if (vars[2]) {
          define(scope, {
            [vars[2]]: {
              value: i,
              configurable: true,
              enumerable: true
            }
          });
        }
        node.parentNode.insertBefore(clone, node);
        content[i] = clone;
        clone.vox = context(
          readonly({
            el: clone
          }),
          reactive(scope),
          ...el.vox.data.slice(1)
        );
        clone.vox_for = el;
        vox_init(clone);
        (i++);
      }
      while (content[i] && !value[i]) {
        const clone = content[i];
        vox_exit(clone);
        content[i] = null;
        clone.parentNode.removeChild(clone);
        (i++);
      }
      content.length = value.length;
    }
  );
  el.vox_for = el;
  el.vox_content = content;
  el.vox_cleanup.push(() => {
    cleanup();
    content.forEach((clone) => {
      clone.parentNode.removeChild(clone);
    });
    node.parentNode.replaceChild(el, node);
  });
  el.parentNode.replaceChild(node, el);
  run();
};

const vox_if = (el, expression) => {
  let condition = false;
  const content = [];
  const node = document.createTextNode('');
  const clone = el.cloneNode(true);
  const { run, cleanup } = reaction(
    () => (
      evaluator(`!!(${expression})`)
        .call(el.vox)
    ),
    (value) => {
      if (condition !== value) {
        condition = value;
        if (condition) {
          node.parentNode.insertBefore(clone, node);
          content.push(clone);
          clone.vox = context(
            readonly({
              el: clone
            }),
            ...el.vox.data.slice(1)
          );
          if (el.vox_for) {
            clone.vox_for = el.vox_for;
          }
          clone.vox_if = el;
          vox_init(clone);
        } else {
          vox_exit(clone);
          content.pop();
          clone.parentNode.removeChild(clone);
        }
      }
    }
  );
  el.vox_if = el;
  el.vox_content = content;
  el.vox_cleanup.push(() => {
    cleanup();
    if (condition) {
      clone.parentNode.removeChild(clone);
    }
    node.parentNode.replaceChild(el, node);
  });
  el.parentNode.replaceChild(node, el);
  run();
};

const vox_el = (el, expression) => {
  const name = (
    evaluator(expression)
      .call(el.vox)
  );
  const { els } = toRaw(
    el.vox.data[
      el.vox.data.length - 1
    ]
  );
  define(els, {
    [name]: {
      value: el,
      configurable: true,
      enumerable: true
    }
  });
  el.vox_cleanup.push(() => {
    delete els[name];
  });
};

const vox_attr = (el, expression, key, flags, alias) => {
  if (key && flags.camel) {
    key = camelize(key);
  }
  const { run, cleanup } = reaction(
    () => (
      evaluator(expression)
        .call(el.vox)
    ),
    (value) => {
      const attrs = (
        (key)
          ? { [key]: value }
          : value
      );
      for (let key in attrs) {
        const value = attrs[key];
        if (alias) {
          key = `${alias}-${key}`;
        }
        if (value != null) {
          el.setAttribute(key, value);
        } else {
          el.removeAttribute(key);
        }
      }
    }
  );
  el.vox_cleanup.push(cleanup);
  run();
};

const vox_bind = (el, expression, key) => {
  const { run, cleanup } = reaction(
    () => (
      evaluator(expression)
        .call(el.vox)
    ),
    (value) => {
      el[key] = value;
    }
  );
  if (
    key === 'innerHTML' ||
    key === 'textContent'
  ) {
    el.vox_content = [];
  }
  el.vox_cleanup.push(cleanup);
  run();
};

const vox_class = (el, expression, key, flags) => {
  if (key && flags.camel) {
    key = camelize(key);
  }
  let classes = [];
  const { run, cleanup } = reaction(
    () => (
      evaluator(expression)
        .call(el.vox)
    ),
    (value) => {
      if (key) {
        el.classList.toggle(key, value);
      } else {
        el.classList.remove(...classes);
        el.classList.add(...(
          classes = normalize(value)
        ));
      }
    }
  );
  el.vox_cleanup.push(cleanup);
  run();
};

const vox_event = (el, expression, key, flags) => {
  let cleanup;
  if (key) {
    let target = el;
    const handler = (
      evaluator(`(event)=>{with(event){${expression}}}`)
        .call(el.vox)
    );
    const event = new Array(2);
    const options = {};
    for (const flag in flags) {
      switch (flag) {
        case 'camel': {
          key = camelize(key);
          break;
        }
        case 'win':
        case 'window': {
          target = window;
          break;
        }
        case 'doc':
        case 'document': {
          target = document;
          break;
        }
        case 'out':
        case 'outside': {
          if (target === el) {
            target = document;
          }
          event[1] = (e) => {
            if (!el.contains(e.target)) {
              event[2](e);
            }
          };
          break;
        }
        case 'self': {
          const i = event.push((e) => {
            if (e.target === el) {
              event[i](e);
            }
          });
          break;
        }
        case 'prevent': {
          const i = event.push((e) => {
            e.preventDefault();
            event[i](e);
          });
          break;
        }
        case 'stop': {
          const i = event.push((e) => {
            e.stopPropagation();
            event[i](e);
          });
          break;
        }
        case 'immediate': {
          const i = event.push((e) => {
            e.stopImmediatePropagation();
            event[i](e);
          });
          break;
        }
        case 'left': {
          const i = event.push((e) => {
            if (
              e.button === 0 ||
              e.key === 'ArrowLeft' ||
              e.key === 'Left'
            ) {
              event[i](e);
            }
          });
          break;
        }
        case 'mid':
        case 'middle': {
          const i = event.push((e) => {
            if (e.button === 1) {
              event[i](e);
            }
          });
          break;
        }
        case 'right': {
          const i = event.push((e) => {
            if (
              e.button === 2 ||
              e.key === 'ArrowRight' ||
              e.key === 'Right'
            ) {
              event[i](e);
            }
          });
          break;
        }
        case 'up': {
          const i = event.push((e) => {
            if (
              e.key === 'ArrowUp' ||
              e.key === 'Up'
            ) {
              event[i](e);
            }
          });
          break;
        }
        case 'down': {
          const i = event.push((e) => {
            if (
              e.key === 'ArrowDown' ||
              e.key === 'Down'
            ) {
              event[i](e);
            }
          });
          break;
        }
        case 'del':
        case 'delete': {
          const i = event.push((e) => {
            if (
              e.key === 'Backspace' ||
              e.key === 'Delete' ||
              e.key === 'Del'
            ) {
              event[i](e);
            }
          });
          break;
        }
        case 'enter': {
          const i = event.push((e) => {
            if (e.key === 'Enter') {
              event[i](e);
            }
          });
          break;
        }
        case 'esc':
        case 'escape': {
          const i = event.push((e) => {
            if (
              e.key === 'Escape' ||
              e.key === 'Esc'
            ) {
              event[i](e);
            }
          });
          break;
        }
        case 'space': {
          const i = event.push((e) => {
            if (
              e.key === ' ' ||
              e.key === 'Spacebar'
            ) {
              event[i](e);
            }
          });
          break;
        }
        case 'tab': {
          const i = event.push((e) => {
            if (e.key === 'Tab') {
              event[i](e);
            }
          });
          break;
        }
        case 'alt': {
          const i = event.push((e) => {
            if (e.altKey) {
              event[i](e);
            }
          });
          break;
        }
        case 'ctrl': {
          const i = event.push((e) => {
            if (e.ctrlKey) {
              event[i](e);
            }
          });
          break;
        }
        case 'meta': {
          const i = event.push((e) => {
            if (e.metaKey) {
              event[i](e);
            }
          });
          break;
        }
        case 'shift': {
          const i = event.push((e) => {
            if (e.shiftKey) {
              event[i](e);
            }
          });
          break;
        }
        case 'deb':
        case 'debounce': {
          let id;
          const delay = (
            (flags[flag] >= 0)
              ? +(flags[flag])
              : 250
          );
          event[0] = (e) => {
            clearTimeout(id);
            id = setTimeout(() => {
              id = null;
              event[1](e);
            }, delay);
          };
          break;
        }
        case 'thr':
        case 'throttle': {
          let id;
          const delay = (
            (flags[flag] >= 0)
              ? +(flags[flag])
              : 250
          );
          event[0] = (e) => {
            if (id == null) {
              event[1](e);
              id = setTimeout(() => {
                id = null;
              }, delay);
            }
          };
          break;
        }
        case 'capture':
        case 'once':
        case 'passive': {
          options[flag] = true;
          break;
        }
      }
    }
    event.push((e) => {
      handler({
        event: e,
        ...e.detail
      });
    });
    if (!event[1]) {
      event[1] = event[2];
    }
    if (!event[0]) {
      event[0] = event[1];
    }
    target.addEventListener(
      key,
      event[0],
      options
    );
    cleanup = () => {
      target.removeEventListener(
        key,
        event[0],
        options
      );
    };
  } else {
    const events = (
      evaluator(expression)
        .call(el.vox)
    );
    for (const key in events) {
      const handler = events[key];
      el.addEventListener(
        key,
        events[key] = (e) => {
          handler.call(
            el.vox,
            e,
            e.detail
          );
        }
      );
    }
    cleanup = () => {
      for (const key in events) {
        el.removeEventListener(
          key,
          events[key]
        );
      }
    };
  }
  el.vox_cleanup.push(cleanup);
};

const vox_focus = (el, expression) => {
  let condition = false;
  let element;
  const { run, cleanup } = reaction(
    () => (
      evaluator(`!!(${expression})`)
        .call(el.vox)
    ),
    (value) => {
      if (condition !== value) {
        condition = value;
        if (condition) {
          element = document.activeElement;
          el.focus();
        } else if (element) {
          element.focus();
        }
      }
    }
  );
  el.vox_cleanup.push(cleanup);
  run();
};

const vox_run = (el, expression) => {
  const { run, cleanup } = reaction(
    evaluator(`()=>{${expression}}`)
      .call(el.vox)
  );
  el.vox_cleanup.push(cleanup);
  run();
};

const vox_style = (el, expression, key, flags) => {
  let style = {};
  const { run, cleanup } = reaction(
    () => (
      evaluator(expression)
        .call(el.vox)
    ),
    (value) => {
      for (const key in style) {
        el.style.removeProperty(key);
      }
      style = {};
      if (isObject(value)) {
        key = (
          (key === 'var')
            ? '--'
            : (key)
              ? `${key}-`
              : ''
        );
        for (const name in value) {
          style[key + hyphenate(name)] = value[name];
        }
      } else if (key) {
        style[key] = value;
      }
      for (const key in style) {
        let value = style[key];
        let priority;
        if (
          value
            .toString()
            .includes('important')
        ) {
          value = value.replace(
            '!important',
            ''
          );
          priority = 'important';
        }
        el.style.setProperty(
          key,
          value,
          priority
        );
      }
    }
  );
  el.vox_cleanup.push(cleanup);
  run();
};

const vox_exit = (el) => {
  if (el.vox_content) {
    el.vox_content.forEach(vox_exit);
    delete el.vox_content;
  }
  if (el.vox_cleanup) {
    el.vox_cleanup.forEach(
      (cleanup) => cleanup()
    );
    delete el.vox_cleanup;
  }
  if (el.vox) {
    delete el.vox;
  }
  if (el.vox_for) {
    delete el.vox_for;
  }
  if (el.vox_if) {
    delete el.vox_if;
  }
  if (el.vox_init) {
    delete el.vox_init;
  }
  if (el.vox_exit) {
    el.vox_exit.forEach(
      (exit) => exit()
    );
    delete el.vox_exit;
  }
};

const config = {};

const version = "0.5.0";

define(vox, {
  api: {
    value: api
  },
  config: {
    value: config
  },
  name: {
    value: 'vox'
  },
  version: {
    value: version
  }
});

export { vox as default };
