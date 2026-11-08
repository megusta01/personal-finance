import { describe, expect, it } from 'vitest';
import { formatSince, monthRange, parseLegacyDate, shiftMonth } from './dates';

describe('parseLegacyDate (datas da versão 1)', () => {
  it('lê o formato pt-BR', () => {
    expect(parseLegacyDate('07/11/2026 16:29:00')?.date).toBe('2026-11-07');
    expect(parseLegacyDate('31/01/2025 08:00:00')?.date).toBe('2025-01-31');
  });
  it('lê o formato en-US com AM/PM', () => {
    const r = parseLegacyDate('11/27/2025, 4:29:00 PM');
    expect(r?.date).toBe('2025-11-27');
    expect(new Date(r!.timestamp).getHours()).toBe(16);
  });
  it('em caso ambíguo assume dia/mês', () => {
    expect(parseLegacyDate('03/04/2025 10:00:00')?.date).toBe('2025-04-03');
  });
  it('aceita só a data e ISO', () => {
    expect(parseLegacyDate('5/3/2025')?.date).toBe('2025-03-05');
    expect(parseLegacyDate('2025-03-05')?.date).toBe('2025-03-05');
  });
  it('rejeita lixo e datas impossíveis', () => {
    expect(parseLegacyDate('ontem')).toBeNull();
    expect(parseLegacyDate('31/02/2025')).toBeNull();
  });
});

describe('meses', () => {
  it('navega entre meses e anos', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
  it('calcula o intervalo do mês', () => {
    expect(monthRange('2028-02')).toEqual(['2028-02-01', '2028-02-29']);
  });
});

describe('formatSince', () => {
  it('diz há quanto tempo foi', () => {
    const now = new Date('2026-11-08T12:00:00Z');
    expect(formatSince('2026-11-08T11:59:30Z', now)).toBe('agora mesmo');
    expect(formatSince('2026-11-08T11:55:00Z', now)).toBe('há 5 minutos');
    expect(formatSince('2026-11-08T10:00:00Z', now)).toBe('há 2 horas');
    expect(formatSince('2026-11-05T12:00:00Z', now)).toBe('há 3 dias');
    expect(formatSince('lixo', now)).toBe('');
  });
});
