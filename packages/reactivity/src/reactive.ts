import { isObject } from "@vue/shared";
import {
    mutableHandlers,
    shallowReactiveHandlers,
    readonlyHandlers,
    shallowReadonlyHandlers
} from './baseHandlers';

export function reactive(target) {
    return createReactiveObject(target, false, mutableHandlers);
}

export function shallowReactive(target) {
    return createReactiveObject(target, false, shallowReactiveHandlers);
}

export function readonly(target) {
    return createReactiveObject(target, true, readonlyHandlers);
}

export function shallowReadonly(target) {
    return createReactiveObject(target, true, shallowReadonlyHandlers);
}

const reactiveMap = new WeakMap(); // 会自动垃圾回收，不会造成内存泄漏。存储的key只能是对象
const readonlyMap = new WeakMap();

// 柯里化
// new Proxy() 最核心的需要拦截，数据的读取和数据的修改 get/set
export function createReactiveObject(target, isReadonly, baseHandler) {
    // 该方法只能对对象做响应式
    if (!isObject(target)) return;

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