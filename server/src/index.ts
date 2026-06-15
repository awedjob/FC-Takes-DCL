const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const cron = require('node-cron');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.static(__dirname + '/../'));

// Initialize SQLite database. On Railway, DB_PATH points at the persistent
// volume mount (e.g. /data/leaderboard.db) — without it the file lives on the
// container's ephemeral disk and every redeploy wipes all data.
const DB_PATH = process.env.DB_PATH || './leaderboard.db';
const db = new sqlite3.Database(DB_PATH);

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

  // Prize catalog: remembers every prize name + image URL ever used so
  // recurring prizes can be re-selected in the admin panel
  db.run(`CREATE TABLE IF NOT EXISTS prize_catalog (
    prize_name TEXT PRIMARY KEY,
    image_url TEXT,
    last_used DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Upsert a prize into the catalog (called whenever a prize is set or a winner
// is recorded with a prize attached)
function rememberPrize(prizeName: string, imageUrl: string) {
  if (!prizeName || prizeName === 'TBD') return;
  db.run(
    `INSERT INTO prize_catalog (prize_name, image_url, last_used)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(prize_name) DO UPDATE SET
       image_url = CASE WHEN excluded.image_url != '' THEN excluded.image_url ELSE prize_catalog.image_url END,
       last_used = CURRENT_TIMESTAMP`,
    [prizeName, imageUrl || ''],
    (err: any) => {
      if (err) console.error('Error updating prize catalog:', err);
    }
  );
}

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
// Wallets whose scores are never recorded (game creator/admin accounts)
const EXEMPT_WALLETS = ['0xe1eedbd1e08478707c794e7e8b1ee623f5fa6d64'];

app.post('/publish-score', async (req: any, res: any) => {
  if (req.body && typeof req.body.wallet === 'string' &&
      EXEMPT_WALLETS.includes(req.body.wallet.toLowerCase())) {
    return res.status(200).json({ valid: true, message: 'Wallet exempt - score not recorded' });
  }
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
      rememberPrize(prize_name, image_url || '');
      return res.status(200).json({ valid: true, message: 'Prize updated' });
    }
  );
});

// GET /prize-catalog — all prizes ever used, most recently used first
app.get('/prize-catalog', (req: any, res: any) => {
  db.all(
    `SELECT prize_name, image_url, last_used FROM prize_catalog ORDER BY last_used DESC`,
    [],
    (err: any, rows: any) => {
      if (err) {
        console.error('Error fetching prize catalog:', err);
        return res.status(500).json({ valid: false, error: 'Failed to fetch prize catalog' });
      }
      return res.status(200).json({ valid: true, prizes: rows });
    }
  );
});

// POST /add-winner — admin records a weekly winner
// Body: { wallet, name, score, week, prize_name, prize_image_url, admin_key }
app.post('/add-winner', (req: any, res: any) => {
  const { wallet, name, score, week, prize_name, prize_image_url, won_at, admin_key } = req.body;
  const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';
  if (admin_key !== ADMIN_KEY) {
    return res.status(403).json({ valid: false, error: 'Unauthorized' });
  }
  if (!wallet || !name || score === undefined || !week) {
    return res.status(400).json({ valid: false, error: 'Missing required fields: wallet, name, score, week' });
  }
  // Optional won_at lets past contests be backdated so /winners (ordered by
  // won_at DESC) places them chronologically instead of by insertion time
  if (won_at && isNaN(Date.parse(won_at))) {
    return res.status(400).json({ valid: false, error: 'won_at must be a valid date, e.g. 2025-08-15 12:00:00' });
  }
  db.run(
    `INSERT INTO winners (wallet, name, score, week, prize_name, prize_image_url, won_at)
     VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
    [wallet, name, score, week, prize_name || null, prize_image_url || null, won_at || null],
    (err: any) => {
      if (err) {
        console.error('Error adding winner:', err);
        return res.status(500).json({ valid: false, error: 'Failed to add winner' });
      }
      if (prize_name) rememberPrize(prize_name, prize_image_url || '');
      return res.status(200).json({ valid: true, message: 'Winner recorded' });
    }
  );
});

// POST /delete-score — admin tool to remove a player's leaderboard score(s)
app.post('/delete-score', (req: any, res: any) => {
  const { wallet, admin_key } = req.body;
  const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';
  if (admin_key !== ADMIN_KEY) {
    return res.status(403).json({ valid: false, error: 'Unauthorized' });
  }
  if (!wallet) {
    return res.status(400).json({ valid: false, error: 'Missing required field: wallet' });
  }
  db.run(
    `DELETE FROM scores WHERE LOWER(wallet) = LOWER(?)`,
    [wallet],
    function (this: any, err: any) {
      if (err) {
        console.error('Error deleting score:', err);
        return res.status(500).json({ valid: false, error: 'Failed to delete score' });
      }
      return res.status(200).json({ valid: true, message: `Deleted ${this.changes} row(s)` });
    }
  );
});

// POST /delete-winner — admin tool to remove a winner row (e.g. to fix a bad entry)
app.post('/delete-winner', (req: any, res: any) => {
  const { wallet, week, admin_key } = req.body;
  const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';
  if (admin_key !== ADMIN_KEY) {
    return res.status(403).json({ valid: false, error: 'Unauthorized' });
  }
  if (!wallet || !week) {
    return res.status(400).json({ valid: false, error: 'Missing required fields: wallet, week' });
  }
  db.run(
    `DELETE FROM winners WHERE wallet = ? AND week = ?`,
    [wallet, week],
    function (this: any, err: any) {
      if (err) {
        console.error('Error deleting winner:', err);
        return res.status(500).json({ valid: false, error: 'Failed to delete winner' });
      }
      return res.status(200).json({ valid: true, message: `Deleted ${this.changes} row(s)` });
    }
  );
});

// ── End Winners Circle endpoints ──────────────────────────────────────────────

// ── Weekly Winner Automation ──────────────────────────────────────────────────

// Helper: Get ISO week number from date
function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const year = d.getUTCFullYear();
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// The actual finalization logic — separate from HTTP so cron can call it directly
// week can be null (use current week) or an ISO week string like "2026-W24"
function finalizeWeeklyWinner(callback: (err: string | null, result?: any) => void, weekOverride?: string) {
  const targetWeek = weekOverride || getISOWeek(new Date());
  console.log(`⏰ Finalizing week: ${targetWeek}`);

  // Get all past winners to exclude them
  db.all(`SELECT wallet FROM winners`, [], (err: any, pastWinners: any) => {
    if (err) {
      console.error('Error fetching past winners:', err);
      return callback('Failed to fetch past winners');
    }

    const excludedWallets = pastWinners.map((w: any) => w.wallet);

    // Get all scores from the target week, ordered by score (lowest = best), excluding past winners
    const placeholders = excludedWallets.length > 0 ? excludedWallets.map(() => '?').join(',') : "'nonexistent'";
    const query = `
      SELECT wallet, name, score, timestamp
      FROM scores
      WHERE strftime('%G-W%V', timestamp) = ?
        AND wallet NOT IN (${placeholders})
      ORDER BY score ASC
      LIMIT 1
    `;

    db.get(query, [targetWeek, ...excludedWallets], (err: any, topScore: any) => {
      if (err) {
        console.error('Error fetching top scorer:', err);
        return callback('Failed to fetch scores');
      }

      if (!topScore) {
        console.log(`❌ No eligible winner found for week ${targetWeek}`);
        return callback(null, { message: `No eligible winner for week ${targetWeek}` });
      }

      // Get current prize
      db.get(`SELECT prize_name, image_url FROM current_prize WHERE id = 1`, [], (err: any, prize: any) => {
        if (err) {
          console.error('Error fetching current prize:', err);
          return callback('Failed to fetch prize');
        }

        // Record the winner
        db.run(
          `INSERT INTO winners (wallet, name, score, week, prize_name, prize_image_url)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [topScore.wallet, topScore.name, topScore.score, targetWeek, prize?.prize_name || '', prize?.image_url || ''],
          (err: any) => {
            if (err) {
              console.error('Error recording winner:', err);
              return callback('Failed to record winner');
            }

            console.log(`🏆 Winner recorded: ${topScore.name} (${topScore.score}m) for week ${targetWeek}`);

            // Clear all scores from the target week (fresh leaderboard for next week)
            db.run(
              `DELETE FROM scores WHERE strftime('%G-W%V', timestamp) = ?`,
              [targetWeek],
              function(this: any, err: any) {
                if (err) {
                  console.error('Error clearing scores:', err);
                  return callback('Failed to clear scores');
                }
                console.log(`🗑️  Cleared ${this.changes} score(s) from week ${targetWeek} — leaderboard reset`);
                return callback(null, {
                  winner: {
                    name: topScore.name,
                    score: topScore.score,
                    week: targetWeek,
                    prize: prize?.prize_name || '(no prize set)'
                  }
                });
              }
            );
          }
        );
      });
    });
  });
}

// POST /finalize-week — admin endpoint to manually trigger weekly finalization
// Optional body: { admin_key, week: "2026-W24" } — if week is omitted, uses current week
app.post('/finalize-week', (req: any, res: any) => {
  const { admin_key, week } = req.body || {};
  const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';
  if (admin_key !== ADMIN_KEY) {
    return res.status(403).json({ valid: false, error: 'Unauthorized' });
  }

  finalizeWeeklyWinner((err: string | null, result?: any) => {
    if (err) {
      return res.status(500).json({ valid: false, error: err });
    }
    return res.status(200).json({ valid: true, ...result });
  }, week);
});

// ── End Weekly Winner Automation ──────────────────────────────────────────────

// POST /clear-scores — admin tool to clear all scores from the leaderboard
// Requires admin_key in body for safety (prevents accidental clears)
app.post('/clear-scores', (req: any, res: any) => {
  const { admin_key } = req.body || {};
  const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';
  if (admin_key !== ADMIN_KEY) {
    return res.status(403).json({ valid: false, error: 'Unauthorized' });
  }
  db.run(
    `DELETE FROM scores`,
    [],
    function(this: any, err: any) {
      if (err) {
        console.error('Error clearing all scores:', err);
        return res.status(500).json({ valid: false, error: 'Failed to clear scores' });
      }
      console.log(`🗑️  Cleared ${this.changes} total score(s) — leaderboard reset`);
      return res.status(200).json({ valid: true, message: `Cleared ${this.changes} score(s). Leaderboard is now blank.` });
    }
  );
});

// Debug endpoint: list all scores with their calculated week
app.get('/debug/scores', (req: any, res: any) => {
  const key = req.query.key;
  if (key !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  db.all(
    `SELECT wallet, name, score, timestamp, strftime('%G-W%V', timestamp) as week FROM scores ORDER BY timestamp DESC`,
    [],
    (err: any, rows: any) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(200).json({ scores: rows });
    }
  );
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
  console.log(`⏰ Weekly winner scheduler initialized (every Sunday 23:59 UTC)`);
});

// Schedule weekly winner finalization
// Runs every Sunday at 23:59 UTC
cron.schedule('59 23 * * 0', () => {
  console.log(`\n📋 [CRON] Finalizing weekly winner...`);

  finalizeWeeklyWinner((err: string | null, result?: any) => {
    if (err) {
      console.error(`❌ [CRON] Error: ${err}`);
    } else if (result?.winner) {
      console.log(`✅ [CRON] ${result.winner.name} won week ${result.winner.week}!`);
    } else {
      console.log(`⚠️  [CRON] ${result?.message || 'Finalization complete'}`);
    }
  });
}, { timezone: 'UTC' });

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
