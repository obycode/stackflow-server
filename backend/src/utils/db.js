const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createTables() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Create `channels` table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id SERIAL PRIMARY KEY,
        token TEXT,
        principal_1 TEXT NOT NULL,
        principal_2 TEXT NOT NULL,
        balance_1 TEXT DEFAULT '0',
        balance_2 TEXT DEFAULT '0',
        nonce TEXT DEFAULT '0',
        expires_at TEXT,
        state TEXT DEFAULT 'open'
      );
    `);

    // Create `signatures` table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS signatures (
        id SERIAL PRIMARY KEY,
        channel INTEGER REFERENCES channels(id),
        balance_1 TEXT,
        balance_2 TEXT,
        nonce TEXT,
        action BIGINT,
        actor TEXT,
        secret TEXT,
        owner_signature TEXT,
        other_signature TEXT
      );
    `);

    await client.query("COMMIT");
    console.log("Tables created successfully or already exist.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating tables:", error.message);
  } finally {
    client.release();
  }
}

createTables()
  .then(() => console.log("Database setup complete."))
  .catch((err) => console.error("Error during database setup:", err.message));

module.exports = pool;
