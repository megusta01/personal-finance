// Dashboard.js
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { carregarTransacoes } from '../services/storage';
import { getCotacoes } from '../services/api';
import { useFocusEffect } from '@react-navigation/native';
import BalanceCard from '../components/BalanceCard';
import TransactionsChart from '../components/TransactionsChart';
import CurrencyCarousel from '../components/CurrencyCarousel';

export default function Dashboard() {
  const [cotacoes, setCotacoes] = useState(null);
  const [saldo, setSaldo] = useState(0);
  const [transacoes, setTransacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let interval;

      async function fetchData() {
        try {
          setLoading(true);
          const dadosCotacoes = await getCotacoes();
          setCotacoes(dadosCotacoes);

          const dadosTransacoes = await carregarTransacoes();
          setTransacoes(dadosTransacoes);

          const saldoAtual = dadosTransacoes.reduce(
            (acc, item) => acc + (item.tipo === 'receita' ? item.valor : -item.valor),
            0
          );
          setSaldo(saldoAtual);
        } catch (error) {
          console.error('Erro ao carregar dados:', error);
        } finally {
          setLoading(false);
        }
      }

      fetchData();
      interval = setInterval(fetchData, 1800000);

      return () => clearInterval(interval);
    }, [])
  );

  const { dataReceitas, dataDespesas, dataLabels } = useMemo(() => {
    let acumuladoReceita = 0;
    let acumuladoDespesa = 0;
    const receitasCalc = [];
    const despesasCalc = [];
    const labelsCalc = [];

    const transacoesOrdenadas = [...transacoes].reverse();

    transacoesOrdenadas.forEach((t, idx) => {
      if (t.tipo === 'receita') {
        acumuladoReceita += t.valor;
      } else {
        acumuladoDespesa += t.valor;
      }
      receitasCalc.push(acumuladoReceita);
      despesasCalc.push(acumuladoDespesa);
      labelsCalc.push(`T${idx + 1}`);
    });

    return { dataReceitas: receitasCalc, dataDespesas: despesasCalc, dataLabels: labelsCalc };
  }, [transacoes]);

  const chartData = {
    labels: dataLabels,
    datasets: [
      {
        data: dataReceitas,
        color: (opacity = 1) => `rgba(255, 165, 0, ${opacity})`,
        strokeWidth: 2,
      },
      {
        data: dataDespesas,
        color: (opacity = 1) => `rgba(30, 144, 255, ${opacity})`,
        strokeWidth: 2,
      },
    ],
    legend: ['Receita', 'Despesa'],
  };

  const screenWidth = Dimensions.get('window').width - 32;

  const moedas = [
    { nome: 'Dólar', sigla: 'USD', valor: cotacoes?.usd, simbolo: '💵' },
    { nome: 'Euro', sigla: 'EUR', valor: cotacoes?.eur, simbolo: '💶' },
    { nome: 'Libra', sigla: 'GBP', valor: cotacoes?.gbp, simbolo: '💷' },
    { nome: 'Bitcoin', sigla: 'BTC', valor: cotacoes?.btc, simbolo: '₿' },
  ];

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <BalanceCard saldo={saldo} />
        <TransactionsChart
          chartData={chartData}
          screenWidth={screenWidth}
          dataLabels={dataLabels}
        />
        <Text style={styles.sectionTitle}>Cotação das Moedas</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#00aced" />
        ) : (
          <CurrencyCarousel moedas={moedas} saldo={saldo} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#1E1E1E',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  container: {
    flex: 1,
    alignItems: 'center',
  },
  sectionTitle: {
    marginTop: 20,
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
});
