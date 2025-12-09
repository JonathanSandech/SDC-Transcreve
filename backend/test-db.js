// Script de teste do banco de dados
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testDatabase() {
  try {
    console.log('🔍 Testando conexão com o banco de dados...');

    // Teste 1: Conexão básica
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Conexão OK:', result.rows[0].now);

    // Teste 2: Verificar se a tabela existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'transcriptions'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ ERRO: Tabela "transcriptions" não existe!');
      console.log('\n📋 Execute o seguinte SQL para criar a tabela:');
      console.log(`
CREATE TABLE transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) NOT NULL,
  original_size BIGINT NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  audio_path VARCHAR(500),
  model_size VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  transcription_text TEXT,
  processing_time_seconds INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_transcriptions_status ON transcriptions(status);
CREATE INDEX idx_transcriptions_created_at ON transcriptions(created_at);
CREATE INDEX idx_transcriptions_expires_at ON transcriptions(expires_at);
      `);
      process.exit(1);
    }

    console.log('✅ Tabela "transcriptions" existe');

    // Teste 3: Verificar estrutura da tabela
    const columns = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'transcriptions'
      ORDER BY ordinal_position;
    `);

    console.log('\n📊 Estrutura da tabela:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.column_default ? ' (default: ' + col.column_default + ')' : ''}`);
    });

    // Teste 4: Testar insert
    console.log('\n🧪 Testando INSERT...');
    const insertTest = await pool.query(`
      INSERT INTO transcriptions (filename, original_size, file_path, model_size, status)
      VALUES ('test.mp4', 1000, '/tmp/test.mp4', 'tiny', 'pending')
      RETURNING id
    `);

    const testId = insertTest.rows[0].id;
    console.log('✅ INSERT funcionou! ID gerado:', testId);

    // Limpar teste
    await pool.query('DELETE FROM transcriptions WHERE id = $1', [testId]);
    console.log('✅ Limpeza concluída');

    console.log('\n✅ TODOS OS TESTES PASSARAM!');
    console.log('O banco de dados está funcionando corretamente.');

  } catch (error) {
    console.error('❌ ERRO:', error.message);
    console.error('\nDetalhes:', error);
  } finally {
    await pool.end();
  }
}

testDatabase();
