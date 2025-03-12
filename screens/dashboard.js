import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions, ScrollView } from 'react-native';
import { carregarTransacoes } from '../services/storage';
import { getCotacaoDolar } from '../services/api';
import { LineChart } from 'react-native-chart-kit';
import { useFocusEffect } from '@react-navigation/native';

export default function Dashboard() {
  const [cotacaoDolar, setCotacaoDolar] = useState(null);
  const [saldo, setSaldo] = useState(0);
  const [transacoes, setTransacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      async function fetchData() {
        try {
          setLoading(true);

          const cotacao = await getCotacaoDolar();
          setCotacaoDolar(cotacao);
          const dadosTransacoes = await carregarTransacoes();
          setTransacoes(dadosTransacoes);

          const saldoAtual = dadosTransacoes.reduce(
            (acc, item) => acc + (item.tipo === 'receita' ? item.valor : -item.valor),
            0
          );
          setSaldo(saldoAtual);
        } catch (error) {
          console.error('Erro ao carregar transações:', error);
        } finally {
          setLoading(false);
        }
      }
      fetchData();
    }, [])
  );

  const { dataReceitas, dataDespesas, dataLabels } = useMemo(() => {
    let acumuladoReceita = 0;
    let acumuladoDespesa = 0;
    const receitasCalc = [];
    const despesasCalc = [];
    const labelsCalc = [];

    transacoes.forEach((t, idx) => {
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
        color: (opacity = 1) => `rgba(255, 165, 0, ${opacity})`, // Laranja
        strokeWidth: 2,
      },
      {
        data: dataDespesas,
        color: (opacity = 1) => `rgba(30, 144, 255, ${opacity})`, // Azul
        strokeWidth: 2,
      },
    ],
    legend: ['Receita', 'Despesa'],
  };

  const screenWidth = Dimensions.get('window').width - 32;

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Saldo</Text>
          <Text style={styles.balanceValue}>
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldo)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Gráfico de Transações</Text>
          {dataLabels.length > 0 ? (
            <LineChart
              data={chartData}
              width={screenWidth}
              height={220}
              chartConfig={{
                backgroundColor: '#222',
                backgroundGradientFrom: '#222',
                backgroundGradientTo: '#222',
                color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                propsForDots: {
                  r: '3',
                  strokeWidth: '2',
                  stroke: '#ffa726',
                },
              }}
              bezier
              style={styles.chartStyle}
            />
          ) : (
            <Text style={styles.chartMessage}>Sem dados suficientes para gerar o gráfico.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cotação do Dólar</Text>
          {cotacaoDolar ? (
            <Text style={styles.balanceValue}>
              1 USD = {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cotacaoDolar)}
            </Text>
          ) : (
            <ActivityIndicator size="large" color="#00aced" />
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#1E1E1E',
    padding: 16,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#292929',
    borderRadius: 12,
    padding: 20,
    marginVertical: 10,
    width: '100%',
    alignItems: 'center',
    // Sombra para iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    // Elevação para Android
    elevation: 5,
  },
  cardTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 12,
  },
  balanceValue: {
    fontSize: 26,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  chartStyle: {
    marginVertical: 8,
    borderRadius: 12,
  },
  chartMessage: {
    color: '#CCCCCC',
    marginTop: 16,
    fontSize: 16,
  },
});
