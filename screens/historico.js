import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { carregarTransacoes, excluirTransacao, atualizarTransacao } from '../services/storage';
import TransactionItem from '../components/TransactionItem';
import EditTransactionModal from '../components/EditTransaction';

export default function Historico() {
  const [transacoes, setTransacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [transacaoEditando, setTransacaoEditando] = useState(null);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [tipo] = useState('receita');

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
      setTransacoes(prev => prev.filter(t => t.id !== id));
      Alert.alert('Sucesso', 'Transação removida!');
    } catch (error) {
      console.error('Erro ao excluir transação:', error);
      Alert.alert('Erro', 'Não foi possível remover a transação.');
    }
  };

  const abrirModalEdicao = (transacao) => {
    setTransacaoEditando(transacao);
    setDescricao(transacao.descricao);
    setValor(String(transacao.valor));
    setModalVisible(true);
  };

  const salvarEdicao = async () => {
    if (!descricao.trim() || !valor.trim()) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    const valorNumerico = parseFloat(valor);
    if (isNaN(valorNumerico)) {
      Alert.alert('Erro', 'Valor inválido');
      return;
    }

    try {
      await atualizarTransacao(transacaoEditando.id, descricao, valorNumerico, tipo);
      Alert.alert('Sucesso', 'Transação atualizada!');
      setTransacoes(prev =>
        prev.map(t =>
          t.id === transacaoEditando.id
            ? { ...t, descricao, valor: valorNumerico, tipo }
            : t
        )
      );
      fecharModal();
    } catch (error) {
      console.error('Erro ao atualizar transação:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a transação.');
    }
  };

  const fecharModal = () => {
    setModalVisible(false);
    setTransacaoEditando(null);
    setDescricao('');
    setValor('');
  };

  const renderItem = ({ item }) => (
    <TransactionItem
      item={item}
      onEdit={abrirModalEdicao}
      onDelete={handleExcluirTransacao}
    />
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Histórico de Transações</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 50 }} />
      ) : transacoes.length === 0 ? (
        <Text style={styles.noTransactions}>Nenhuma transação encontrada.</Text>
      ) : (
        <FlatList
          data={transacoes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      <EditTransactionModal
        visible={modalVisible}
        descricao={descricao}
        valor={valor}
        onChangeDescricao={setDescricao}
        onChangeValor={setValor}
        onSave={salvarEdicao}
        onClose={fecharModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1C',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  title: {
    marginTop: 50,
    fontSize: 26,
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    textTransform: 'uppercase',
  },
  noTransactions: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  listContent: {
    paddingBottom: 20,
  },
});
