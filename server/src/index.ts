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

  // Winners Circle: past winners table
  db.run(`CREATE TABLE IF NOT EXISTS winners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet TEXT NOT NULL,
    name TEXT NOT NULL,
    score REAL NOT NULL,
    week TEXT NOT NULL,
    prize_name TEXT,
    prize_image_url TEXT,
    won_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Current prize table (always 1 row, id=1)
  db.run(`CREATE TABLE IF NOT EXISTS current_prize (
    id INTEGER PRIMARY KEY,
    prize_name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    week_label TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seed an empty current prize row if none exists
  db.run(`INSERT OR IGNORE INTO current_prize (id, prize_name, image_url, week_label)
    VALUES (1, 'TBD', '', '')`);
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

app.delete('/reset-scores', (req: any, res: any) => {
  db.run(`DELETE FROM scores`, [], (err: any) => {
    if (err) {
      console.error('Error resetting scores:', err);
      return res.status(500).json({ valid: false, error: 'Failed to reset scores' });
    }
    console.log('Scores reset successfully');
    return res.status(200).json({ valid: true, message: 'Scores reset successfully' });
  });
});

// ── Winners Circle endpoints ──────────────────────────────────────────────────

// GET /winners — returns up to 50 past winners, newest first
app.get('/winners', (req: any, res: any) => {
  db.all(
    `SELECT id, wallet, name, score, week, prize_name, prize_image_url, won_at
     FROM winners
     ORDER BY won_at DESC
     LIMIT 50`,
    [],
    (err: any, rows: any) => {
      if (err) {
        console.error('Error fetching winners:', err);
        return res.status(500).json({ valid: false, error: 'Failed to fetch winners' });
      }
      return res.status(200).json({ valid: true, winners: rows });
    }
  );
});

// GET /current-prize — returns the current week's prize
app.get('/current-prize', (req: any, res: any) => {
  db.get(
    `SELECT prize_name, image_url, week_label, updated_at FROM current_prize WHERE id = 1`,
    [],
    (err: any, row: any) => {
      if (err) {
        console.error('Error fetching current prize:', err);
        return res.status(500).json({ valid: false, error: 'Failed to fetch current prize' });
      }
      return res.status(200).json({ valid: true, prize: row || null });
    }
  );
});

// POST /set-prize — admin sets the current prize
// Body: { prize_name, image_url, week_label, admin_key }
app.post('/set-prize', (req: any, res: any) => {
  const { prize_name, image_url, week_label, admin_key } = req.body;
  const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';
  if (admin_key !== ADMIN_KEY) {
    return res.status(403).json({ valid: false, error: 'Unauthorized' });
  }
  if (!prize_name || !week_label) {
    return res.status(400).json({ valid: false, error: 'Missing prize_name or week_label' });
  }
  db.run(
    `UPDATE current_prize SET prize_name = ?, image_url = ?, week_label = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
    [prize_name, image_url || '', week_label],
    (err: any) => {
      if (err) {
        console.error('Error setting prize:', err);
        return res.status(500).json({ valid: false, error: 'Failed to set prize' });
      }
      return res.status(200).json({ valid: true, message: 'Prize updated' });
    }
  );
});

// POST /add-winner — admin records a weekly winner
// Body: { wallet, name, score, week, prize_name, prize_image_url, admin_key }
app.post('/add-winner', (req: any, res: any) => {
  const { wallet, name, score, week, prize_name, prize_image_url, admin_key } = req.body;
  const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';
  if (admin_key !== ADMIN_KEY) {
    return res.status(403).json({ valid: false, error: 'Unauthorized' });
  }
  if (!wallet || !name || score === undefined || !week) {
    return res.status(400).json({ valid: false, error: 'Missing required fields: wallet, name, score, week' });
  }
  db.run(
    `INSERT INTO winners (wallet, name, score, week, prize_name, prize_image_url) VALUES (?, ?, ?, ?, ?, ?)`,
    [wallet, name, score, week, prize_name || null, prize_image_url || null],
    (err: any) => {
      if (err) {
        console.error('Error adding winner:', err);
        return res.status(500).json({ valid: false, error: 'Failed to add winner' });
      }
      return res.status(200).json({ valid: true, message: 'Winner recorded' });
    }
  );
});

// ── End Winners Circle endpoints ──────────────────────────────────────────────

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
