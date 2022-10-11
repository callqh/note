# 在浏览器中实现 copy 功能

## 浏览器实现

实现 `copy` 功能的方式有很多，其中比较简单的方式就是利用浏览器提供的`API`。

> https://developer.mozilla.org/zh-CN/docs/Web/API/Clipboard

```js
navigator.clipboard.writeText('<empty clipboard>').then(
  function () {
    /* clipboard successfully set */
  },
  function () {
    /* clipboard write failed */
  }
)
```

当然这个 API 的兼容性还是不太好，所以我们可以使用`execCommand`来实现。

## 手动实现 copy 功能

大致思路也是比较简单，就是利用`input`的`select`方法来选中文本，然后利用`execCommand`的`copy`来实现复制。

> 当页面中有选择的文本时，`execCommand`的`copy`命令会复制选中的文本
> ![copy-1](/copy-1.jpg)

这里的源码参考`vitepress`的实现。

```ts
function copy(text) {
  const element = document.createElement('textarea')
  const previouslyFocusedElement = document.activeElement

  element.value = text

  // Prevent keyboard from showing on mobile
  element.setAttribute('readonly', '')

  element.style.contain = 'strict'
  element.style.position = 'absolute'
  element.style.left = '-9999px'
  element.style.fontSize = '12pt' // Prevent zooming on iOS

  const selection = document.getSelection()
  const originalRange = selection ? selection.rangeCount > 0 && selection.getRangeAt(0) : null

  document.body.appendChild(element)
  element.select()

  // Explicit selection workaround for iOS
  element.selectionStart = 0
  element.selectionEnd = text.length

  document.execCommand('copy')
  document.body.removeChild(element)

  if (originalRange) {
    selection!.removeAllRanges() // originalRange can't be truthy when selection is falsy
    selection!.addRange(originalRange)
  }

  // Get the focus back on the previously focused element, if any
  if (previouslyFocusedElement) {
    ;(previouslyFocusedElement as HTMLElement).focus()
  }
}
```

## 使用第三方库 copy-to-clipboard

该库小巧，易用。

具体使用方式可以参考[官方文档](https://www.npmjs.com/package/copy-to-clipboard)

```js
import copy from 'copy-to-clipboard'

copy('Text')

// Copy with options
copy('Text', {
  debug: true,
  message: 'Press #{key} to copy',
})
```

### 源码

```js
'use strict'

var deselectCurrent = require('toggle-selection')

var clipboardToIE11Formatting = {
  'text/plain': 'Text',
  'text/html': 'Url',
  default: 'Text',
}

function copy(text, options) {
  var reselectPrevious,
    range,
    selection,
    mark,
    success = false
  if (!options) {
    options = {}
  }
  try {
    reselectPrevious = deselectCurrent()
    range = document.createRange()
    selection = document.getSelection()

    mark = document.createElement('span')
    mark.textContent = text
    // avoid screen readers from reading out loud the text
    mark.ariaHidden = 'true'
    // reset user styles for span element
    mark.style.all = 'unset'
    // prevents scrolling to the end of the page
    mark.style.position = 'fixed'
    mark.style.top = 0
    mark.style.clip = 'rect(0, 0, 0, 0)'
    // used to preserve spaces and line breaks
    mark.style.whiteSpace = 'pre'
    // do not inherit user-select (it may be `none`)
    mark.style.webkitUserSelect = 'text'
    mark.style.MozUserSelect = 'text'
    mark.style.msUserSelect = 'text'
    mark.style.userSelect = 'text'

    // 利用 span 标签来监听 copy 事件
    mark.addEventListener('copy', function (e) {
      e.stopPropagation()
      e.preventDefault()
      if (typeof e.clipboardData === 'undefined') {
        // 兼容IE 11
        window.clipboardData.clearData()
        var format = clipboardToIE11Formatting[options.format] || clipboardToIE11Formatting['default']
        window.clipboardData.setData(format, text)
      } else {
        // all other browsers
        e.clipboardData.clearData()
        e.clipboardData.setData(options.format, text)
      }
    })

    document.body.appendChild(mark)
    // 选中创建的标签文本
    range.selectNodeContents(mark)
    selection.addRange(range)
    // 实现复制方法
    var successful = document.execCommand('copy')
    if (!successful) {
      throw new Error('copy command was unsuccessful')
    }
    success = true
  } catch (err) {
    try {
      window.clipboardData.setData(options.format || 'text', text)
      options.onCopy && options.onCopy(window.clipboardData)
      success = true
    } catch (err) {}
  } finally {
    if (selection) {
      if (typeof selection.removeRange == 'function') {
        selection.removeRange(range)
      } else {
        selection.removeAllRanges()
      }
    }

    if (mark) {
      document.body.removeChild(mark)
    }
    reselectPrevious()
  }

  return success
}

module.exports = copy
```

> - copy_event: https://developer.mozilla.org/zh-CN/docs/Web/API/Element/copy_event
> - toggle-selection: https://www.npmjs.com/package/toggle-selection

## 对比 copy-to-clipboard 和 vitepress 中实现的 copy

- `copy-to-clipboard`是自己创建一个 `span` 标签，然后改变 `span` 标签为一个可选中的元素`user-select`，当选中元素时，触发 `copy` 事件，然后将选中的文本复制到剪切板中。
  > (为啥下面还使用了 `document.execCommand('copy')`，我也不知道，可能是兼容性问题吧？按道理来说，`copy` 事件触发后，剪切板中就已经有了文本，不需要再执行 `document.execCommand('copy')` 了吧？)
  -
- `vitepress` 中是用 `textarea` 元素来实现的，直接选中 `textarea` 中的文本，然后实现 `copy`
