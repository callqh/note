## task
运行的`lint`、`test`等在`turbo`中被称作任务即`task`
在代码库的根目录中可以看到，每个命令运行的其实是通过`trubo run xxx`来运行的，
而这个任务都是需要通过在`turbo.json`中的`pipleline`中去定义的，否则找不到该任务。
![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1666764523260-fff85e45-6844-47db-b36b-cb32b8eb9f61.png#clientId=ue12b2f54-2276-4&crop=0&crop=0&crop=1&crop=1&from=paste&height=88&id=u69bdb7ab&margin=%5Bobject%20Object%5D&name=image.png&originHeight=170&originWidth=552&originalType=binary&ratio=1&rotation=0&showTitle=false&size=29772&status=done&style=none&taskId=ueba9eff7-a5a8-44ca-8021-3c864ea7cfd&title=&width=285)![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1666764539855-297daea7-1bdf-4776-9679-39838f93a084.png#clientId=ue12b2f54-2276-4&crop=0&crop=0&crop=1&crop=1&from=paste&height=153&id=u4c589565&margin=%5Bobject%20Object%5D&name=image.png&originHeight=285&originWidth=624&originalType=binary&ratio=1&rotation=0&showTitle=false&size=34679&status=done&style=none&taskId=u753513b6-8771-48d8-885d-7b99dc7c21e&title=&width=335)

而`turbo run xxx`运行的时候是会找到每个工作区中在`package.json`中在`script`中定义了`xxx`脚本的。
比如，`trubo run dev`，实际上是会找在各个`workspace`中的`package.json`的`script`中定义了`dev`脚本的去运行，如果没有定义就不会运行
## cache
`turborepo`中是使用`**本地缓存**`来进行加速的。
![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1666763746781-52a815f6-51bb-438f-80a0-ec788a03d882.png#clientId=ue12b2f54-2276-4&crop=0&crop=0&crop=1&crop=1&from=paste&height=454&id=u6ea973df&margin=%5Bobject%20Object%5D&name=image.png&originHeight=1306&originWidth=1710&originalType=binary&ratio=1&rotation=0&showTitle=false&size=390979&status=done&style=none&taskId=uc3cd11e1-794e-4d6d-9d93-b7b7fd822c2&title=&width=594)

1. 首先会评估你本次任务的输入文件（默认是gitignored中没有忽略的文件），并且根据这些文件生成对应的`hash`值。(`78awdk123`)
2. 在本地文件系统中查找缓存（`eg: ./node_modules/.cache/turbo/78awdk123`)
3. 如果没有查找到对应`hash`的文件夹，说明没有缓存，那么就会执行任务
4. **任务执行完成后，**会将对应的输出（包括输出的文件以及日志log）全部缓存，以便下次使用。

经过上面的步骤之后，当下次执行**同样**的`task`时，就会命中缓存。
![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1666764832604-2209ceda-aaa6-4e7b-8ba8-c99a347de559.png#clientId=ue12b2f54-2276-4&crop=0&crop=0&crop=1&crop=1&from=paste&height=742&id=u374595a9&margin=%5Bobject%20Object%5D&name=image.png&originHeight=742&originWidth=1910&originalType=binary&ratio=1&rotation=0&showTitle=false&size=276887&status=done&style=none&taskId=ua85f02d3-862f-4409-b7d5-1f73f20d342&title=&width=1910)

1. 当输入的文件没有发生任何变化时，计算出的`hash`是一样的
2. `turborepo`会去缓存目录中匹配`hash`值的文件
3. 匹配到之后，就不会再去执行命令，而是直接拿出缓存中的输出文件以及`log`直接使用
### 配置-输出
可以通过`outputs`来配置需要缓存哪些文件。
当设置为空数组时，**只缓存**`**log**`
```json
{
  "$schema": "https://turborepo.org/schema.json",
  "pipeline": {
    "build": {
      "outputs": ["dist/**", ".next/**"],
      "dependsOn": ["^build"]
    },
    "test": {
      "outputs": [], // leave empty to only cache logs
      "dependsOn": ["build"]
    }
  }
}
```
### 配置-输出
默认情况下当工作区的任何文件更改，都会任务是该工作区的更新，`hash`值就会刷新。但是有时我们只想关注部分文件（与该任务相关的文件），那么`inputs`属性可以让我们指定当前任务相关的文件。只要这些配置的相关文件更新才会影响到该任务，其他文件的更新并不会影响
```json
{
  "$schema": "https://turborepo.org/schema.json",
  "pipeline": {
    // ... omitted for brevity
 
    "test": {
      // A workspace's `test` task depends on that workspace's
      // own `build` task being completed first.
      "dependsOn": ["build"],
      "outputs": [],
      // A workspace's `test` task should only be rerun when
      // either a `.tsx` or `.ts` file has changed.
      "inputs": ["src/**/*.tsx", "src/**/*.ts", "test/**/*.ts"]
    }
  }
}
```
:::danger
`package.json`文件会一直被当做输入文件。
因为`turbo`中的任务被定义在`script`中，一旦`package.json`文件变动，那么缓存就会失效
:::
### 配置-关闭缓存

1.  命令行参数`--no-cache`。`eg: turbo run dev --no-cache`
2. 在`turbo.json`中配置
```json
{
  "$schema": "https://turborepo.org/schema.json",
  "pipeline": {
    "dev": {
      "cache": false // 关闭缓存
    }
  }
}
```
### 环境变量-env
环境变量也会对缓存产生影响。
不过turborepo，对一些[常用的框架中集成的环境变量](https://turbo.build/repo/docs/core-concepts/caching#automatic-environment-variable-inclusion)已经做到了自动引用，不用我们去手动的声明.
```json
{
  "$schema": "https://turborepo.org/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      // env vars will impact hashes of all "build" tasks
      "env": ["SOME_ENV_VAR"],
      "outputs": ["dist/**"]
    },
 
    // override settings for the "build" task for the "web" app
    "web#build": {
      "dependsOn": ["^build"],
      "env": [
        // env vars that will impact the hash of "build" task for only "web" app
        "STRIPE_SECRET_KEY",
        "NEXT_PUBLIC_STRIPE_PUBLIC_KEY",
        "NEXT_PUBLIC_ANALYTICS_ID"
      ],
      "outputs": [".next/**"],
    },
  },
 "globalEnv": [
   "GITHUB_TOKEN" // env var that will impact the hashes of all tasks,
 ]
}

```
> 对于一些自定义的环境变量我们还是需要手动的声明。
> 这里官方推荐了两个eslint相关的插件来规范我们的环境变量相关配置。会帮助我们检测一些忽略掉的环境变量声明
> [https://turbo.build/repo/docs/core-concepts/caching#eslint-config-turbo](https://turbo.build/repo/docs/core-concepts/caching#eslint-config-turbo)

### 强制重写缓存
`--force`
```powershell
# Run `build` npm script in all workspaces,
# ignoring cache hits.
turbo run build --force
```
