const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT,
        event_time TEXT,
        cruise_start_time TEXT,
        meeting_point TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS waypoints (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        latitude DECIMAL NOT NULL,
        longitude DECIMAL NOT NULL,
        order_index INTEGER NOT NULL,
        notes TEXT
      )
    `);

    await pool.query(`
      ALTER TABLE waypoints ADD COLUMN IF NOT EXISTS notes TEXT
    `);
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

initializeDatabase();

module.exports = pool;
