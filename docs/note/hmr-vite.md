在上一篇中我们主要是了解了 HMR 的简单概念以及相关 API，也手动实现了文件的 HMR。
接下来我们来梳理一下在 vite 中，当我们对文件代码做出改变时，整个 HMR 的流程是怎样的。

> 这里可能还会有疑问，就是我们在上篇文章中都是手动对每个文件添加了`import.meta.hot.accept()`但是在我们实际开发的项目中，其实我们是没有在代码中手动添加热更新相关的代码的，但是他还是会进行 hmr，其实是插件帮我们注入了 hmr 相关的操作。我们在下篇文章中会解析插件(@vite/react-plugin)

`hmr`其实整体分为两个部分:

1. 在服务端监听到模块改动，对模块进行相应的处理，将处理的结果发送给客户端（浏览器）进行热更新。
2. 客户端收到服务端发送的信息，进行处理，解析出对应需要热更新的模块，重新`import`最新模块，完成`hmr`

整个过程中的通信都是通过`websocket`来完成的。

## 服务端

> 首先我们启动服务之后，修改`render.ts`文件来触发`hmr`

### chokidar 监听文件

`vite`中是通过`chokidar`来监听文件的

> 这里的`moduleGraph`其实是收集的各个模块间的信息。
> 也是`hmr`流程中比较关键的信息，不过这里不展开讲。后续再看这一块
> 现在我们只需要知道这里存放的是所有模块的依赖关系。比如`a`文件`import`什么文件，以及`a`文件被什么文件所依赖

```typescript
// packages/vite/src/node/server/index.ts
import chokidar from 'chokidar'

// 监听根目录下的文件
const watcher = chokidar.watch(path.resolve(root))
// 修改文件
watcher.on('change', async (file) => {
  file = normalizePath(file)
  moduleGraph.onFileChange(file)
  await handleHMRUpdate(file, server)
})
// 新增文件
watcher.on('add', (file) => {
  handleFileAddUnlink(normalizePath(file), server)
})
// 删除文件
watcher.on('unlink', (file) => {
  handleFileAddUnlink(normalizePath(file), server, true)
})
```

### handleHMRUpdate

当文件改变之后（`change`）事件。会进入到`handleHMRUpdate`函数中。

```typescript
async function handleHMRUpdate(file, server) {
  // 1. 这一部分是对配置文件和环境变量相关的文件进行处理
  const { ws, config, moduleGraph } = server
  const shortFile = getShortName(file, config.root)
  const fileName = path.basename(file)
  const isConfig = file === config.configFile
  const isConfigDependency = config.configFileDependencies.some((name) => file === name)
  const isEnv = config.inlineConfig.envFile !== false && (fileName === '.env' || fileName.startsWith('.env.'))
  if (isConfig || isConfigDependency || isEnv) {
    // auto restart server
    debugHmr(`[config change] ${colors.dim(shortFile)}`)
    config.logger.info(colors.green(`${path.relative(process.cwd(), file)} changed, restarting server...`), { clear: true, timestamp: true })
    try {
      // 服务器重新启动
      await server.restart()
    } catch (e) {
      config.logger.error(colors.red(e))
    }
    return
  }
  debugHmr(`[file change] ${colors.dim(shortFile)}`)

  // 客户端注入的文件(vite/dist/client/client.mjs)更改，直接刷新页面
  if (file.startsWith(normalizedClientDir)) {
    ws.send({
      type: 'full-reload',
      path: '*',
    })
    return
  }
  // ====================================================

  // 2. 对普通文件进行处理
  const mods = moduleGraph.getModulesByFile(file)
  const timestamp = Date.now()
  // 初始化hmr的context（我们在handleHotUpdate中拿的参数）
  const hmrContext = {
    file,
    timestamp,
    modules: mods ? [...mods] : [],
    read: () => readModifiedFile(file),
    server,
  }
  // 执行插件中 handleHotUpdate 中的钩子，得到需要更新的模块
  for (const hook of config.getSortedPluginHooks('handleHotUpdate')) {
    const filteredModules = await hook(hmrContext)
    if (filteredModules) {
      hmrContext.modules = filteredModules
    }
  }
  if (!hmrContext.modules.length) {
    // html文件不能hmr，直接刷新页面
    if (file.endsWith('.html')) {
      config.logger.info(colors.green(`page reload `) + colors.dim(shortFile), {
        clear: true,
        timestamp: true,
      })
      ws.send({
        type: 'full-reload',
        path: config.server.middlewareMode ? '*' : '/' + normalizePath(path.relative(config.root, file)),
      })
    } else {
      // loaded but not in the module graph, probably not js
      debugHmr(`[no modules matched] ${colors.dim(shortFile)}`)
    }
    return
  }
  // 这里执行主要的模块更新逻辑
  updateModules(shortFile, hmrContext.modules, timestamp, server)
}
```

:::danger

**总结：**

1. 对配置文件、环境变量相关的文件，会直接重启服务器
2. 客户端注入的文件(`vite/dist/client/client.mjs`)更改，直接`full-reload`，刷新页面
3. 之后会执行插件中的所有`handleHotUpdate`钩子，得到需要处理的模块
4. 执行`updateModules`来进行模块更新（`hmr`的主要逻辑）

:::

### updateModules

```typescript
/**
 * file: 文件路径（`src/render.ts`)
 * module: 更新的模块集合（具体长啥样看下面截图） module[]
 * timestamp: 时间戳
 * server: 服务端相关配置
 */
function updateModules(file, modules, timestamp, { config, ws }) {
  // 更新模块的集合
  const updates = []
  // 无效模块集合（？）
  const invalidatedModules = new Set()
  // 是否需要刷新页面
  let needFullReload = false
  // 对更新的模块进行遍历
  for (const mod of modules) {
    // 检测模块是否无效（即不需要更新）
    invalidate(mod, timestamp, invalidatedModules)

    if (needFullReload) {
      continue
    }
    const boundaries = new Set()
    // 查找更新的边界
    const hasDeadEnd = propagateUpdate(mod, boundaries)
    // 如果为true就刷新页面
    if (hasDeadEnd) {
      needFullReload = true
      continue
    }
    // 记录更新信息
    updates.push(
      ...[...boundaries].map(({ boundary, acceptedVia }) => ({
        type: `${boundary.type}-update`,
        timestamp,
        path: normalizeHmrUrl(boundary.url),
        explicitImportRequired: boundary.type === 'js' ? isExplicitImportRequired(acceptedVia.url) : undefined,
        acceptedPath: normalizeHmrUrl(acceptedVia.url),
      }))
    )
  }
  if (needFullReload) {
    config.logger.info(colors.green(`page reload `) + colors.dim(file), {
      clear: true,
      timestamp: true,
    })
    ws.send({
      type: 'full-reload',
    })
    return
  }
  if (updates.length === 0) {
    debugHmr(colors.yellow(`no update happened `) + colors.dim(file))
    return
  }
  // 打印信息
  config.logger.info(updates.map(({ path }) => colors.green(`hmr update `) + colors.dim(path)).join('\n'), { clear: true, timestamp: true })

  // updates：{
  // 	type: "js-update",
  // 	timestamp: 1665641766748,
  // 	path: "/src/main.ts",
  // 	explicitImportRequired: false,
  // 	acceptedPath: "/src/render.ts",
  // }
  ws.send({
    type: 'update',
    updates,
  })
}
```

> modules：
> ![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1665641810141-03098be3-058e-4bd5-a644-83bbd6d26405.png#clientId=u8b428a9a-b8e8-4&crop=0&crop=0&crop=1&crop=1&errorMessage=unknown%20error&from=paste&height=506&id=u4d7e73df&margin=%5Bobject%20Object%5D&name=image.png&originHeight=506&originWidth=302&originalType=binary&ratio=1&rotation=0&showTitle=false&size=55160&status=error&style=none&taskId=u37684e15-d3e8-41bb-9e6c-2ea9a00b60a&title=&width=302)

#### propagateUpdate

这里面需要注意的是`isSelfAccepting`是否接收自身的更新。这里指的是文件中有`import.meta.hot.accept()`的模块，`accept`中不能有依赖的参数，比如`accept('xxx',()=>{})`

```typescript
function propagateUpdate(node, boundaries, currentChain = [node]) {
  // 是否接收自身的更新，如果接收就将本身这个模块放到热更新的边界集合中去
  if (node.isSelfAccepting) {
    boundaries.add({
      boundary: node,
      acceptedVia: node,
    })
    // 如果该模块中引用了css，则将css全部加入到边界集合中
    for (const importer of node.importers) {
      if (isCSSRequest(importer.url) && !currentChain.includes(importer)) {
        propagateUpdate(importer, boundaries, currentChain.concat(importer))
      }
    }
    return false
  }

  if (node.acceptedHmrExports) {
    boundaries.add({
      boundary: node,
      acceptedVia: node,
    })
  } else {
    // 。。。
  }
  // 不接受自身更新的，查找引用它的模块是否接收更新
  for (const importer of node.importers) {
    const subChain = currentChain.concat(importer)
    // importer如果将该模块列为acceptedHmrDeps，在将importer列入更新边界中
    if (importer.acceptedHmrDeps.has(node)) {
      boundaries.add({
        boundary: importer,
        acceptedVia: node,
      })
      continue
    }
    // 。。。
    if (currentChain.includes(importer)) {
      // 循环依赖直接终止，返回true刷新页面
      return true
    }
    if (propagateUpdate(importer, boundaries, subChain)) {
      return true
    }
  }
  // 返回false进行hmr
  return false
}
```

> 这里有一个问题就是，如果我们在`render.ts`中设置了`acceptI()`,那么`main`中的`accept`中即时依赖了`render.ts`,那么`main`模块也不会出现在`hmr`的边界集合中。
> 也就是一旦这个模块成为了`isSelfAccepting`，那么它更新的边界就是它本身，只有当该文件`isSelfAccepting===false`的时候才会去遍历他的前置依赖者（也就是 import 该模块的父级模块）是否依赖了该模块的更新（就像`main`中依赖了`render`一样）

#### invalidate

`invalidate` 函数主要做以下几件事：

1. 更新了模块的最后热更时间
2. 并将代码转换相关的结果（`transformResult`、`ssrTransformResult`）置空
3. 最后遍历模块的引用者（`importers`，也可叫作前置依赖，具体指哪些模块引用了该模块）

```typescript
// 检查是否为无效模块，并且更新mod的信息
function invalidate(mod, timestamp, seen) {
  // 防止出现循环依赖
  if (seen.has(mod)) {
    return
  }
  seen.add(mod)
  // 更新模块上次hmr的时间
  mod.lastHMRTimestamp = timestamp
  // 置空一系列信息
  mod.transformResult = null
  mod.ssrModule = null
  mod.ssrError = null
  mod.ssrTransformResult = null

  // 查看引用该模块的文件中是否接收该模块的hmr---accptedHmrDeps
  mod.importers.forEach((importer) => {
    // 如果引用该模块的文件的acceptedHmrDeps（可接受的更新依赖模块）中不包含本次文件变动
    // 的模块，就证明该importer的不需要更新
    // 就继续对该importer进行检测，清空前置依赖的一些引用，更新信息
    if (!importer.acceptedHmrDeps.has(mod)) {
      invalidate(importer, timestamp, seen)
    }
  })
}
// 其实在我们的案例中来解释invalidate函数做了什么事：
// 我们是变动的render.ts，此时main是引用了render.ts的，所以这个importer就是main文件。
// 那我们在main的import.meta.hot.accept里面是依赖了render的，所以importer.acceptedHmrDeps
// 就有render.ts，所以main是一个有效的更新模块，即需要hmr

// 假设我们的main不依赖render，那么importer.acceptedHmrDeps.has(mod)就是false，就会对main进行
// invalidate，清空importer的引用信息更新mod对应的相关信息
```

:::danger
**总结：**
主要就是寻找模块更新的边界。
:::

到这里服务端的任务就完成了。
服务端会将信息发送给客户端，最终发送的信息大概是这样的：

```json
{
  "type": "js-update",
  "timestamp": 1665641766748,
  "path": "/src/main.ts",
  "explicitImportRequired": false,
  "acceptedPath": "/src/render.ts"
}
```

![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1665481590056-76ea9976-bce0-4810-8024-38be8a76c79b.png#clientId=u4c23e1c5-712e-4&crop=0&crop=0&crop=1&crop=1&errorMessage=unknown%20error&from=paste&height=250&id=uce04c5ac&margin=%5Bobject%20Object%5D&name=image.png&originHeight=250&originWidth=1032&originalType=binary&ratio=1&rotation=0&showTitle=false&size=54668&status=error&style=none&taskId=u802d64e3-2cf9-4b0e-9a1c-17735c5adaf&title=&width=1032)

## 客户端

当客户端接收到服务端发送过来的`ws`信息之后，也会进行相关的处理。
而客户端处理信息的代码，也是`vite`注入的，大概长这样：
![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1665645749498-b5d2212a-b90a-4194-8cf5-c87a9d61d92e.png#clientId=uec076e67-2941-4&crop=0&crop=0&crop=1&crop=1&from=paste&height=720&id=u73dc565b&margin=%5Bobject%20Object%5D&name=image.png&originHeight=720&originWidth=1473&originalType=binary&ratio=1&rotation=0&showTitle=false&size=266695&status=done&style=none&taskId=u62853913-294e-44e7-b639-d5a49b86893&title=&width=1473)
这里大概就是创建了一个`websocket`服务器，然后监听一些事件。我们这里重点关注的是`handleMessage`,这个函数会在服务端发送过来信息的时候触发，用来处理`hmr`的信息

### handleMessage

```typescript
async function handleMessage(payload) {
  switch (payload.type) {
    case 'connected':
      console.debug(`[vite] connected.`)
      sendMessageBuffer()
      // ws心跳检测，保证ws服务处于连接中
      setInterval(() => {
        if (socket.readyState === socket.OPEN) {
          socket.send('{"type":"ping"}')
        }
      }, __HMR_TIMEOUT__)
      break
    case 'update':
      // 触发vite插件中的对应名称的钩子
      notifyListeners('vite:beforeUpdate', payload)
      // 。。。
      payload.updates.forEach((update) => {
        // 对js文件进行处理
        if (update.type === 'js-update') {
          // 主要逻辑在这里！！！！
          queueUpdate(fetchUpdate(update))
        } else {
          // css-update
          // 。。。
          console.debug(`[vite] css hot updated: ${searchUrl}`)
        }
      })
      break
    case 'custom': {
      notifyListeners(payload.event, payload.data)
      break
    }
    case 'full-reload':
      notifyListeners('vite:beforeFullReload', payload)
      if (payload.path && payload.path.endsWith('.html')) {
        // if html file is edited, only reload the page if the browser is
        // currently on that page.
        const pagePath = decodeURI(location.pathname)
        const payloadPath = base + payload.path.slice(1)
        if (pagePath === payloadPath || payload.path === '/index.html' || (pagePath.endsWith('/') && pagePath + 'index.html' === payloadPath)) {
          location.reload()
        }
        return
      } else {
        location.reload()
      }
      break
    case 'prune':
      // 。。。。
      break
    case 'error': {
      // 。。。
      break
    }
    default: {
      const check = payload
      return check
    }
  }
}
```

:::danger
**总结：**
对服务端发送来的不同类型的消息进行处理。

1. 对于不同类型可能需要触发不同的 vite 插件中的钩子。
2. 我们主要关注 `queueUpdate(fetchUpdate(update))`
   :::

### queueUpdate

这个方法主要是进行更新任务的调度。保证触发顺序。
参数`p`就是`fetchUpdate(updatre)`中的返回结果，我们把注意里放到这个函数中去。

```typescript
// 将由同一src路径更改触发的多个热更新放入队列中，以便按照发送顺序调用它们。
// （否则，由于http请求往返，顺序可能不一致）
async function queueUpdate(p) {
  queued.push(p)
  // p:执行的就是下面的方法:
  // () => {
  //       for (const { deps, fn } of qualifiedCallbacks) {
  //           fn(deps.map((dep) => moduleMap.get(dep)));
  //       }
  //   };
  if (!pending) {
    pending = true
    await Promise.resolve()
    pending = false
    const loading = [...queued]
    queued = []
    ;(await Promise.all(loading)).forEach((fn) => fn && fn())
  }
}
```

### fetchUpdate

```typescript
/**
 * 这个参数就是最终服务端发送的update信息
 **/
async function fetchUpdate({ path, acceptedPath, timestamp, explicitImportRequired }) {
  const mod = hotModulesMap.get(path)
  // 获取到的mod的格式
  // {
  //   "id": "/src/render.ts",
  //   "callbacks": [
  //     {
  //       "deps": [
  //         "/src/render.ts"
  //       ],
  //       "fn": ([mod]) => deps && deps(mod)
  //     }
  //   ]
  // }
  if (!mod) {
    return
  }
  const moduleMap = new Map()
  const isSelfUpdate = path === acceptedPath
  // 过滤出来对应的依赖路径下面的callback
  const filtercb = ({ deps }) => deps.includes(acceptedPath)
  const qualifiedCallbacks = mod.callbacks.filter(filtercb)

  if (isSelfUpdate || qualifiedCallbacks.length > 0) {
    const dep = acceptedPath
    const disposer = disposeMap.get(dep)
    if (disposer) await disposer(dataMap.get(dep))
    // 获取路径的参数
    const [path, query] = dep.split(`?`)
    try {
      // 重新导入文件获取更新之后的模块
      const newMod = await import(
        /* @vite-ignore */
        base + path.slice(1) + `?${explicitImportRequired ? 'import&' : ''}t=${timestamp}${query ? `&${query}` : ''}`
      )
      moduleMap.set(dep, newMod)
    } catch (e) {
      warnFailedFetch(e, dep)
    }
  }
  return () => {
    for (const { deps, fn } of qualifiedCallbacks) {
      //  moduleMap: { key: 'src/render',value: Module }
      //  moduleMap.get(dep)获取到的是一个模块
      //  fn([Module]) ===>  ([mod]) => deps && deps(mod)
      fn(deps.map((dep) => moduleMap.get(dep)))
    }
    const loggedPath = isSelfUpdate ? path : `${acceptedPath} via ${path}`
    console.debug(`[vite] hot updated: ${loggedPath}`)
  }
}
```

:::danger
**总结：**

```ts
const newMod = await import(/* @vite-ignore */ `path + import&t=${timestamp}${query}`)
```

在重新导入模块后，会发送新的请求，来请求最新的模块内容
![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1665646957456-7244e825-4371-4c4f-855d-ea47885f6ea3.png#clientId=uec076e67-2941-4&crop=0&crop=0&crop=1&crop=1&from=paste&height=398&id=uebfdb7d0&margin=%5Bobject%20Object%5D&name=image.png&originHeight=398&originWidth=1856&originalType=binary&ratio=1&rotation=0&showTitle=false&size=109666&status=done&style=none&taskId=u49fc6e14-613d-4670-8270-997dd54fe50&title=&width=1856)
:::

### 最后的疑问

我们在`fetchUpdate`中通过`hotModulesMap.get`获取到的`mod`，格式是这样的

```typescript
	{
      "id": "/src/render.ts",
      "callbacks": [
        {
          "deps": [
            "/src/render.ts"
          ],
          "fn": ([mod]) => deps && deps(mod)
        }
      ]
    }
```

其实会有个疑问，**这个数据里的 fn 是哪里来的？**`hotModulesMap`又是哪来的？
这里我们就需要继续往下看！

我们先来看下我们在更新模块内容之后，请求回来的文件长什么样？（我们这里还是更改的`render.ts`)

```typescript
import { createHotContext as __vite__createHotContext } from '/@vite/client'
import.meta.hot = __vite__createHotContext('/src/render.ts')

export const render = () => {
  const app = document.querySelector('#app')
  app.innerHTML = `
    <h1>Helloss Vite12d</h1>
    <p id="p">\u662F\u662Ffff\u6492\u53D1\u987A\u4E30\u662Fdfd\uFF01sooo\uFF1F</p>
  `
}
export const other = () => {
  const p = document.querySelector('#p')
  p.innerHTML = `
    <p>other</p>
  `
}
if (import.meta.hot) {
  import.meta.hot.data.count = 1
  import.meta.hot.accept((mod) => mod?.render())
}
```

> `vite:import-analysis` 插件进行注入的

可以看到，在我们文件的头部是被注入了`createHotContext`的，并且重写了我们的`import.meta.hot`中的内容为`createHotContext`的返回值。

也就是说我们在 21 行使用的 accept 方法是被`createHotContext`重写过的，那我们就来看看`createHotContext`做了什么？

#### createHotContext

其实这个方法的主要任务就是：重写客户端的`import.meta.hot`中的一系列方法。

```typescript
const hotModulesMap = new Map<string, HotModule>()
// 简化后的代码
/**
 * ownerPath: 当前文件的相对路径 "/src/render.ts"
 **/
export function createHotContext(ownerPath: string): ViteHotContext {
  const mod = hotModulesMap.get(ownerPath)
  if (mod) {
    mod.callbacks = []
  }

  // 2. 再来看这个函数
  function acceptDeps(deps: string[], callback: HotCallback['fn'] = () => {}) {
    // 先查找缓存，如果没缓存，就新建模块相关信息
    const mod: HotModule = hotModulesMap.get(ownerPath) || {
      id: ownerPath,
      callbacks: [],
    }
    // 修改模块的相关信息
    mod.callbacks.push({
      deps,
      fn: callback,
    })
    // 将模块信息放入hotModuleMap中
    hotModulesMap.set(ownerPath, mod)
  }

  // 1. 先来看最终的返回值，就是对上一篇中提到的hmr中的一些API进行重写
  const hot: ViteHotContext = {
    get data() {
      return dataMap.get(ownerPath)
    },

    // 我们重点关注这里，重写accept方法
    accept(deps?: any, callback?: any) {
      // 第一种情况就是，import.meta.accetpt(mod=>{}) 这样写
      if (typeof deps === 'function' || !deps) {
        // 我们上面的问题，fn就是在这里注入的，这里的deps其实就是我们传入的回调 mod=>{}
        acceptDeps([ownerPath], ([mod]) => deps && deps(mod))
      } else if (typeof deps === 'string') {
        // 第二种情况是，import.meta.accetpt('xxx', mod=>{})
        acceptDeps([deps], ([mod]) => callback && callback(mod))
      } else if (Array.isArray(deps)) {
        // 第三种情况是，import.meta.accetpt(['xxx','xxxx'], mod=>{})
        acceptDeps(deps, callback)
      } else {
        throw new Error(`invalid hot.accept() usage.`)
      }
    },

    // export names (first arg) are irrelevant on the client side, they're
    // extracted in the server for propagation
    acceptExports(_: string | readonly string[], callback?: any) {
      acceptDeps([ownerPath], callback && (([mod]) => callback(mod)))
    },

    dispose(cb) {
      disposeMap.set(ownerPath, cb)
    },

    // @ts-expect-error untyped
    prune(cb: (data: any) => void) {
      pruneMap.set(ownerPath, cb)
    },

    decline() {},

    // tell the server to re-perform hmr propagation from this module as root
    invalidate() {
      notifyListeners('vite:invalidate', { path: ownerPath })
      this.send('vite:invalidate', { path: ownerPath })
    },

    // custom events
    on(event, cb) {
      const addToMap = (map: Map<string, any[]>) => {
        const existing = map.get(event) || []
        existing.push(cb)
        map.set(event, existing)
      }
      addToMap(customListenersMap)
      addToMap(newListeners)
    },

    send(event, data) {
      messageBuffer.push(JSON.stringify({ type: 'custom', event, data }))
      sendMessageBuffer()
    },
  }

  return hot
}
```

对于上面这个的`createHotContext`函数我们分为两部分来看：

1. 先看返回值`hot`, 这里总结来说就是重写上一篇中我们提到过的`hmr`相关的`API`。 我们重点关注`accept`函数，这里对`accept`函数的三种不同使用方式进行处理:
   1. 第一种情况就是：`import.meta.accetpt(mod=>{})`
   2. 第二种情况是：`import.meta.accetpt('xxx', mod=>{})`
   3. 第三种情况是：`import.meta.accetpt(['xxx','xxxx'], mod=>{})`
2. 然后再看在返回值里重写`accept`方法时，用到了一个新的方法`acceptDeps`。这个方法其实就是更新`hotModulesMap`信息的。

**参数：**

1.  `deps`: 第一种情况下，其实就是传入的本身的路径，其他情况下是在`accpet`中主动声明的依赖
2.  `callback`：

    1. 第一种情况下，是重新注入的`([mod]) => deps && deps(mod)`，这里的`deps`其实就是我们传入的回调`mod=>{}`
    2. 第二种情况下，也是重新注入的`([mod]) => callback && callback(mod)`,这里的`callback`是我们在 accept 中传入的第二个参数`import.meta.accetpt('xxx', mod=>{})`
    3. 第三种情况就没怎么处理，将两个参数依次传入就好了

    > 我们上面的疑问 ❓：
    > 这个 fn 是哪里来的？ 其实就是在重新 accpet 时
    > `acceptDeps([ownerPath], ([mod]) => deps && deps(mod))`中注入的

然后我们最后再来看一下在`queueUpdat`中调度任务最后执行的方法

```typescript
// qualifiedCallbacks: {
//       "deps": [
//         "/src/render.ts"
//       ],
//       "fn": ([mod]) => deps && deps(mod)
//     }
for (const { deps, fn } of qualifiedCallbacks) {
  fn(deps.map((dep) => moduleMap.get(dep)))
}
```

- `fn`: 就是我们上面解析的`acceptDeps`中的第二个参数`callback`
- `moduleMap.get(dep)`: 获取到的是一个模块的信息`Module`![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1665651416209-74cdbe4c-9d70-4d08-b037-6f72dc8132f7.png#clientId=uec076e67-2941-4&crop=0&crop=0&crop=1&crop=1&from=paste&height=226&id=u69a27c56&margin=%5Bobject%20Object%5D&name=image.png&originHeight=226&originWidth=326&originalType=binary&ratio=1&rotation=0&showTitle=false&size=29656&status=done&style=none&taskId=ua914b93a-5659-441f-8ae0-48b4e405950&title=&width=326)
- 所以最终`fn([mod])` ===>` ([mod]) => cb(mod)`（`cb`就是我们在`accept`中传入的）

#### 在哪里注入的 createContext

```typescript
// vite/src/node/plugins/importAnalysis.ts
if (hasHMR && !ssr) {
  debugHmr(`${isSelfAccepting ? `[self-accepts]` : isPartiallySelfAccepting ? `[accepts-exports]` : acceptedUrls.size ? `[accepts-deps]` : `[detected api usage]`} ${prettyImporter}`)
  // inject hot context
  str().prepend(
    `import { createHotContext as __vite__createHotContext } from "${clientPublicPath}";` + `import.meta.hot = __vite__createHotContext(${JSON.stringify(normalizeHmrUrl(importerModule.url))});`
  )
}
```

## 总结

![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1665654134048-38b538ca-0e2e-4bda-ac66-9fe87166c101.png#clientId=uec076e67-2941-4&crop=0&crop=0&crop=1&crop=1&from=paste&height=1112&id=u148f8ce5&margin=%5Bobject%20Object%5D&name=image.png&originHeight=1112&originWidth=1512&originalType=binary&ratio=1&rotation=0&showTitle=false&size=2703570&status=done&style=none&taskId=u5f561c8c-eb51-4dff-9239-f5199127b34&title=&width=1512)
