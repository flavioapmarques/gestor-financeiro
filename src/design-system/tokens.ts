/** Design tokens — fintech premium (Nubank / Mobills / Organizze) */
export const tokens = {
  radius: { sm: '8px', md: '12px', lg: '16px', xl: '20px', '2xl': '24px', full: '9999px' },
  shadow: {
    sm: '0 1px 3px rgba(0,0,0,0.08)',
    md: '0 4px 20px rgba(0,0,0,0.12)',
    lg: '0 8px 40px rgba(0,0,0,0.18)',
    card: '0 12px 40px rgba(130, 10, 209, 0.15)',
  },
  motion: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
    spring: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const

export const colors = {
  light: {
    bg: '#F5F6FA',
    bgElevated: '#FFFFFF',
    bgMuted: '#EEF0F6',
    text: '#1A1D26',
    textMuted: '#6B7280',
    textSubtle: '#9CA3AF',
    border: 'rgba(26, 29, 38, 0.08)',
    primary: '#820AD1',
    primarySoft: 'rgba(130, 10, 209, 0.12)',
    accent: '#3D5AFE',
    navy: '#1A1F36',
    success: '#00C48C',
    danger: '#FF6B6B',
    warning: '#FFB020',
  },
  dark: {
    bg: '#0D0D12',
    bgElevated: '#16161F',
    bgMuted: '#1E1E2A',
    text: '#F5F6FA',
    textMuted: '#9CA3AF',
    textSubtle: '#6B7280',
    border: 'rgba(255, 255, 255, 0.08)',
    primary: '#9D4EDD',
    primarySoft: 'rgba(157, 78, 221, 0.18)',
    accent: '#6C8EF5',
    navy: '#1A1F36',
    success: '#00E096',
    danger: '#FF6B7A',
    warning: '#F5C842',
  },
} as const
