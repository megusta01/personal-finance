/**
 * Design tokens.
 *
 * Direção visual: verde-petróleo (confiança, cara de banco) com detalhes em latão
 * (lembra moeda), sobre um cinza levemente esverdeado. A peça marcante é o cartão
 * de saldo em petróleo; o resto da interface fica quieto e organizado.
 */

export type Palette = {
  bg: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  /** Cor de ação: botões, links, item ativo. */
  brand: string;
  onBrand: string;
  brandSoft: string;
  /** Cartão de saldo. */
  heroBg: string;
  heroText: string;
  heroMuted: string;
  heroLine: string;
  accent: string;
  income: string;
  incomeSoft: string;
  expense: string;
  expenseSoft: string;
  danger: string;
  overlay: string;
};

export const light: Palette = {
  bg: '#F3F5F4',
  surface: '#FFFFFF',
  surfaceMuted: '#E9EEED',
  border: '#DCE3E2',
  text: '#0E1A1F',
  textMuted: '#55666B',
  textSubtle: '#86959A',
  brand: '#0F4C5C',
  onBrand: '#F6F1E6',
  brandSoft: '#DCEBEE',
  heroBg: '#0F4C5C',
  heroText: '#F6F1E6',
  heroMuted: '#A9C6CC',
  heroLine: '#D4A84B',
  accent: '#B8862A',
  income: '#1B8457',
  incomeSoft: '#DDF1E7',
  expense: '#B9423E',
  expenseSoft: '#F7E1DF',
  danger: '#B9423E',
  overlay: 'rgba(8, 20, 24, 0.45)',
};

export const dark: Palette = {
  bg: '#0B1315',
  surface: '#121D20',
  surfaceMuted: '#1A282C',
  border: '#23353A',
  text: '#E8EFEE',
  textMuted: '#97A9AC',
  textSubtle: '#677A7E',
  brand: '#6BBCCB',
  onBrand: '#06272F',
  brandSoft: '#16343B',
  heroBg: '#11414D',
  heroText: '#F6F1E6',
  heroMuted: '#93B7BE',
  heroLine: '#D9AE52',
  accent: '#D9AE52',
  income: '#52C48C',
  incomeSoft: '#143327',
  expense: '#EF7B72',
  expenseSoft: '#3A1D1B',
  danger: '#EF7B72',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export const font = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

/** Escala tipográfica (tamanho / altura de linha). */
export const type = {
  display: { fontFamily: font.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  title: { fontFamily: font.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  heading: { fontFamily: font.bold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: font.medium, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.2 },
} as const;

export type TypeVariant = keyof typeof type;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;

/** Raios diferentes por hierarquia: cartão de saldo > superfícies > controles. */
export const radius = { sm: 8, md: 12, lg: 18, xl: 26, pill: 999 } as const;
