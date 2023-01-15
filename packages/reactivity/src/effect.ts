import { isArray, isIntegerKey } from "@vue/shared";
import { TriggerOpTypes } from "./operators";

export function effect(fn, options: any={}) {
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
            } finally {
                effectStack.pop();
                activeEffect = effectStack[effectStack.length - 1];
            }
        }
    }
    effect.id = uid++; // 制作一个effect标识，用于区分effect
    effect._isEffect = true; // 用于标识这个是响应式的effect
    effect.raw = fn; // 保留effect对应的原函数
    effect.options = options; // 在effect上保存用户的属性
    return effect;
}


const targetMap = new WeakMap();
// 让某个对象中的属性收集当前它对应的effect函数
export function track(target, type, key) {
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
export function trigger(target, type, key?, newValue?, oldValue?) {
    // console.log('trigger');
    // 如果这个属性没有收集过effect，那么不需要做任何操作
    const depsMap = targetMap.get(target);
    if (!depsMap) return;

    const effects = new Set();
    const add = (effectsToAdd) => {
        if (effectsToAdd) {
            effectsToAdd.forEach(effect => effects.add(effect));
        }
    }
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
    } else {
        // 可能是对象
        if (key !== undefined) { // 这里是修改，不能是新增
            add(depsMap.get(key));
        }

        switch(type) { // 如果添加了一个索引，就触发长度的更新
            case TriggerOpTypes.ADD:
                if (isArray(target) && isIntegerKey(key)) {
                    add(depsMap.get('length'));
                }
        }
    }
    effects.forEach((effect: Function) => {
        effect();
    })
}