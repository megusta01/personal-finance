import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const TransactionItem = ({ item, onEdit, onDelete }) => {
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
                <TouchableOpacity style={styles.editButton} onPress={() => onEdit(item)}>
                    <Text style={styles.editText}>Alterar</Text>
                </TouchableOpacity>
                <Text style={styles.dataHora}>{item.data}</Text>
                <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(item.id)}>
                    <Text style={styles.deleteText}>Excluir</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
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
});

export default TransactionItem;
