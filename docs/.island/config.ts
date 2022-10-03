import { defineConfig } from 'islandjs'

export default defineConfig({
  title: 'my-site',
  themeConfig: {
    lang: 'zh',
    locales: {
      '/zh/': {
        lang: 'zh',
        label: '简体中文',
        selectText: '语言',
        ariaLabel: '语言',
        lastUpdatedText: '上次更新',
        title: 'Island.js',
        outlineTitle: '目录',
        prevPageText: '上一页',
        nextPageText: '下一页',
        description: '基于孤岛架构的 SSG 框架',
        editLink: {
          pattern: 'https://github.com/sanyuan0704/island.js/tree/master/docs/:path',
          text: '📝 在 GitHub 上编辑此页',
        },
        nav: [
          {
            text: '首页',
            link: '/',
            activeMatch: '^/$|^/',
          },
        ],
        sidebar: {
          '/note': [
            {
              text: '指南',
              items: [
                { text: '1', link: '/note' },
                { text: '2', link: '/note/foo' },
              ],
            },
          ],
        },
      },
    },
  },
})
