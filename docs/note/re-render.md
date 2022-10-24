:::tip
原文：[在你写 memo()之前](https://overreacted.io/zh-hans/before-you-memo/)
:::

## 文章内容

大概意思就是在你写`memo()`去优化组件的时候还有两种方式去优化代码。

```tsx
import { useState } from 'react'

export default function App() {
  let [color, setColor] = useState('red')
  return (
    <div>
      <input value={color} onChange={(e) => setColor(e.target.value)} />
      <p style={{ color }}>Hello, world!</p>
      <ExpensiveTree />
    </div>
  )
}

function ExpensiveTree() {
  let now = performance.now()
  while (performance.now() - now < 100) {
    // Artificial delay -- do nothing for 100ms
  }
  return <p>I am a very slow component tree.</p>
}
```

上面这个组件现在存在的问题：

1. 当我们在`input`中输入`color`后，会导致`App`组件重新渲染，然后`ExpensiveTree`组件虽然不依赖`color`，但是由于父组件`re-render`,他自己也会进行无效的`re-render`

为了减少这种无效的`re-render`,我们经常会使用[memo()](https://beta.reactjs.org/apis/react/memo#usage)去包裹组件，来达到缓存组件，减少无效更新的情况。

```tsx
import { useState, memo } from 'react'

export default function App() {
  let [color, setColor] = useState('red')
  return (
    <>
      <input value={color} onChange={(e) => setColor(e.target.value)} />
      <p style={{ color }}>Hello, world!</p>
      <ExpensiveTree />
    </>
  )
}
// 使用memo
let ExpensiveTree = memo(() => {
  let now = performance.now()
  while (performance.now() - now < 100) {
    // Artificial delay -- do nothing for 100ms
  }
  return <p>I am a very slow component tree.</p>
})
```

而这篇文章就是讲解另外两种解决思路。

### 1. 向下移动 state

这个解决方法其实就是将组件粒度变得更细。
将`state`下沉到与之相关的组件中去，也就是将与该状态相关的组件抽离成一个单独的组件。

```tsx
import { useState } from 'react'

export default function App() {
  return (
    <div>
      <Form />
      <ExpensiveTree />
    </div>
  )
}

// 将state下沉到该组件中
function Form() {
  let [color, setColor] = useState('red')
  return (
    <>
      <input value={color} onChange={(e) => setColor(e.target.value)} />
      <p style={{ color }}>Hello, world!</p>
    </>
  )
}

function ExpensiveTree() {
  let now = performance.now()
  while (performance.now() - now < 100) {
    // Artificial delay -- do nothing for 100ms
  }
  return <p>I am a very slow component tree.</p>
}
```

### 2. 内容提升

像上面那种情况，组件可以单独抽离是因为知道`ExpensiveTree`组件不依赖`color`的状态。
但是如果我们假设是`App`中的`div`依赖`color`呢。这种情况下其实`ExpensiveTree`组件依然不应该刷新。

```tsx
import { useState } from 'react'

export default function App() {
  let [color, setColor] = useState('red')
  return (
    <div style={{ color }}>
      <input value={color} onChange={(e) => setColor(e.target.value)} />
      <p>Hello, world!</p>
      <ExpensiveTree />
    </div>
  )
}

function ExpensiveTree() {
  let now = performance.now()
  while (performance.now() - now < 100) {
    // Artificial delay -- do nothing for 100ms
  }
  return <p>I am a very slow component tree.</p>
}
```

这种情况下，我们需要将

```tsx
import { useState } from 'react'

export default function App() {
  return (
    <ColorPicker>
      <p>Hello, world!</p>
      <ExpensiveTree />
    </ColorPicker>
  )
}

// 将内容提升到该父组件中
function ColorPicker({ children }) {
  let [color, setColor] = useState('red')

  return (
    <div style={{ color }}>
      <input value={color} onChange={(e) => setColor(e.target.value)} />

      {children}
    </div>
  )
}

function ExpensiveTree() {
  let now = performance.now()
  while (performance.now() - now < 100) {
    // Artificial delay -- do nothing for 100ms
  }
  return <p>I am a very slow component tree.</p>
}
```

可以看到我们将 App 组件一分为二。
将于`color`相关的组件放到`ColorPicker`中，然后不相关的作为`children`传给`ColorPicker`组件。
这样在`ColorPicker`组件`re-render`的时候，**由于**`**App**`**（父组件）中的组件没有变化，所以拿到的**`**children**`**依然是上一次的（没有发生变化的）所以**`**children**`**部分不会**`**re-render**`**。**
这样就避免了无效的刷新。

其实我理解的这里的内容提升，是指将于本次`re-render`无关的组件提升到父组件中去，通过`props`的方法传递给其他组件。这样其他组件在进行`re-render`的时候其实是不会影响到`props`的。

## 案例解析

这里我们讲完了上面的两种方法，来看一个案例。加深一下印象

```tsx
import React, { ReactNode, StrictMode } from 'react'

import { useValue, MyContext } from './state'
import Counter from './Counter'
import Person from './Person'

const Provider = ({ children }: { children: ReactNode }) => <MyContext.Provider value={useValue()}>{children}</MyContext.Provider>

const Body = () => (
  <div>
    <h1>Counter</h1>
    <Counter />
    <Counter />
    <h1>Person</h1>
    <Person />
    <Person />
  </div>
)

const App = () => (
  <StrictMode>
    <Provider>
      <Body />
    </Provider>
  </StrictMode>
)

export default App
```

这里省略了很多代码，具体的代码案例，查看上面的链接。
一句话来说。这是` use-context-seletor` 的官方例子。点击 `+` 或者`-`按钮，下面 `Person` 表单不会刷新。
但是将此案例稍微更改一下就会发现不一样的效果：

1. 删掉`Provider`组件

```tsx
import React, { ReactNode, StrictMode } from 'react'

import { useValue, MyContext } from './state'
import Counter from './Counter'
import Person from './Person'

const Body = () => (
  <div>
    <h1>Counter</h1>
    <Counter />
    <Counter />
    <h1>Person</h1>
    <Person />
    <Person />
  </div>
)

const App = () => (
  <StrictMode>
    <MyContext.Provider value={useValue()}>
      <Body />
    </MyContext.Provider>
  </StrictMode>
)

export default App
```

会发现这时点击 `+` 或者`-`按钮，`Person`组件也会进行`re-render`。

### 原因分析

1. 删掉`Provider`组件之后。当`MyContext.Provider`组件的`value`值更新时，其会进行`re-reder`，那么作为子组件的`Body`自然也会进行`re-render`。那么在`Body`组件里面的子组件也会进行`re-render`
2. 对于没修改之前的代码为什么不会产生无效的`re-render`呢？
   1. 可以看到之前的代码里，`Body`组件是作为`props.children`传递给`Provider`组件的，当`MyContext.Provider`组件的`value`值更新时，会触发其进行`re-render`，但是`props`不会受到它的影响，所以`Body`组件没有进行`re-render`,那么父组件没有进行`re-render`他里面的子组件自然不会进行无效的`re-render`.

## 总结

1. **下沉`state`**。在不变中抽离中变化的部分，将`state`与变化的部分绑定为同一个组件。
2. **内容提升**。子组件的`re-render`是不会影响`props`的，即与`props`无关。所以我们可以通过`props`的方法传递无关的组件，来避免`re-render`。
   1. 除了`props.children`之外那用其他 `props` 属性可以吗？比如 `<Changed left={<Expansive1 />} right={<Expansive2 />} />`，` <Changed />``re-render ` 并不会导致 ` <Expansive />`` re-render `。这种方法叫「`componets as props`」。
