import { defineConfig } from 'islandjs'

const getSidebar = () => ({
  '/note': [
    {
      text: '有趣的',
      items: [
        { text: '简介', link: '/note/home' },
        { text: '模块热更新(HMR)', link: '/note/hmr' },
        { text: '实现一键复制功能', link: '/note/copy' },
      ],
    },
  ],
})

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
        nav: [
          {
            text: '首页',
            link: '/',
            activeMatch: '^/$|^/',
          },
        ],
        sidebar: getSidebar(),
      },
    },
  },
})
