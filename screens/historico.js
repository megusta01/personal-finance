import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { carregarTransacoes, excluirTransacao } from '../services/storage';
import { useFocusEffect } from '@react-navigation/native';

export default function Historico({ navigation }) {
  const [transacoes, setTransacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      async function fetchData() {
        try {
          setLoading(true);
          const dados = await carregarTransacoes();
          setTransacoes(dados);
        } catch (error) {
          console.error('Erro ao carregar transações:', error);
          Alert.alert('Erro', 'Não foi possível carregar as transações.');
        } finally {
          setLoading(false);
        }
      }
      fetchData();
    }, [])
  );

  const handleExcluirTransacao = async (id) => {
    try {
      await excluirTransacao(id);
      setTransacoes((prev) => prev.filter((t) => t.id !== id));
      Alert.alert('Sucesso', 'Transação removida!');
    } catch (error) {
      console.error('Erro ao excluir transação:', error);
      Alert.alert('Erro', 'Não foi possível remover a transação.');
    }
  };

  const handleAlterarTransacao = (transacaoEditando) => {
    navigation.navigate('Transações', { transacaoEditando });
  };

  const renderItem = ({ item }) => {
    const valorStyle =
      item.tipo === 'receita'
        ? styles.valorReceita
        : styles.valorDespesa;
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.descricao}>{item.descricao}</Text>
          <Text style={[styles.valor, valorStyle]}>
            {item.tipo === 'receita' ? '+' : '-'} R$ {item.valor.toFixed(2)}
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.editButton} onPress={() => handleAlterarTransacao(item)}>
            <Text style={styles.editText}>Alterar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={() => handleExcluirTransacao(item.id)}>
            <Text style={styles.deleteText}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Histórico de Transações</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 40 }} />
      ) : transacoes.length === 0 ? (
        <Text style={styles.noTransactions}>Nenhuma transação disponível.</Text>
      ) : (
        <FlatList
          data={transacoes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
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
    fontSize: 26,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  noTransactions: {
    color: '#ccc',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 18,
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#2C2C2C',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    // Sombras para profundidade
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    alignItems: 'center',
  },
  descricao: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    flex: 1,
  },
  valor: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  valorReceita: {
    color: '#4CAF50',
  },
  valorDespesa: {
    color: '#FF5252',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  editButton: {
    backgroundColor: '#FFA500',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  editText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: '#FF3333',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  deleteText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
