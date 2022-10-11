# HMR

> 我们下面讨论的`HMR`都是基于`vite`自身实现的一套`HMR`系统。
> `vite`实现的`HMR`是根据 [ESM HMR 规范](https://github.com/FredKSchott/esm-hmr) 来实现的。

## What（HMR 是什么？）

`HMR`：`Hot Module Reload`模块热更新。<br />之前当我们在编辑器中更新代码时，会触发浏览器的页面刷新，但是这个刷新是**全量刷新**，相当于`CMD+R`。这时页面的状态会被重置掉，总之体验不好。<br />而模块热更新就是为了解决这样的问题，只是刷新我们编辑的代码所对应的模块，并且能保持页面的状态。![Oct-11-2022 10-06-42.gif](https://cdn.nlark.com/yuque/0/2022/gif/2705850/1665454033055-6bb16da8-a3dc-4917-88e2-dec387f0af11.gif)

> 可以看到这里我们在编辑代码时，下面`count`的状态是保存了的。只是热更新了上面的文字部分的模块。

<a name="ORTLI"></a>

## Why（为什么需要 HMR？）

其实每个技术的诞生，都是为了解决之前所凸显出来的问题。HMR 也是如此，其实在上面也已经说了原因。<br />这里再来总结一下：**为什么需要 HMR？**

1. 解决修改代码后页面**全量更新**，体验不好的问题
2. 解决全量更新导致的**状态丢失**问题
   <a name="hSaca"></a>

## How（怎么使用 HMR？）

`vite`中实现的`HMR`系统其实是对`ESM HMR`规范中的`API`进行了一层封装。`vite`会主动监听文件的变化，然后触发对应的`API`，来实现模块的热更新。<br />所以首先我们来简单了解一下这套规范中的`API`
<a name="dJUxW"></a>

### API

`hmr`的`API`都注入到了`import.meta`的`hot`中。<br />我们访问的时候只需要`import.meta.hot.[name]`即可

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

<a name="CaMZB"></a>

#### import.meta.hot.accept
