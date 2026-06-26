import { defineConfig } from 'vitepress'

// Oja documentation site.
export default defineConfig({
  title: 'Oja',
  description:
    'A self-hosted calorie diary that reads food photos from an Immich album, using a vision model you choose.',
  lang: 'en-US',
  lastUpdated: true,
  cleanUrls: true,
  appearance: 'dark',
  ignoreDeadLinks: true,

  themeConfig: {
    siteTitle: 'Oja',

    nav: [
      { text: 'Install', link: '/installation' },
      { text: 'Configuration', link: '/configuration' },
      { text: 'Vision providers', link: '/vision-providers' },
      { text: 'FAQ', link: '/faq' },
      { text: 'Support', link: 'https://patreon.com/sarworld' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Install', link: '/installation' },
          { text: 'Configuration', link: '/configuration' },
          { text: 'Vision providers', link: '/vision-providers' },
          { text: 'FAQ & troubleshooting', link: '/faq' },
          { text: 'Contributing', link: '/contributing' },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/sarworld/Oja' }],

    editLink: {
      pattern: 'https://github.com/sarworld/Oja/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    search: { provider: 'local' },

    footer: {
      message: 'Built with heavy AI assistance · MIT Licensed',
      copyright: 'Oja',
    },
  },
})
