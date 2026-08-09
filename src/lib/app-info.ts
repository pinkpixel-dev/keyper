/**
 * App identity and links, in one place.
 *
 * The version comes from package.json via a Vite define, so there is exactly one
 * place it is set. Never hardcode a version string in a component: the Settings
 * screen used to show "0.1.0" long after the app had moved on, which is the kind
 * of thing nobody notices until a user quotes it in a bug report.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

declare const __APP_VERSION__: string;

/** Current app version, from package.json at build time. */
export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev';

export const APP_NAME = 'Keyper';

export const APP_LINKS = {
  website: 'https://keyper.icu',
  docs: 'https://keyper.icu/getting-started/overview/',
  migrationGuide: 'https://keyper.icu/getting-started/upgrading-to-1-3/',
  securityModel: 'https://keyper.icu/security/security-model/',
  github: 'https://github.com/pinkpixel-dev/keyper',
  issues: 'https://github.com/pinkpixel-dev/keyper/issues',
  releases: 'https://github.com/pinkpixel-dev/keyper/releases',
  license: 'https://github.com/pinkpixel-dev/keyper/blob/main/LICENSE',
  changelog: 'https://github.com/pinkpixel-dev/keyper/blob/main/CHANGELOG.md',
} as const;

export const SUPPORT_EMAIL = 'support@keyper.icu';

export const MAKER = {
  name: 'Pink Pixel',
  website: 'https://pinkpixel.dev',
  github: 'https://github.com/pinkpixel-dev',
} as const;

export const LICENSE = 'Apache-2.0';
