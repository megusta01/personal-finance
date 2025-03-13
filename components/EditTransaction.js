// components/EditTransactionModal.js
import React from 'react';
import { View, Modal, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

const EditTransactionModal = ({
    visible,
    descricao,
    valor,
    onChangeDescricao,
    onChangeValor,
    onSave,
    onClose
}) => {
    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Editar Transação</Text>
                    <TextInput
                        style={styles.modalInput}
                        placeholder="Valor"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        value={valor}
                        onChangeText={(text) => onChangeValor(text.replace(',', '.'))}
                    />
                    <TextInput
                        style={styles.modalInput}
                        placeholder="Descrição"
                        placeholderTextColor="#999"
                        value={descricao}
                        onChangeText={onChangeDescricao}
                    />
                    <View style={styles.modalButtonContainer}>
                        <TouchableOpacity style={styles.saveButton} onPress={onSave}>
                            <Text style={styles.modalButtonText}>Salvar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <Text style={styles.modalButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
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

export default EditTransactionModal;
