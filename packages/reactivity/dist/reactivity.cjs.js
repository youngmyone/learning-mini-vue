'use strict';

const isObject = (value) => typeof value == 'object' && value !== null;
const extend = Object.assign;
const isArray = Array.isArray;
const isIntegerKey = (key) => parseInt(key) + '' === key;
let hasOwnProperty = Object.prototype.hasOwnProperty;
const hasOwn = (target, key) => hasOwnProperty.call(target, key);
const hasChanged = (oldValue, newValue) => oldValue !== newValue;

function effect(fn, options = {}) {
    // 我们需要让这个effect变成响应式的effect，可以做到数据变化重新执行
    const effect = createReactiveEffect(fn, options);
    if (!options.lazy) {
        effect(); // 响应式effect默认会先执行一次
    }
    return effect;
}
let uid = 0;
let activeEffect;
const effectStack = [];
function createReactiveEffect(fn, options) {
    const effect = function reactiveEffect() {
        if (!effectStack.includes(effect)) {
            try {
                effectStack.push(effect);
                activeEffect = effect;
                return fn(); // 这里执行函数会进行取值，那么就会调用get方法
            }
            finally {
                effectStack.pop();
                activeEffect = effectStack[effectStack.length - 1];
            }
        }
    };
    effect.id = uid++; // 制作一个effect标识，用于区分effect
    effect._isEffect = true; // 用于标识这个是响应式的effect
    effect.raw = fn; // 保留effect对应的原函数
    effect.options = options; // 在effect上保存用户的属性
    return effect;
}
const targetMap = new WeakMap();
// 让某个对象中的属性收集当前它对应的effect函数
function track(target, type, key) {
    // activeEffect 当前正在运行的effect
    if (activeEffect === undefined) { // 此属性不用收集依赖，因为没在effect中使用
        return;
    }
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        targetMap.set(target, (depsMap = new Map));
    }
    let dep = depsMap.get(key);
    if (!dep) {
        depsMap.set(key, (dep = new Set));
    }
    if (!dep.has(activeEffect)) {
        dep.add(activeEffect);
    }
    console.log(targetMap);
}
// 下面代码有问题，需要利用栈来解决
// effect(() => {
//     state.name   --> effect1
//     effect(() => {
//         state.age --> effect2
//     })
//     state.name --> effect2
// })
// 为了避免无限循环，需要加上判断，判断effect是否已经在栈中了
// effect(() => {
//     state.age ++;
// })
// 找属性对应的effect让其执行（数组、对象）
function trigger(target, type, key, newValue, oldValue) {
    // console.log('trigger');
    // 如果这个属性没有收集过effect，那么不需要做任何操作
    const depsMap = targetMap.get(target);
    if (!depsMap)
        return;
    const effects = new Set();
    const add = (effectsToAdd) => {
        if (effectsToAdd) {
            effectsToAdd.forEach(effect => effects.add(effect));
        }
    };
    // 我们要将所有要执行的effect，全部存到一个新的集合中，最终一起执行
    // 1. 看修改的是不是数组的长度，因为改长度的影响比较大
    if (key === 'length' && isArray(target)) {
        console.log(depsMap);
        // 如果对应的长度，有依赖收集需要更新
        depsMap.forEach((dep, key) => {
            if (key === 'length' || key > newValue) {
                add(dep);
            }
        });
    }
    else {
        // 可能是对象
        if (key !== undefined) { // 这里是修改，不能是新增
            add(depsMap.get(key));
        }
        switch (type) { // 如果添加了一个索引，就触发长度的更新
            case 0 /* TriggerOpTypes.ADD */:
                if (isArray(target) && isIntegerKey(key)) {
                    add(depsMap.get('length'));
                }
        }
    }
    effects.forEach((effect) => {
        effect();
    });
}

// 是不是仅读的，仅读的属性set时会报异常
function createGetter(isReadonly = false, shallow = false) {
    return function get(target, key, receiver) {
        // 后续Object上的方法会迁移到Reflect上
        // 以前target[key] = value 方式设置值可能会失败，并不会报异常，也没有返回值标识
        // Reflect方法具备返回值
        const res = Reflect.get(target, key, receiver);
        if (!isReadonly) {
            // 收集依赖，等会数据变化后更新对应的视图
            // console.log("执行effect的时候会取值，收集effect");
            track(target, 0 /* TrackOpTypes.GET */, key);
        }
        if (shallow) {
            return res;
        }
        if (isObject(res)) { // vue2是一上来就递归，vue3是当取值时进行代理。懒代理
            return isReadonly ? readonly(res) : reactive(res);
        }
        return res;
    };
}
function createSetter(shallow = false) {
    return function set(target, key, value, receiver) {
        const oldValue = target[key]; // 取老值
        let hadKey = isArray(target) && isIntegerKey(key) ? Number(key) < target.length : hasOwn(target, key);
        Reflect.set(target, key, value, receiver);
        // 我们要区分是【新增】还是【修改】，vue2中无法监控更改索引，无法监控数组的长度，vue3中可以，hack方法，需要特殊处理
        if (!hadKey) {
            // 新增
            trigger(target, 0 /* TriggerOpTypes.ADD */, key, value);
        }
        else if (hasChanged(oldValue, value)) {
            // 修改
            trigger(target, 1 /* TriggerOpTypes.SET */, key, value);
        }
        // 数据更新时，通知对应属性的effect重新执行
    };
}
const get = createGetter();
const shallowGet = createGetter(false, true);
const readonlyGet = createGetter(true, false);
const shallowReadonlyGet = createGetter(true, true);
const set = createSetter();
const shallowSet = createSetter(true);
const mutableHandlers = {
    get,
    set
};
const shallowReactiveHandlers = {
    get: shallowGet,
    set: shallowSet
};
let readonlyObj = {
    set: (target, key) => {
        console.warn(`set on key ${key} failed`);
    }
};
const readonlyHandlers = extend({
    get: readonlyGet
}, readonlyObj);
const shallowReadonlyHandlers = extend({
    get: shallowReadonlyGet
}, readonlyGet);

function reactive(target) {
    return createReactiveObject(target, false, mutableHandlers);
}
function shallowReactive(target) {
    return createReactiveObject(target, false, shallowReactiveHandlers);
}
function readonly(target) {
    return createReactiveObject(target, true, readonlyHandlers);
}
function shallowReadonly(target) {
    return createReactiveObject(target, true, shallowReadonlyHandlers);
}
const reactiveMap = new WeakMap(); // 会自动垃圾回收，不会造成内存泄漏。存储的key只能是对象
const readonlyMap = new WeakMap();
// 柯里化
// new Proxy() 最核心的需要拦截，数据的读取和数据的修改 get/set
function createReactiveObject(target, isReadonly, baseHandler) {
    // 该方法只能对对象做响应式
    if (!isObject(target))
        return;
    const proxyMap = isReadonly ? readonlyMap : reactiveMap;
    // 如果某个对象已经被代理了，那么就不要再次代理
    const existProxy = proxyMap.get(target);
    if (existProxy) {
        return existProxy;
    }
    const proxy = new Proxy(target, baseHandler);
    proxyMap.set(target, proxy);
    return proxy;
}

function ref(value) {
    // 将普通类型变成一个对象，也可以是对象，但是一般情况下是对象直接用reactive更合理
    return createRef(value);
}
// ref和reactive的区别：reactive内部采用proxy，ref中内部使用的是defineProperty
function shallowRef(value) {
    return createRef(value, true);
}
const convert = (val) => isObject(val) ? reactive(val) : val;
class RefImpl {
    rawValue;
    shallow;
    _value; // 表示声明了一个_value属性，但是没有赋值
    __v_isRef = true;
    constructor(rawValue, shallow) {
        this.rawValue = rawValue;
        this.shallow = shallow;
        this._value = shallow ? rawValue : convert(rawValue);
    }
    // 类的属性访问器
    get value() {
        track(this, 0 /* TrackOpTypes.GET */, 'value');
        return this._value;
    }
    set value(newValue) {
        if (hasChanged(this.rawValue, newValue)) {
            this.rawValue = newValue;
            this._value = this.shallow ? newValue : convert(newValue);
            trigger(this, 1 /* TriggerOpTypes.SET */, 'value', newValue);
        }
    }
}
function createRef(rawValue, shallow = false) {
    return new RefImpl(rawValue, shallow);
}
class ObjectRefImpl {
    target;
    key;
    __v_isRef = true;
    constructor(target, key) {
        this.target = target;
        this.key = key;
    }
    get value() {
        return this.target[this.key]; // 如果原来对象是响应式的就会进行依赖收集
    }
    set value(newValue) {
        this.target[this.key] = newValue; // 如果原来对象是响应式的，就会触发更新
    }
}
function toRef(target, key) {
    return new ObjectRefImpl(target, key);
}
function toRefs(obj) {
    const ret = isArray(obj) ? new Array(obj.length) : {};
    for (let key in obj) {
        ret[key] = toRef(obj, key);
    }
    return ret;
}

exports.effect = effect;
exports.reactive = reactive;
exports.readonly = readonly;
exports.ref = ref;
exports.shallowReactive = shallowReactive;
exports.shallowReadonly = shallowReadonly;
exports.shallowRef = shallowRef;
exports.toRef = toRef;
exports.toRefs = toRefs;
//# sourceMappingURL=reactivity.cjs.js.map
