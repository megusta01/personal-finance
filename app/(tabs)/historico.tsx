import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { carregarTransacoes, atualizarTransacoes } from '../services/storage';
import { Transacao } from '../../types/Transacao';

function formatarData(isoString: string): string {
  const data = new Date(isoString);
  return data.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function Historico() {
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);

  // Carrega os dados quando o componente é montado
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const dados = await carregarTransacoes();
        console.log('Transações carregadas no Histórico:', dados);
        setTransacoes(dados);
      } catch (error) {
        console.error('Erro ao carregar transações:', error);
        Alert.alert('Erro', 'Não foi possível carregar as transações.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleExcluirTransacao = async (id: string) => {
    try {
      const novasTransacoes = transacoes.filter((t) => t.id !== id);
      await atualizarTransacoes(novasTransacoes);
      setTransacoes(novasTransacoes);
      Alert.alert('Sucesso', 'Transação removida!');
    } catch (error) {
      console.error('Erro ao excluir transação:', error);
      Alert.alert('Erro', 'Não foi possível remover a transação.');
    }
  };

  const renderItem = ({ item }: { item: Transacao }) => {
    const dataFormatada = formatarData(item.data);
    const isReceita = item.tipo === 'receita';
    const sinal = isReceita ? '+' : '-';
    const corValor = isReceita ? styles.incomeColor : styles.expenseColor;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.dateText}>{dataFormatada}</Text>
          <Text style={[styles.amountText, corValor]}>
            {sinal}${item.valor.toFixed(2)}
          </Text>
        </View>
        <Text style={styles.descriptionText}>{item.descricao}</Text>
        <Text style={styles.typeText}>
          {isReceita ? 'Income' : 'Expense'}
        </Text>
        <TouchableOpacity onPress={() => handleExcluirTransacao(item.id)}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transaction History</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 40 }} />
      ) : transacoes.length === 0 ? (
        <Text style={styles.noTransactions}>No transactions available.</Text>
      ) : (
        <FlatList
          data={transacoes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1C',
    padding: 16,
  },
  title: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 16,
  },
  noTransactions: {
    color: '#ccc',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
  card: {
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateText: {
    color: '#ccc',
    fontSize: 14,
  },
  amountText: {
    fontSize: 16,
    fontWeight: '600',
  },
  incomeColor: {
    color: '#00cc66',
  },
  expenseColor: {
    color: '#ff5050',
  },
  descriptionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  typeText: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 4,
  },
  deleteText: {
    color: '#ff3333',
    marginTop: 8,
    fontWeight: '600',
  },
});
