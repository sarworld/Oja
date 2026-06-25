import { defineConfig } from 'vitepress'

// Oja documentation site configuration.
// Dark-friendly default theme, with nav + a grouped sidebar.
export default defineConfig({
  title: 'Oja',
  description:
    'Your food photos, turned into a private calorie diary — self-hosted, with the AI model of your choice.',
  lang: 'en-US',
  lastUpdated: true,
  cleanUrls: true,

  // Default to the dark theme; users can still toggle.
  appearance: 'dark',

  // Don't fail the build on links to files that live outside docs/ (e.g. the
  // repo's CONTRIBUTING.md and PRODUCT.md, which are referenced relatively).
  ignoreDeadLinks: true,

  head: [
    ['meta', { name: 'theme-color', content: '#f0a868' }],
    [
      'meta',
      {
        name: 'og:description',
        content:
          'Self-hosted, MIT-licensed calorie diary that reads food photos from your photo source and logs calories + macros with a bring-your-own vision LLM.',
      },
    ],
  ],

  themeConfig: {
    siteTitle: 'Oja',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Get started', link: '/getting-started' },
      {
        text: 'Guide',
        items: [
          { text: 'Installation', link: '/installation' },
          { text: 'Configuration', link: '/configuration' },
          { text: 'Vision providers', link: '/vision-providers' },
          { text: 'Daily usage', link: '/usage' },
          { text: 'How sync works', link: '/how-sync-works' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Architecture', link: '/architecture' },
          { text: 'FAQ', link: '/faq' },
          { text: 'Troubleshooting', link: '/troubleshooting' },
          { text: 'Contributing', link: '/contributing' },
        ],
      },
      { text: 'Support', link: 'https://patreon.com/sarworld' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        collapsed: false,
        items: [
          { text: 'What is Oja?', link: '/' },
          { text: 'Getting started', link: '/getting-started' },
        ],
      },
      {
        text: 'Setup & configuration',
        collapsed: false,
        items: [
          { text: 'Installation', link: '/installation' },
          { text: 'Configuration', link: '/configuration' },
          { text: 'Vision providers', link: '/vision-providers' },
        ],
      },
      {
        text: 'Using Oja',
        collapsed: false,
        items: [
          { text: 'Daily usage', link: '/usage' },
          { text: 'How sync works', link: '/how-sync-works' },
        ],
      },
      {
        text: 'Reference',
        collapsed: false,
        items: [
          { text: 'Architecture', link: '/architecture' },
          { text: 'FAQ', link: '/faq' },
          { text: 'Troubleshooting', link: '/troubleshooting' },
          { text: 'Contributing', link: '/contributing' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/sarworld/Oja' },
    ],

    editLink: {
      pattern: 'https://github.com/sarworld/Oja/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Oja contributors',
    },
  },
})
