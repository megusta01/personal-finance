import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { carregarTransacoes } from '../services/storage';
import { getCotacaoDolar } from '../services/api';
import { Transacao } from '@/types/Transacao';
import { LineChart } from 'react-native-chart-kit';

export default function Dashboard() {
  const [cotacaoDolar, setCotacaoDolar] = useState<number | null>(null);
  const [saldo, setSaldo] = useState<number>(0);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);

  useEffect(() => {
    async function fetchData() {
      // Busca a cotação do dólar
      const dolar = await getCotacaoDolar();
      setCotacaoDolar(dolar);

      // Carrega as transações salvas
      const dadosTransacoes = await carregarTransacoes();
      setTransacoes(dadosTransacoes);

      // Calcula o saldo atual
      const saldoAtual = dadosTransacoes.reduce(
        (acc, item) => acc + (item.tipo === 'receita' ? item.valor : -item.valor),
        0
      );
      setSaldo(saldoAtual);
    }
    fetchData();
  }, []);

  // Utiliza useMemo para calcular os dados do gráfico apenas quando as transações mudarem
  const { dataReceitas, dataDespesas, dataLabels } = useMemo(() => {
    let acumuladoReceita = 0;
    let acumuladoDespesa = 0;
    const receitasCalc: number[] = [];
    const despesasCalc: number[] = [];
    const labelsCalc: string[] = [];

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

  // Configuração dos dados para o gráfico
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
    legend: ['Receitas', 'Despesas'],
  };

  // Define a largura do gráfico conforme a tela
  const screenWidth = Dimensions.get('window').width - 32;

  return (
    <View style={styles.container}>
      {/* Card do Saldo */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Balance</Text>
        <Text style={styles.balanceValue}>
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldo)}
        </Text>
      </View>

      {/* Card do Gráfico */}
      {/* <View style={styles.card}>
        <Text style={styles.cardTitle}>Income/Expense Trends</Text>
        {dataLabels.length > 0 ? (
          <LineChart
            data={chartData}
            width={screenWidth}
            height={220}
            chartConfig={{
              backgroundColor: '#333',
              backgroundGradientFrom: '#333',
              backgroundGradientTo: '#333',
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
          <Text style={styles.chartMessage}>
            Sem dados suficientes para gerar o gráfico.
          </Text>
        )}
      </View> */}

      {/* Card da Cotação */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dollar Exchange Rate</Text>
        {cotacaoDolar ? (
          <Text style={styles.balanceValue}>
            1 USD = {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cotacaoDolar)}
          </Text>
        ) : (
          <ActivityIndicator size="large" color="#0000ff" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#222',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    width: '90%',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  balanceValue: {
    fontSize: 24,
    color: '#4caf50',
    fontWeight: 'bold',
  },
  chartStyle: {
    marginVertical: 8,
    borderRadius: 8,
  },
  // Estilo separado para a mensagem caso não haja dados
  chartMessage: {
    color: '#fff',
    marginTop: 16,
  },
});
