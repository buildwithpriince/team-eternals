export interface ThemeTokens {
  name: 'general' | 'ayush';
  displayNameEn: string;
  displayNameHi: string;
  colors: {
    bgPage: string;
    bgCard: string;
    bgCardSubtle: string;
    borderDefault: string;
    borderActive: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    primary: string;
    primaryLight: string;
    primaryDark: string;
    primaryContent: string;
    accent: string;
    accentLight: string;
    accentContent: string;
    headerAccent?: string;
    alertRed: string;
    alertRedBg: string;
    alertRedBorder: string;
    success: string;
    successBg: string;
  };
  fonts: {
    body: string;
    heading: string;
    display: string;
  };
  radii: {
    card: string;
    innerCard: string;
    button: string;
    chip: string;
    badge: string;
  };
}

export const generalClinicalTheme: ThemeTokens = {
  name: 'general',
  displayNameEn: 'General OPD / Internal Medicine',
  displayNameHi: 'सामान्य चिकित्सा विभाग',
  colors: {
    bgPage: '#F0F4F8', // Professional Polish slate-porcelain canvas
    bgCard: '#FFFFFF',
    bgCardSubtle: '#F2F5F7',
    borderDefault: '#CBD5E1',
    borderActive: '#102A43',
    textPrimary: '#102A43', // High-contrast deep slate navy
    textSecondary: '#486581',
    textMuted: '#627D98',
    primary: '#102A43', // Deep Professional Slate Navy
    primaryLight: '#E0F2FE',
    primaryDark: '#0B1D2F',
    primaryContent: '#FFFFFF',
    accent: '#F0B429', // High-contrast warm gold/amber CTA accent
    accentLight: '#FEF3C7',
    accentContent: '#102A43',
    alertRed: '#D64545', // Professional emergency crimson
    alertRedBg: '#FEF2F2',
    alertRedBorder: '#FCA5A5',
    success: '#059669',
    successBg: '#ECFDF5',
  },
  fonts: {
    body: "'Plus Jakarta Sans', 'Noto Sans Devanagari', sans-serif",
    heading: "'Plus Jakarta Sans', 'Noto Sans Devanagari', sans-serif",
    display: "'Plus Jakarta Sans', sans-serif",
  },
  radii: {
    card: '16px',
    innerCard: '10px',
    button: '12px',
    chip: '28px',
    badge: '8px',
  },
};

export const ayushTheme: ThemeTokens = {
  name: 'ayush',
  displayNameEn: 'AYUSH & Ayurvedic OPD',
  displayNameHi: 'आयुष एवं आयुर्वेद ओ.पी.डी.',
  colors: {
    bgPage: '#F0F4F8', // Unified polished canvas with warm subtle tint
    bgCard: '#FFFFFF',
    bgCardSubtle: '#F4EFE6',
    borderDefault: '#CBD5E1',
    borderActive: '#1B4332',
    textPrimary: '#102A43', // Deep Forest Navy
    textSecondary: '#334E68',
    textMuted: '#627D98',
    primary: '#1B4332', // Deep Ayurvedic Herbal Green
    primaryLight: '#E8F3EE',
    primaryDark: '#0F261C',
    primaryContent: '#FFFFFF',
    accent: '#D97706', // Warm turmeric saffron
    accentLight: '#FEF3C7',
    accentContent: '#78350F',
    headerAccent: '#581C28', // Deep Vaidya Maroon
    alertRed: '#D64545',
    alertRedBg: '#FEF2F2',
    alertRedBorder: '#FCA5A5',
    success: '#15803D',
    successBg: '#F0FDF4',
  },
  fonts: {
    body: "'Plus Jakarta Sans', 'Noto Sans Devanagari', sans-serif",
    heading: "'Plus Jakarta Sans', 'Noto Sans Devanagari', sans-serif",
    display: "'Cinzel', 'Plus Jakarta Sans', serif",
  },
  radii: {
    card: '16px',
    innerCard: '10px',
    button: '12px',
    chip: '28px',
    badge: '8px',
  },
};

export const themes = {
  general: generalClinicalTheme,
  ayush: ayushTheme,
};
