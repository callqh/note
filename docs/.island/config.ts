import { defineConfig } from 'islandjs'

const getSidebar = () => ({
  '/note': [
    {
      text: '总会有用',
      items: [
        { text: '简介', link: '/note/home' },
        { text: 'HMR模块热更新（一）', link: '/note/hmr-api' },
        { text: 'vite中的HMR流程（二）', link: '/note/hmr-vite' },
        { text: '实现一键复制功能', link: '/note/copy' },
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
})
