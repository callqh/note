本篇文章主要是简单认识一下这些专业词汇的意思。
没有复杂的源码分析之类的~ 【科普向】

## CSR

`client-side render` 客户端渲染
![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1666922143358-e335477e-1806-4c47-935d-bfa6234c6b4c.png#clientId=u0d6504c0-172d-4&crop=0&crop=0&crop=1&crop=1&from=paste&height=462&id=u3b5f18df&margin=%5Bobject%20Object%5D&name=image.png&originHeight=988&originWidth=1400&originalType=binary&ratio=1&rotation=0&showTitle=false&size=449823&status=done&style=none&taskId=ub83d52f5-5db6-4098-bf9b-15fcc2fa902&title=&width=655)

1. 客户端发送请求页面数据，服务端进行响应，并且返回对应页面的`js bundle`
2. 客户端下载`js`
3. 客户端执行下载来的`js`文件，渲染对应的`dom`树
4. 页面**可见**并且**可交互**
   :::success
   可以发现`CSR`的 html 内容是在客户端执行完成的
   :::
   客户端渲染的劣势在于需要先下载`js`然后在执行`js`，才可以渲染出来想要的页面，所以对于首屏渲染不友好。
   因此就出现了`SSR`方案

## SSR

`server-side render`服务端渲染
![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1666922346300-2182e8b6-697a-4ba1-9a06-4627d6905f70.png#clientId=u0d6504c0-172d-4&crop=0&crop=0&crop=1&crop=1&from=paste&height=433&id=u0df1c62a&margin=%5Bobject%20Object%5D&name=image.png&originHeight=486&originWidth=750&originalType=binary&ratio=1&rotation=0&showTitle=false&size=246538&status=done&style=none&taskId=u15791d73-e62e-47a2-bceb-0df5bb36dff&title=&width=668)

1. 客户端请求页面，服务端响应并返回`html`页面
2. 客户端下载`html`页面并且展示，这时**页面已经可见**，但是**还不能交互**，所以要下载`html`页面对应的`js`文件
3. 执行下载的`js`文件，进行注水（`hydrate`)_（会不会让页面重新渲染？）_
4. 注水完成页面**可交互**
   :::success
   可见服务端渲染`html`是在服务端就完成的
   :::
   从上面也可以看出其实`ssr`在第二步时就可以看到页面了，对于首屏渲染非常友好，只是此时的页面还不能进行交互（`dom`点击），需要进行`hydtate`之后才可以进行交互

所以接下来我们看一下`hydrate`是干什么的。
![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1666925766257-002610fb-8c68-43c0-bf5d-bb7f1466d4c0.png#clientId=u0d6504c0-172d-4&crop=0&crop=0&crop=1&crop=1&from=paste&height=718&id=u25ae3aaf&margin=%5Bobject%20Object%5D&name=image.png&originHeight=718&originWidth=1410&originalType=binary&ratio=1&rotation=0&showTitle=false&size=160010&status=done&style=none&taskId=u718a527f-73bc-48dd-90c6-8b6d69d6641&title=&width=1410)

## hydrate

从上面我们可以知道，在`ssr`中浏览器会首先将`html`页面展示出来，但是此时的页面是无法交互的（即没有绑定附加的点击等事件）。
所以我们后续需要**将一些可交互的事件注入到页面元素中去**，这个过程就是`hydrate`。
这个过程很像是给一个干瘪的元素注入生机，让他变得更加生动。

![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1666926999707-ec605600-541c-4cfd-a087-9c7f120ca115.png#clientId=u0d6504c0-172d-4&crop=0&crop=0&crop=1&crop=1&from=paste&height=407&id=ua3b5416f&margin=%5Bobject%20Object%5D&name=image.png&originHeight=782&originWidth=1036&originalType=binary&ratio=1&rotation=0&showTitle=false&size=753391&status=done&style=none&taskId=u5c9526da-a66e-489e-b9c7-bcbb7e208e7&title=&width=539)
首先我们可以看到上图中绿色的部分其实就是页面中可以交互的部分，上图就是一个完整可交互的`web`页面。
但是我们在`csr`中，因为客户端需要加载并执行`js`，所以一开始页面是下面这样的（空白页）
![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1666927107774-09dd3e2d-4fc0-4566-8c43-e12d58afe493.png#clientId=u0d6504c0-172d-4&crop=0&crop=0&crop=1&crop=1&from=paste&height=413&id=ua73f3ac8&margin=%5Bobject%20Object%5D&name=image.png&originHeight=874&originWidth=1148&originalType=binary&ratio=1&rotation=0&showTitle=false&size=27968&status=done&style=none&taskId=u142a9633-437e-4676-bc64-14d0321e102&title=&width=542)
而在`ssr`中，因为请求回来的就是一个**干瘪**的`html`页面，是可以直接展示的，像下图那样
![image.png](https://cdn.nlark.com/yuque/0/2022/png/2705850/1666927183744-a4b1f888-cf7a-421f-8275-f404ce52e938.png#clientId=u0d6504c0-172d-4&crop=0&crop=0&crop=1&crop=1&from=paste&height=405&id=u67aad005&margin=%5Bobject%20Object%5D&name=image.png&originHeight=782&originWidth=1042&originalType=binary&ratio=1&rotation=0&showTitle=false&size=588151&status=done&style=none&taskId=u2423d44c-1996-4e49-88ac-f2091aabf60&title=&width=539)
此时的页面是只可以看，不可以动的（即没有哪家附加的绑定事件）
而`hydrate`就是将这个干瘪的`html`注水变成可交互的

# 推荐阅读

● https://blog.saeloun.com/2021/12/16/hydration.html
● https://zhuanlan.zhihu.com/p/323174003
● http://www.ayqy.net/blog/react-ssr-under-the-hood/#articleHeader9
