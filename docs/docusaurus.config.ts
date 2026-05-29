import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'FrangiPool',
  tagline: 'Automatisation ESP32 pour piscine à sel — filtration autonome, électrolyseur, Redox, pH.',
  favicon: 'img/logo.svg',

  url: 'https://gaetanars.github.io',
  baseUrl: '/FrangiPool/',

  organizationName: 'gaetanars',
  projectName: 'FrangiPool',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'fr',
    locales: ['fr'],
  },

  scripts: [
    {
      src: 'https://unpkg.com/esp-web-tools@10/dist/web/install-button.js',
      type: 'module',
      async: true,
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: 'docs',
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'FrangiPool',
      logo: {
        alt: 'FrangiPool',
        src: 'img/logo.svg',
        srcDark: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://github.com/gaetanars/FrangiPool',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            { label: 'Démarrage rapide', to: '/docs/getting-started/choisir-son-preset' },
            { label: 'Filtration autonome', to: '/docs/fonctionnement/filtration-autonome' },
            { label: 'Calibration', to: '/docs/configuration/calibration-ph' },
            { label: 'PCB & Câblage', to: '/docs/pcb-cablage/presentation' },
          ],
        },
        {
          title: 'Projet',
          items: [
            { label: 'GitHub', href: 'https://github.com/gaetanars/FrangiPool' },
            { label: 'Releases', href: 'https://github.com/gaetanars/FrangiPool/releases' },
            { label: 'Issues', href: 'https://github.com/gaetanars/FrangiPool/issues' },
          ],
        },
        {
          title: 'Communauté',
          items: [
            { label: 'ESPHome', href: 'https://esphome.io' },
            { label: 'Home Assistant', href: 'https://www.home-assistant.io' },
          ],
        },
      ],
      copyright: `FrangiPool — Open Source · ESPHome · ESP32`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['yaml', 'bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
