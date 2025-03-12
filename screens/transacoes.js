import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { salvarTransacao, atualizarTransacao } from '../services/storage';

export default function Transacoes({ route, navigation }) {
 
  const transacaoEditando = route.params?.transacaoEditando;
  const isEdit = transacaoEditando;

  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState('receita');

  useEffect(() => {
    if (isEdit) {
      setDescricao(transacaoEditando.descricao);
      setValor(String(transacaoEditando.valor));
      setTipo(transacaoEditando.tipo);
    } else {
      setDescricao('');
      setValor('');
      setTipo('receita');
    }
  
    const unsubscribe = navigation.addListener('focus', () => {
      navigation.setParams({ transacaoEditando: null });
    });
  
    return unsubscribe;
  }, [navigation, isEdit, transacaoEditando]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      
      navigation.setParams({ transacao: null });
    });
    return unsubscribe;
  }, [navigation]);

  const handleSalvar = async () => {
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
      if (isEdit) {
        await atualizarTransacao(transacaoEditando.id, descricao.trim(), valorNumerico, tipo);
        Alert.alert('Sucesso', 'Transação atualizada!');
      } else {
        await salvarTransacao(descricao.trim(), valorNumerico, tipo);
        Alert.alert('Sucesso', 'Transação adicionada!');
      }

      setDescricao('');
      setValor('');
      setTipo('receita');

      navigation.setParams({ transacao: null });
      navigation.navigate('Histórico');
    } catch (error) {
      console.error('Erro ao salvar transação:', error);
      Alert.alert('Erro', 'Não foi possível salvar a transação.');
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>TRANSAÇÕES</Text>
          <Text style={styles.headerSubtitle}>
            {isEdit ? 'Editar Transação' : 'Nova Transação'}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Valor</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite o valor"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={valor}
            onChangeText={setValor}
          />

          <Text style={styles.label}>Descrição</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite a descrição"
            placeholderTextColor="#999"
            value={descricao}
            onChangeText={setDescricao}
          />

          <Text style={styles.label}>Tipo de Transação</Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setTipo('receita')}
            >
              <View style={styles.radioCircle}>
                {tipo === 'receita' && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>Receita</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setTipo('despesa')}
            >
              <View style={styles.radioCircle}>
                {tipo === 'despesa' && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>Despesa</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSalvar}>
          <Text style={styles.saveButtonText}>
            {isEdit ? 'Atualizar Transação' : 'Salvar Transação'}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1C',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  header: {
    
    alignItems: 'center',
    marginBottom: 30,
  },
  headerTitle: {
    marginTop: 40,
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#ccc',
    fontSize: 18,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#2C2C2C',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#3A3A3A',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    marginBottom: 20,
    fontSize: 16,
  },
  radioGroup: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFF',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF',
  },
  radioLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#FF9E2C',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  saveButtonText: {
    color: '#1C1C1C',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
