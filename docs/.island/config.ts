import { defineConfig } from 'islandjs'
import { FixYuQueImgForbidden } from './plugins/yuque-img'

const getSidebar = () => ({
  '/note': [
    {
      text: '总会有用',
      items: [
        { text: '简介', link: '/note/home' },
        { text: 'TODO', link: '/note/todo' },
        { text: 'HMR模块热更新（一）', link: '/note/hmr-api' },
        { text: 'vite中的HMR流程（二）', link: '/note/hmr-vite' },
        { text: '认识 CSR & SSR & hydrate', link: '/note/CSR&SSR&hydrate' },
        { text: 'react中的re-render', link: '/note/re-render' },
        { text: 'react中的cache方法', link: '/note/cache' },
        { text: 'turborepo笔记', link: '/note/turborepo' },
        { text: '实现一键复制功能', link: '/note/copy' },
        { text: '死链检测', link: '/note/deadLink' },
      ],
    },
    {
      text: '也许有用',
      items: [{ text: '当初为什么选择走这条路？', link: '/article/choose' }],
    },
  ],
})

const getNav = () => [
  {
    text: '首页',
    link: '/',
    activeMatch: '^/$|^/',
  },
  {
    text: 'Github',
    link: 'http://github.com/liuqh0609',
  },
]

export default defineConfig({
  title: "Liuqh's Note",
  icon: '/note_2.png',
  themeConfig: {
    lang: 'zh',
    locales: {
      '/zh/': {
        lang: 'zh',
        label: '简体中文',
        selectText: '语言',
        ariaLabel: '语言',
        lastUpdatedText: '上次更新',
        title: "Liuqh's Note",
        outlineTitle: '目录',
        prevPageText: '上一页',
        nextPageText: '下一页',
        editLink: {
          pattern: 'https://github.com/liuqh0609/note/tree/master/docs/:path',
          text: '📝 在 GitHub 上编辑此页',
        },
        nav: getNav(),
        sidebar: getSidebar(),
      },
    },
  },
  markdown: {
    rehypePlugins: [FixYuQueImgForbidden],
  },
})
