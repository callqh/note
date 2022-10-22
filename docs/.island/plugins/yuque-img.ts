import { visit } from 'unist-util-visit'

// 解决语雀图片403的问题
export const FixYuQueImgForbidden = () => {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName === 'img') {
        node.properties.referrerpolicy = 'no-referrer'
      }
    })
  }
}
