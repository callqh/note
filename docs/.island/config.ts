import { defineConfig } from 'islandjs'

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
        description: 'hhhhhh',
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
        sidebar: {
          '/note': [
            {
              text: '有趣的',
              items: [
                { text: '简介', link: '/note/note' },
                { text: '测试', link: '/note/foo' },
              ],
            },
            // {
            //   text: '无趣的',
            //   items: [
            //     { text: '简介', link: '/note/note' },
            //     { text: '测试', link: '/note/foo' },
            //   ],
            // },
          ],
        },
      },
    },
  },
})
