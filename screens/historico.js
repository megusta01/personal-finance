import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput
} from 'react-native';
import { carregarTransacoes, excluirTransacao, atualizarTransacao } from '../services/storage';
import { useFocusEffect } from '@react-navigation/native';

export default function Historico({ navigation }) {
  const [transacoes, setTransacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [transacaoEditando, setTransacaoEditando] = useState(null);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState('receita');

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

  const abrirModalEdicao = (transacao) => {
    setTransacaoEditando(transacao);
    setDescricao(transacao.descricao);
    setValor(String(transacao.valor));
    setTipo(transacao.tipo);
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

      setTransacoes((prev) =>
        prev.map((t) =>
          t.id === transacaoEditando.id
            ? { ...t, descricao, valor: valorNumerico, tipo }
            : t
        )
      );

      setModalVisible(false);
      setTransacaoEditando(null);
      setDescricao('');
      setValor('');
      setTipo('receita');
    } catch (error) {
      console.error('Erro ao atualizar transação:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a transação.');
    }
  };

  const renderItem = ({ item }) => {
    const valorStyle = item.tipo === 'receita' ? styles.valorReceita : styles.valorDespesa;
  
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.descricao}>{item.descricao}</Text>
          <Text style={[styles.valor, valorStyle]}>
            {item.tipo === 'receita' ? '+' : '-'} R$ {item.valor.toFixed(2)}
          </Text>
        </View>
        <View style={styles.actionContainer}>
          <TouchableOpacity style={styles.editButton} onPress={() => abrirModalEdicao(item)}>
            <Text style={styles.editText}>Alterar</Text>
          </TouchableOpacity>
  
          <Text style={styles.dataHora}>{item.data}</Text>
  
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
        <ActivityIndicator size="large" color="#fff" style={{ marginTop: 50 }} />
      ) : transacoes.length === 0 ? (
        <Text style={styles.noTransactions}></Text>
      ) : (
        <FlatList
          data={transacoes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
 
     <Modal visible={modalVisible} transparent animationType="slide">
  <View style={styles.modalContainer}>
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>Editar Transação</Text>

      <TextInput
        style={styles.modalInput}
        placeholder="Valor"
        placeholderTextColor="#999"
        keyboardType="numeric"
        value={valor}
        onChangeText={(text) => setValor(text.replace(',', '.'))}
      />

      <TextInput
        style={styles.modalInput}
        placeholder="Descrição"
        placeholderTextColor="#999"
        value={descricao}
        onChangeText={setDescricao}
      />

      <View style={styles.modalButtonContainer}>
        <TouchableOpacity style={styles.saveButton} onPress={salvarEdicao}>
          <Text style={styles.modalButtonText}>Salvar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.closeButton} onPress={() => setModalVisible(false)}>
          <Text style={styles.modalButtonText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>
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


  card: {
    backgroundColor: '#2C2C2C', 
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5, 
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'center',
  },


  descricao: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
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


  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', 
    marginTop: 10,
  },

  dataHora: {
    fontSize: 14,
    color: '#BBB',
    textAlign: 'center',
    flex: 1, 
  },

  editButton: {
    backgroundColor: '#FFA500',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: '#FF3333',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)', 
  },

  modalContent: {
    backgroundColor: '#292929',
    padding: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16, 
    textAlign: 'center',
  },

  modalInput: {
    backgroundColor: '#3A3A3A',
    color: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 6,
    width: '100%',
    marginBottom: 14, 
    fontSize: 16, 
    textAlign: 'center',
  },

  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },

  saveButton: {
    backgroundColor: '#3498DB',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 8, 
  },

  closeButton: {
    backgroundColor: '#FF5252',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginLeft: 8,
  },

  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }, modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },

  modalContent: {
    backgroundColor: '#292929',
    padding: 24, 
    borderRadius: 12,
    width: '90%', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },

  modalInput: {
    backgroundColor: '#3A3A3A',
    color: '#fff',
    paddingVertical: 14, 
    paddingHorizontal: 14,
    borderRadius: 6,
    width: '100%',
    marginBottom: 14, 
    fontSize: 16, 
    textAlign: 'center', 
  },

  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20, 
  },

  saveButton: {
    backgroundColor: '#3498DB',
    paddingVertical: 14, 
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 8, 
  },

  closeButton: {
    backgroundColor: '#FF5252',
    paddingVertical: 14, 
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginLeft: 8, 
  },

  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

