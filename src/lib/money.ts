/**
 * Dinheiro é sempre guardado como inteiro em centavos (R$ 12,34 → 1234).
 * Isso evita os erros de arredondamento de ponto flutuante (0,1 + 0,2 ≠ 0,3).
 */

export type Cents = number;

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const plain = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Troca o espaço especial que o Intl coloca depois de "R$" por um espaço comum. */
function normalizeSpaces(s: string) {
  return s.replace(/ | /g, ' ');
}

/** 123456 → "R$ 1.234,56" */
export function formatBRL(cents: Cents): string {
  // Usa o sinal de menos tipográfico (−), igual ao resto do app.
  return normalizeSpaces(brl.format(cents / 100)).replace(/^-/, '−');
}

/** 123456 → "1.234,56" (sem o símbolo) */
export function formatAmount(cents: Cents): string {
  return normalizeSpaces(plain.format(cents / 100));
}

/** Formata com sinal explícito: +R$ 10,00 / −R$ 10,00 */
export function formatSigned(cents: Cents): string {
  if (cents === 0) return formatBRL(0);
  return cents > 0 ? `+${formatBRL(cents)}` : formatBRL(cents);
}

/**
 * Converte o que a pessoa digitou em centavos.
 * Aceita "12,50", "12.50", "1.234,56", "1,234.56", "R$ 9", "  7 ".
 * Retorna null quando não dá para entender o valor.
 */
export function parseBRL(input: string): Cents | null {
  const s = input.replace(/R\$|\s/g, '').trim();
  if (!s || !/^-?[\d.,]+$/.test(s)) return null;

  const negative = s.startsWith('-');
  const body = negative ? s.slice(1) : s;

  const hasComma = body.includes(',');
  const hasDot = body.includes('.');

  let intPart = body;
  let fracPart = '';

  if (hasComma && hasDot) {
    // Os dois aparecem: o último é o decimal ("1.234,56" ou "1,234.56").
    const idx = Math.max(body.lastIndexOf(','), body.lastIndexOf('.'));
    intPart = body.slice(0, idx);
    fracPart = body.slice(idx + 1);
  } else if (hasComma || hasDot) {
    const sep = hasComma ? ',' : '.';
    const parts = body.split(sep);
    const last = parts[parts.length - 1]!;
    // Vários separadores ("1.234.567") ou exatamente 3 dígitos depois ("1.234") = milhar.
    const isThousands = parts.length > 2 || last.length === 3;
    if (!isThousands) {
      intPart = parts.slice(0, -1).join('');
      fracPart = last;
    }
  }

  // Separadores de milhar só podem ficar no meio de grupos de 3 dígitos.
  if (/[.,]/.test(intPart) && !/^\d{1,3}([.,]\d{3})+$/.test(intPart)) return null;
  intPart = intPart.replace(/[.,]/g, '');
  if (fracPart.length > 2 || /\D/.test(fracPart)) return null;
  if (!intPart && !fracPart) return null;

  const cents = Number(intPart || '0') * 100 + Number(fracPart.padEnd(2, '0') || '0');
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

/**
 * Para o campo de valor estilo app de banco: cada dígito digitado entra pela direita.
 * "1" → 1 centavo, "12" → 12 centavos, "1234" → R$ 12,34.
 */
export function centsFromDigits(text: string, maxDigits = 11): Cents {
  const digits = text.replace(/\D/g, '').replace(/^0+/, '').slice(0, maxDigits);
  return digits ? Number(digits) : 0;
}
