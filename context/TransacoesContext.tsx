import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Transacao } from '../types/Transacao';
import { carregarTransacoes } from '../app/services/storage';

interface TransacoesContextType {
  transacoes: Transacao[];
  setTransacoes: React.Dispatch<React.SetStateAction<Transacao[]>>;
}

// Cria o contexto com valores iniciais padrão
export const TransacoesContext = createContext<TransacoesContextType>({
  transacoes: [],
  setTransacoes: () => {},
});

interface TransacoesProviderProps {
  children: ReactNode;
}

// Provider que gerencia o estado das transações globalmente
export const TransacoesProvider = ({ children }: TransacoesProviderProps) => {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);

  useEffect(() => {
    async function loadTransacoes() {
      const dados = await carregarTransacoes();
      setTransacoes(dados);
    }
    loadTransacoes();
  }, []);

  return (
    <TransacoesContext.Provider value={{ transacoes, setTransacoes }}>
      {children}
    </TransacoesContext.Provider>
  );
};
