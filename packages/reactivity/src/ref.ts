import { hasChanged, isArray, isObject } from "@vue/shared";
import { track, trigger } from "./effect";
import { TrackOpTypes, TriggerOpTypes } from "./operators";
import { reactive } from "./reactive";

export function ref(value) {
    // 将普通类型变成一个对象，也可以是对象，但是一般情况下是对象直接用reactive更合理
    return createRef(value);
}

// ref和reactive的区别：reactive内部采用proxy，ref中内部使用的是defineProperty

export function shallowRef(value) {
    return createRef(value, true);
}

const convert = (val) => isObject(val) ? reactive(val) : val;

class RefImpl {
    public _value; // 表示声明了一个_value属性，但是没有赋值
    public __v_isRef = true;
    constructor(public rawValue, public shallow) {
        this._value = shallow ? rawValue : convert(rawValue);
    }

    // 类的属性访问器
    get value() {
        track(this, TrackOpTypes.GET, 'value');
        return this._value;
    }

    set value(newValue) {
        if (hasChanged(this.rawValue, newValue)) {
            this.rawValue = newValue;
            this._value = this.shallow ? newValue : convert(newValue);
            trigger(this, TriggerOpTypes.SET, 'value', newValue);
        }
    }
}

export function createRef(rawValue, shallow = false) {
    return new RefImpl(rawValue, shallow);
}

class ObjectRefImpl {
    public __v_isRef = true;

    constructor(public target, public key) {

    }

    get value() {
        return this.target[this.key]; // 如果原来对象是响应式的就会进行依赖收集
    }

    set value(newValue) {
        this.target[this.key] = newValue; // 如果原来对象是响应式的，就会触发更新
    }
}

export function toRef(target, key) {
    return new ObjectRefImpl(target, key);
}

export function toRefs(obj) {
    const ret = isArray(obj) ? new Array(obj.length) : {};
    for (let key in obj) {
        ret[key] = toRef(obj, key);
    }
    return ret;
} 