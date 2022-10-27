# react 中的 cache 方法

:::tip
原文链接：[React 内部是如何实现 cache 方法的？](https://mp.weixin.qq.com/s/hCDj4M5UBVMXfeiH7jsZiw)
:::

1. 使用 `weekMap` 对对象类型的参数进行缓存
2. 使用 `map` 对原始类型进行缓存

## 实现

```js
const UNTERMINATED = 0
const TERMINATED = 1
const ERRORED = 2

function createCacheRoot() {
  return new WeakMap()
}

function createCacheNode() {
  return {
    s: UNTERMINATED, // status, represents whether the cached computation returned a value or threw an error
    v: undefined, // value, either the cached result or an error, depending on s
    o: null, // object cache, a WeakMap where non-primitive arguments are stored
    p: null, // primitive cache, a regular Map where primitive arguments are stored.
  }
}

let fnMap = createCacheRoot()

function cache(fn) {
  return function () {
    const fnNode = fnMap.get(fn)
    let cacheNode
    if (fnNode === undefined) {
      cacheNode = createCacheNode()
      fnMap.set(fn, cacheNode)
    } else {
      cacheNode = fnNode
    }
    for (let i = 0, l = arguments.length; i < l; i++) {
      const arg = arguments[i]
      if (typeof arg === 'function' || (typeof arg === 'object' && arg !== null)) {
        // Objects go into a WeakMap
        let objectCache = cacheNode.o
        if (objectCache === null) {
          cacheNode.o = objectCache = new WeakMap()
        }
        const objectNode = objectCache.get(arg)
        if (objectNode === undefined) {
          cacheNode = createCacheNode()
          objectCache.set(arg, cacheNode)
        } else {
          cacheNode = objectNode
        }
      } else {
        // Primitives go into a regular Map
        let primitiveCache = cacheNode.p
        if (primitiveCache === null) {
          cacheNode.p = primitiveCache = new Map()
        }
        const primitiveNode = primitiveCache.get(arg)
        if (primitiveNode === undefined) {
          cacheNode = createCacheNode()
          primitiveCache.set(arg, cacheNode)
        } else {
          cacheNode = primitiveNode
        }
      }
    }
    if (cacheNode.s === TERMINATED) {
      return cacheNode.v
    }
    if (cacheNode.s === ERRORED) {
      throw cacheNode.v
    }
    try {
      // $FlowFixMe: We don't want to use rest arguments since we transpile the code.
      const result = fn.apply(null, arguments)
      const terminatedNode = cacheNode
      terminatedNode.s = TERMINATED
      terminatedNode.v = result
      return result
    } catch (error) {
      // We store the first error that's thrown and rethrow it.
      const erroredNode = cacheNode
      erroredNode.s = ERRORED
      erroredNode.v = error
      throw error
    }
  }
}

module.exports = cache
```

## 使用

```js
const obj = { obj: 1 }

const fn = (a, b, c) => {
  console.log('a', a)
  console.log('b', b)
  console.log('c', c)
  return b
}

const c = cache(fn)
c(obj, 1, 2)
c(obj, 3, 2)
c(obj, 1, 2)
c({ haha: 3 }, 1, 2)
```
