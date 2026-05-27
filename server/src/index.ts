const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Initialize SQLite database
const db = new sqlite3.Database('./leaderboard.db');

// Create scores table if it doesn't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet TEXT UNIQUE,
    name TEXT,
    score INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Create index for faster queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_score ON scores(score ASC)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_wallet ON scores(wallet)`);
});

// Get top scores 
// 'LIMIT 10' to get the top 10 scores

app.get('/get-scores', async (req: any, res: any) => {
  try {
    db.all(
      `SELECT id, wallet, name, score, timestamp 
       FROM scores 
       ORDER BY score ASC
       LIMIT 10`,
      [],
      (err: any, rows: any) => {
        if (err) {
          console.error('Error fetching scores:', err);
          return res.status(500).json({
            valid: false,
            error: 'Failed to fetch scores'
          });
        }

        const scores = rows.map((row: any) => ({
          id: row.id,
          wallet: row.wallet,
          name: row.name,
          score: row.score,
          timestamp: row.timestamp
        }));

        return res.status(200).json({
          valid: true,
          topTen: scores
        });
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      valid: false,
      error: 'Failed to fetch scores'
    });
  }
});

// Publish a new score 
app.post('/publish-score', async (req: any, res: any) => {
  try {
    const { id, name, score, wallet } = req.body;

    if (!id || !name || score === undefined || !wallet) {
      return res.status(400).json({
        valid: false,
        error: 'Missing required fields: id, name, score, wallet'
      });
    }

    // Check if user already has a score
    db.get(
      `SELECT score FROM scores WHERE wallet = ?`,
      [wallet],
      (err: any, row: any) => {
        if (err) {
          console.error('Error checking existing score:', err);
          return res.status(500).json({
            valid: false,
            error: 'Failed to check existing score'
          });
        }

        if (row) {
          // User exists, only update if new score is lower
          if (score < row.score) {
            db.run(
              `UPDATE scores SET name = ?, score = ?, timestamp = CURRENT_TIMESTAMP WHERE wallet = ?`,
              [name, score, wallet],
              (err: any) => {
                if (err) {
                  console.error('Error updating score:', err);
                  return res.status(500).json({
                    valid: false,
                    error: 'Failed to update score'
                  });
                }
                return res.status(200).json({
                  valid: true,
                  message: 'Score updated successfully'
                });
              }
            );
          } else {
            return res.status(200).json({
              valid: true,
              message: 'Score not updated (new score is not lower)'
            });
          }
        } else {
        
          db.run(
            `INSERT INTO scores (wallet, name, score) VALUES (?, ?, ?)`,
            [wallet, name, score],
            (err: any) => {
              if (err) {
                console.error('Error inserting score:', err);
                return res.status(500).json({
                  valid: false,
                  error: 'Failed to insert score'
                });
              }
              return res.status(200).json({
                valid: true,
                message: 'Score published successfully'
              });
            }
          );
        }
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      valid: false,
      error: 'Failed to publish score'
    });
  }
});


app.get('/user-score/:wallet', async (req: any, res: any) => {
  try {
    const { wallet } = req.params;
    
    db.get(
      `SELECT wallet, name, score, timestamp FROM scores WHERE wallet = ?`,
      [wallet],
      (err: any, row: any) => {
        if (err) {
          console.error('Error fetching user score:', err);
          return res.status(500).json({
            valid: false,
            error: 'Failed to fetch user score'
          });
        }

        if (!row) {
          return res.status(200).json({
            valid: true,
            score: null
          });
        }

        return res.status(200).json({
          valid: true,
          score: {
            wallet: row.wallet,
            name: row.name,
            score: row.score,
            timestamp: row.timestamp
          }
        });
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      valid: false,
      error: 'Failed to fetch user score'
    });
  }
});


app.get('/health', (req: any, res: any) => {
  res.status(200).json({ status: 'OK', message: 'Leaderboard server is running' });
});


const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`🚀 Leaderboard server running on port ${PORT}`);
  console.log(`📊 Database: leaderboard.db`);
  console.log(`🌐 Health check: http://0.0.0.0:${PORT}/health`);
});


process.on('SIGINT', () => {
  console.log('\n Shutting down server...');
  db.close((err: any) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('✅ Database connection closed');
    }
    process.exit(0);
  });
});
