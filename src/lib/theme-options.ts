export const THEME_STORAGE_KEY = 'theme';

export const THEME_OPTIONS = [
  {
    value: 'light',
    label: 'Light',
    description: 'Clean white workspace',
    swatchClass: 'theme-swatch-light',
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Near-black vault',
    swatchClass: 'theme-swatch-dark',
  },
  {
    value: 'system',
    label: 'System',
    description: 'Match this device',
    swatchClass: 'theme-swatch-system',
  },
  {
    value: 'theme-charcoal',
    label: 'Charcoal',
    description: 'Softer dark contrast',
    swatchClass: 'theme-swatch-charcoal',
  },
  {
    value: 'theme-light-gray',
    label: 'Light Gray',
    description: 'Neutral low-glare light',
    swatchClass: 'theme-swatch-light-gray',
  },
  {
    value: 'theme-medium-gray',
    label: 'Medium Gray',
    description: 'Balanced middle contrast',
    swatchClass: 'theme-swatch-medium-gray',
  },
  {
    value: 'theme-warm-light',
    label: 'Warm Light',
    description: 'Soft warm workspace',
    swatchClass: 'theme-swatch-warm-light',
  },
  {
    value: 'theme-blue',
    label: 'Blue',
    description: 'Cool blue focus',
    swatchClass: 'theme-swatch-blue',
  },
  {
    value: 'theme-midnight-blue',
    label: 'Midnight Blue',
    description: 'Deep blue dark mode',
    swatchClass: 'theme-swatch-midnight-blue',
  },
  {
    value: 'theme-deep-purple',
    label: 'Deep Purple',
    description: 'Quiet purple dark mode',
    swatchClass: 'theme-swatch-deep-purple',
  },
] as const;

export const THEME_VALUES = THEME_OPTIONS
  .filter((theme) => theme.value !== 'system')
  .map((theme) => theme.value);
