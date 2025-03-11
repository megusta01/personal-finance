import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transacao } from '../../types/Transacao';

const STORAGE_KEY = 'transacoes';

// Salvar transação
export const salvarTransacao = async (novaTransacao: Transacao): Promise<void> => {
  try {
    const dados = await AsyncStorage.getItem(STORAGE_KEY);
    const transacoes: Transacao[] = dados ? JSON.parse(dados) : [];
    transacoes.push(novaTransacao);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(transacoes));
  } catch (error) {
    console.error('Erro ao salvar transação:', error);
    // Aqui você pode lançar um erro ou usar um callback para informar a camada de UI
    throw new Error('Não foi possível salvar a transação.'); 
  }
};


// Carregar transações
export const carregarTransacoes = async (): Promise<Transacao[]> => {
  try {
    const dados = await AsyncStorage.getItem(STORAGE_KEY);
    return dados ? JSON.parse(dados) : [];
  } catch (error) {
    console.error('Erro ao carregar transações:', error);
    return [];
  }
};

// Função para atualizar (sobrescrever) as transações
export const atualizarTransacoes = async (transacoes: Transacao[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(transacoes));
  } catch (error) {
    console.error('Erro ao atualizar transações:', error);
  }
};
