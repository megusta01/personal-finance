import type { ReactNode } from 'react';

/** No celular não há nada a preparar: o SQLite é nativo. */
export function CrossOriginGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
