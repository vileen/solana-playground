import pkg from 'pg';
const { Client } = pkg;

async function testConnection() {
  const client = new Client({
    host: 'dpg-d0lmlc2dbo4c73aq3ld0-a.frankfurt-postgres.render.com',
    port: 5432,
    database: 'snapshot_tool_db',
    user: 'snapshot_tool_db_user',
    password: 'qo5lKA3jF4wRiN3B4hsgeW6CL7Jpfgcm',
    ssl: {
      rejectUnauthorized: false // Required for Render PostgreSQL
    }
  });
  
  try {
    console.log('Connecting to PostgreSQL...');
    await client.connect();
    console.log('Connected successfully!');
    
    const result = await client.query('SELECT NOW() as current_time');
    console.log('Query result:', result.rows[0]);
    
    await client.end();
    console.log('Connection closed.');
  } catch (error) {
    console.error('Error connecting to PostgreSQL:', error);
  }
}

testConnection(); 