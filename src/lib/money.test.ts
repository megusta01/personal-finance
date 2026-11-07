import { describe, expect, it } from 'vitest';
import { centsFromDigits, formatBRL, formatSigned, parseBRL } from './money';

describe('parseBRL', () => {
  it.each([
    ['12,50', 1250],
    ['12.50', 1250],
    ['12,5', 1250],
    ['12', 1200],
    ['R$ 9', 900],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['1.234', 123400],
    ['1.234.567', 123456700],
    ['0,01', 1],
    ['  7 ', 700],
    ['-3,20', -320],
  ])('"%s" → %d centavos', (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });

  it.each(['', 'abc', '12,345,6', '1,2,3', '12.3456', '1.23.4'])('rejeita "%s"', (input) => {
    expect(parseBRL(input)).toBeNull();
  });

  it('não sofre com arredondamento de float', () => {
    expect(parseBRL('0,10')! + parseBRL('0,20')!).toBe(30);
  });
});

describe('formatação', () => {
  it('formata em reais', () => {
    expect(formatBRL(123456)).toBe('R$ 1.234,56');
    expect(formatBRL(5)).toBe('R$ 0,05');
  });
  it('mostra o sinal', () => {
    expect(formatSigned(1000)).toBe('+R$ 10,00');
    expect(formatSigned(-1000)).toBe('−R$ 10,00');
    expect(formatBRL(-250)).toBe('−R$ 2,50');
  });
});

describe('centsFromDigits (campo estilo banco)', () => {
  it('cada dígito entra pela direita', () => {
    expect(centsFromDigits('1')).toBe(1);
    expect(centsFromDigits('1234')).toBe(1234);
    expect(centsFromDigits('R$ 12,34')).toBe(1234);
    expect(centsFromDigits('')).toBe(0);
    expect(centsFromDigits('0007')).toBe(7);
  });
});
