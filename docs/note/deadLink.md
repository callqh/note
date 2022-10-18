# 链接检测（死链检测）

死链（`dead link`) 检测是指检测代码或者文档中的链接是否失效，如果失效则会在控制台输出错误信息。排除掉部署到生产环境后链接无法正常跳转的尴尬问题。

死链的检查总体上分为两部分：

1. 嗅探文档（代码）中的链接
2. 检测链接是否失效
   1. 内部链接（相对路径`/docs/test`）
   2. 外部链接（`http`/`https`）

:::tip
我们重点放在第二步上。

因为第一步在不同的情况下处理方式也不同，不过大致都是通过遍历其`ast`找到对应的类型进行收集链接
:::

## 嗅探文档（代码）中的链接

因为链接分为两种：内部链接和外部链接，这两种链接的处理方式也不同，所以我们需要先区分这两种链接。

> 是否为内部链接，通过判断 `url` 的开头是否为 `http` 或者 `https`

```ts
const externalLinks: string[] = []
const internalLinks: string[] = []
// 省略其他代码
visit(tree, ['link', 'image'], (node: { url: string }) => {
  const url = node.url
  if (!url) return
  if (internalLinks.includes(url) || externalLinks.includes(url)) return

  // 判断是否为内部链接
  if (!url.startsWith('http') && !url.startsWith('https')) {
    internalLinks.push(normalizeRoutePath(url?.split('#')[0]))
    return
  }

  //localhost以及127.0.0.1的本地链接跳过
  if (/^(http?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?/.test(url)) {
    return
  }
  // 其他则为外部链接
  externalLinks.push(url)
})
```

拿到链接后，我们需要对链接进行处理

:::tip
这里有个注意点: 因为有些链接是带有锚点（`#`）的，所以我们在收集链接时尽量处理掉这些锚点。
:::

```ts

```

## 检测链接是否失效

### 内部链接

内部链接的判断比较简单，大体上分为两种：

1. 通过`fs`模块判断文件是否存在
2. 如果系统内有对应的路由信息，拿到它并且匹配是否有对应的路由路径(查询路由时可能需要将路径进行处理，比如 `url` 是`docs/zh/index`，其实在路由中是`/docs/zh/`)

```ts
internalLinks.map((link) => {
  if (!isExistRoute(link)) {
    console.log(`Internal link to ${link} is dead`)
  }
})

function isExistRoute(routePath: string) {
  // 假设这里的routeData是路由信息
  return routeData.find((route) => route.routePath === routePath)
}
```

### 外部链接

检测外部链接的原理其实也很简单，就是通过`http`请求，如果请求成功则说明链接是有效的，如果失败则说明链接是无效的。

我们这里就不手动去封装 http 请求了，直接使用一些现成的库来做。这里推荐两个库

- [check-links](https://www.npmjs.com/package/check-links)：支持传入数组，方便多个链接的检查，并且会缓存结果，如果有相同的链接在短时间内重复检查，会直接返回缓存结果。（13.3 kB） ---**推荐**
- [link-check](https://www.npmjs.com/package/link-check)：仅支持单个链接的检测，如果要检测多个需要自己封装（36.7 kB）

下面以`check-links`为例.

```ts
const results = await checkLinks(externalLinks, {
  // 这里的timeout是请求超时时间，单位是毫秒，如果设置过短的话，有些链接会被检测为死链
  // 有些墙外的链接可能会比较慢，所以这里可以适当调大一点
  timeout: checkLink?.timeout || 30000,
})

// result: {
//   'https://alive.com': { status: 'alive', statusCode: 200 }
//   'https://dead.com': { status: 'dead', statusCode: 404  }
// }

Object.keys(results).forEach((url) => {
  const result = results[url]
  if (result.status !== 'dead') return

  console.log(`External link to ${url} is dead`)
})
```
