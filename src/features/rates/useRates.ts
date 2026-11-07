import { useCallback, useEffect, useRef, useState } from 'react';

export type Rate = {
  code: 'USD' | 'EUR' | 'GBP' | 'BTC';
  name: string;
  /** Quanto vale 1 unidade da moeda, em reais. */
  bid: number;
  /** Variação do dia, em %. */
  pctChange: number;
};

type State =
  | { status: 'loading'; rates?: Rate[]; updatedAt?: Date }
  | { status: 'ready'; rates: Rate[]; updatedAt: Date }
  | { status: 'error'; rates?: Rate[]; updatedAt?: Date; message: string };

const NAMES: Record<Rate['code'], string> = {
  USD: 'Dólar americano',
  EUR: 'Euro',
  GBP: 'Libra esterlina',
  BTC: 'Bitcoin',
};

const URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,GBP-BRL,BTC-BRL';

export async function fetchRates(signal?: AbortSignal): Promise<Rate[]> {
  const res = await fetch(URL, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as Record<string, { bid: string; pctChange: string }>;
  return (Object.keys(NAMES) as Rate['code'][]).map((code) => {
    const item = json[`${code}BRL`];
    const bid = Number(item?.bid);
    if (!item || !Number.isFinite(bid) || bid <= 0)
      throw new Error(`Cotação inválida para ${code}`);
    return { code, name: NAMES[code], bid, pctChange: Number(item.pctChange) || 0 };
  });
}

/** Cotações com cache em memória por 10 minutos e tratamento de erro (sem NaN na tela). */
let cache: { rates: Rate[]; at: Date } | null = null;
const TTL = 10 * 60 * 1000;

export function useRates() {
  const [state, setState] = useState<State>(() =>
    cache ? { status: 'ready', rates: cache.rates, updatedAt: cache.at } : { status: 'loading' },
  );
  const abortRef = useRef<AbortController | null>(null);

  /** Busca na API; o estado só muda quando a resposta chega (nos callbacks da Promise). */
  const fetchInto = useCallback(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    return fetchRates(ctrl.signal)
      .then(
        (rates) => {
          cache = { rates, at: new Date() };
          setState({ status: 'ready', rates, updatedAt: cache.at });
        },
        () => {
          if (abortRef.current !== ctrl) return; // substituída por outra chamada ou tela fechada
          setState((s) => ({
            status: 'error',
            rates: s.rates,
            updatedAt: s.updatedAt,
            message:
              'Não foi possível atualizar as cotações. Verifique a internet e tente de novo.',
          }));
        },
      )
      .finally(() => clearTimeout(timeout));
  }, []);

  useEffect(() => {
    const fresh = cache && Date.now() - cache.at.getTime() < TTL;
    if (!fresh) void fetchInto();
    return () => {
      const ctrl = abortRef.current;
      abortRef.current = null;
      ctrl?.abort();
    };
  }, [fetchInto]);

  const reload = useCallback(() => {
    setState((s) => ({ status: 'loading', rates: s.rates, updatedAt: s.updatedAt }));
    void fetchInto();
  }, [fetchInto]);

  return { ...state, reload };
}
