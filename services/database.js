import * as SQLite from 'expo-sqlite';

let db;

// Função para abrir o banco de dados de forma assíncrona
export async function openDatabase() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('finance.db');
  }
  return db;
}

// Criar a tabela se não existir
export async function initializeDatabase() {
    const db = await openDatabase();
    // await db.execAsync(`DROP TABLE IF EXISTS transacoes;`);

    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS transacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        descricao TEXT NOT NULL, 
        valor REAL NOT NULL, 
        tipo TEXT NOT NULL, 
        data TEXT NOT NULL
      );
    `);
    console.log('Banco de dados inicializado com sucesso!');
  }
