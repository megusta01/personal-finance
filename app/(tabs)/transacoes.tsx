import React, { useState } from 'react';
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
import { salvarTransacao } from '../services/storage';
import { Transacao } from '../../types/Transacao';
import { v4 as uuidv4 } from 'uuid';

export default function Transacoes() {
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('receita');

  const handleSalvar = async () => {
    console.log('handleSalvar acionado');
    if (!descricao.trim() || !valor.trim()) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    const valorNumerico = parseFloat(valor);
    if (isNaN(valorNumerico)) {
      Alert.alert('Erro', 'Valor inválido');
      return;
    }

    const novaTransacao: Transacao = {
      id: uuidv4(),
      descricao: descricao.trim(),
      valor: valorNumerico,
      tipo,
      data: new Date().toISOString(),
    };

    console.log('Transação a salvar:', novaTransacao);

    try {
      await salvarTransacao(novaTransacao);
      console.log('Transação salva com sucesso');
      Alert.alert('Sucesso', 'Transação adicionada!');
      setDescricao('');
      setValor('');
      setTipo('receita');
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
        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>FinanceTracker</Text>
          <Text style={styles.headerSubtitle}>Nova Transação</Text>
        </View>

        {/* Card central */}
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
            {/* Radio para receita */}
            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => setTipo('receita')}
            >
              <View style={styles.radioCircle}>
                {tipo === 'receita' && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>Receita</Text>
            </TouchableOpacity>

            {/* Radio para despesa */}
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

        {/* Botão de salvar */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSalvar}>
          <Text style={styles.saveButtonText}>Salvar Transação</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#ccc',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#2C2C2C',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#3A3A3A',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    marginBottom: 16,
  },
  radioGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    marginRight: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  radioLabel: {
    color: '#fff',
    fontSize: 14,
  },
  saveButton: {
    backgroundColor: '#FF9E2C',
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#1C1C1C',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
