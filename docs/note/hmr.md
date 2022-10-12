> 我们下面讨论的`HMR`都是基于`vite`自身实现的一套`HMR`系统。
> `vite`实现的`HMR`是根据 [ESM HMR 规范](https://github.com/FredKSchott/esm-hmr) 来实现的。

## What（HMR 是什么？）

`HMR`：`Hot Module Reload`模块热更新。
之前当我们在编辑器中更新代码时，会触发浏览器的页面刷新，但是这个刷新是**全量刷新**，相当于`CMD+R`。这时页面的状态会被重置掉，总之体验不好。
而模块热更新就是为了解决这样的问题，只是刷新我们编辑的代码所对应的模块，并且能保持页面的状态。![Oct-11-2022 10-06-42.gif](https://cdn.nlark.com/yuque/0/2022/gif/2705850/1665454033055-6bb16da8-a3dc-4917-88e2-dec387f0af11.gif)

> 可以看到这里我们在编辑代码时，下面`count`的状态是保存了的。只是热更新了上面的文字部分的模块。

## Why（为什么需要 HMR？）

其实每个技术的诞生，都是为了解决之前所凸显出来的问题。HMR 也是如此，其实在上面也已经说了原因。
这里再来总结一下：**为什么需要 HMR？**

1. 解决修改代码后页面**全量更新**，体验不好的问题
2. 解决全量更新导致的**状态丢失**问题

## How（怎么使用 HMR？）

`vite`中实现的`HMR`系统其实是对`ESM HMR`规范中的`API`进行了一层封装。`vite`会主动监听文件的变化，然后触发对应的`API`，来实现模块的热更新。
所以首先我们来简单了解一下这套规范中的`API`

### API

`hmr`的`API`都注入到了`import.meta`的`hot`中。
我们访问的时候只需要`import.meta.hot.[name]`即可

> `import.meta`是浏览器中内置的一个对象。【[MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/import.meta)】

```typescript
interface ImportMeta {
  readonly hot?: {
    readonly data: any
    // ======触发更新=====
    accept(): void //
    accept(cb: (mod: any) => void): void
    accept(dep: string, cb: (mod: any) => void): void
    accept(deps: string[], cb: (mods: any[]) => void): void
    // ==================
    prune(cb: () => void): void
    dispose(cb: (data: any) => void): void
    decline(): void
    invalidate(): void
    // =====监听hmr事件====
    on(event: string, cb: (...args: any[]) => void): void
    // ===================
  }
}
```

#### accept(cb)

`accept`翻译过来就是接受。而在`hmr`中他也是这个意思：接受此次热更新，而接受热更新的模块被称为`HMR`边界
当我们在文件中加入这行代码的时候，就是手动开启该文件模块的热更新。
当这个文件中的代码产生更新时，就会接收此次热更新的结果。

```typescript
if (import.meta.hot) {
  import.meta.hot.accept((mod) => {
    console.log(mod, '==')
  })
}
```

:::danger
`accept`中的`mod`就是更新之后的模块中所导出的内容。
:::
比如我们的文件是下面这样，导出了`render`和`other`：

```typescript
export const render = () => {
  // ...
}

export const other = () => {
  //...
}

if (import.meta.hot) {
  import.meta.hot.accept((mod) => {
    console.log(mod, '==')
  })
}
```

那么当我们在这个文件中更新代码，接受热更新时此时`mod`中就是：
![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1665477943262-0ce6dda0-9898-47b4-a1fe-b01caa604560.png)
如果我们需要接受其中一个导出模块的更新，那么直接调用`mod.render()`或者`mod.other()`即可在页面上更新到最新的内容。

> 如果你的文件中导出方式是默认导出`export default xxx`，那么`mod`中就是`mod.default`

在上面的代码中，我们是向`accept`中传递了一个回调函数来主动触发热更新模块中的函数。因为我们这个文件中只是声明了`render`、`other`函数，并没有执行，所以需要在`accpet`的回调中手动触发才可以
其实有些情况下也不用传回调函数。`accept`会把当前变更的文件中的最新内容执行一遍。就比如我们这个文件就是一个可执行文件（类似自执行函数），当我们`import`这个文件的时候，文件里的代码就会执行，例如下面的情况：

```typescript
// render.ts
const render = () => {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = `
    <h1>Hello Vite12</h1>
    <p id="p">是是是</p>
  `
}


render()

if (import.meta.hot) {
  import.meta.hot.accept()
}

// main.ts
import './render.tx'’

```

> 在`render`文件执行执行了`render`函数，这时`accept`就会重新执行这个文件，也就理所当然的触发了`render`函数。这时就不需要我们向`accpet`传递回调函数了。

#### accept(dep, cb)

`accept`方法中也可以接收一个`dep`参数，也就是当前页面热更新时所依赖的**子模块的路径**。
这个`dep`参数，可以是一个单独字符串，也可以是一个字符串数组，当是数组时说明**依赖多个子模块**

```typescript
//main.ts
import { render } from './render'
import { initState } from './state'

render()
initState()

if (import.meta.hot) {
  import.meta.hot.accept('./render.ts', (mod) => {
    console.log(mod, '==')
    mod?.render()
  })
}
```

> `main`模块依赖`render`文件
> 当`render`文件变更时，会接收热更新
> 因为此时没有依赖`state`文件，所以当`state`文件发生变更时会`**reload page**`，而不会热更新。
> 因为此时热更新的边界仅仅是`render`模块，只有`render`模块中的变更才会触发`main`的热更新

```typescript
//main.ts
import { render } from './render'
import { initState } from './state'

render()
initState()

if (import.meta.hot) {
  import.meta.hot.accept(['./render.ts', './state.ts'], ([mod1, mod2]) => {
    console.log(mod1, mod2, '==')
    mod1?.render()
    mod2?.initState()
  })
}
```

> 这时，当`state`模块中的文件发生变化时，就也会触发`main`的热更新了。
> 此时，回调函数中的`mod`为：（因为仅仅变更了`state`模块，所以`mod1`是`undefined`，也就说明`render`模块没有更新，符合预期。
> ![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1665479532595-1a7be5e8-c2a7-4339-a822-0cbaa03cf4f0.png)

#### dispose()

这个函数就是比较简单。就是在**新模块更新前 旧模块销毁时**的钩子。用来清理掉旧模块中的一些副作用。

```typescript
const timerId = setInterval(() => {
  countEle.innerText = Number(countEle.innerText) + 1 + ''
}, 1000)

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    // 清理副作用
    clearInterval(timerId)
  })
}
```

> 在我们需要 hmr 的模块中如果有定时器之类的操作，我们热更新后如果不提前销毁定时器，就会重复执行定时，那么可能会出现意想不到效果。

#### on(event,cb)

监听**自定义 `HMR` 事件**。
自定义 HMR 事件，是在服务端定义发送的。在 vite 中，我们可以在插件中完成这件事。
`vite`插件中提供了[`handleHotUpdate`](https://www.vitejs.net/guide/api-plugin.html#handleHotUpdate)

```typescript
// vite-plugin.tx
// 省略其他代码
handleHotUpdate({ server }) {
  server.ws.send({
    type: 'custom',
    event: 'xxx-file-change', // 自定义事件名称
    data: {} // 携带的信息
  })
  return []
}

// client
 import.meta.hot.on('xxx-file-change', (payload) => {
    console.log(payload)
})
```

> [https://github.com/sanyuan0704/island.js/pull/79](https://github.com/sanyuan0704/island.js/pull/79)
> 有时自定义 `hmr` 事件，没有触发页面更新。我们可以利用监听自定义事件，来主动触发页面的`rerender`

#### data

该属性用来共享**同一个模块中**更新前后的数据。
在这里面绑定的数据，不会被`hmr`影响或重置。

```typescript
import.meta.hot.data.count = 1
```

#### decline()

表示此模块不可热更新，如果在传播 HMR 更新时遇到此模块，浏览器应该执行**完全重新加载**。

#### invalidate()

重新加载页面。

## 其他

当`hmr`发生后，浏览器的网络中在`ws`（`websocket`）中会接收到这样一条信息：
![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1665481590056-76ea9976-bce0-4810-8024-38be8a76c79b.png)
这里记录这`hmr`产生`update`的一些信息。我们接下里就探究一下这个信息是如何产生的。


> 接下来我们探究一下在 vite 中当文件更新之后，整个 hmr 的执行流程是什么样的。
> 请看下一篇。

