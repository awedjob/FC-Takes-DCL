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

  // Per-week prize history: the prize awarded for each specific ISO week.
  // finalizeWeeklyWinner reads this by week so a backlog of missed weeks each
  // resolves to its own correct prize, instead of every week getting whatever
  // the single current_prize row happens to hold at finalization time.
  db.run(`CREATE TABLE IF NOT EXISTS weekly_prizes (
    week TEXT PRIMARY KEY,
    prize_name TEXT NOT NULL,
    image_url TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // One-time migration: seed per-week history from the live current prize so a
  // week whose prize was set before this table existed (e.g. the current week)
  // still resolves correctly. INSERT OR IGNORE keeps it idempotent across boots.
  db.run(`INSERT OR IGNORE INTO weekly_prizes (week, prize_name, image_url)
    SELECT week_label, prize_name, image_url FROM current_prize
    WHERE week_label IS NOT NULL AND week_label != ''`);
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

// Upsert the prize for a specific ISO week into per-week history. Called
// whenever a prize is set for a week, so finalization can later resolve the
// correct prize for that exact week.
function rememberWeeklyPrize(
  week: string,
  prizeName: string,
  imageUrl: string,
  cb?: (err: any) => void
) {
  db.run(
    `INSERT INTO weekly_prizes (week, prize_name, image_url, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(week) DO UPDATE SET
       prize_name = excluded.prize_name,
       image_url = excluded.image_url,
       updated_at = CURRENT_TIMESTAMP`,
    [week, prizeName, imageUrl || ''],
    (err: any) => {
      if (err) console.error('Error updating weekly prize:', err);
      if (cb) cb(err);
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
      // Record this prize against the week it belongs to so finalization can
      // resolve it per-week even if that week is finalized much later.
      rememberWeeklyPrize(week_label, prize_name, image_url || '');
      return res.status(200).json({ valid: true, message: 'Prize updated' });
    }
  );
});

// POST /set-weekly-prize — admin records/corrects the prize for a SPECIFIC week
// in per-week history WITHOUT touching the live "this week's prize" display.
// Use it to backfill a past/missed week before it is finalized.
// Body: { week, prize_name, image_url, admin_key }
app.post('/set-weekly-prize', (req: any, res: any) => {
  const { week, prize_name, image_url, admin_key } = req.body || {};
  const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';
  if (admin_key !== ADMIN_KEY) {
    return res.status(403).json({ valid: false, error: 'Unauthorized' });
  }
  if (!week || !prize_name) {
    return res.status(400).json({ valid: false, error: 'Missing required fields: week, prize_name' });
  }
  rememberWeeklyPrize(week, prize_name, image_url || '', (err: any) => {
    if (err) {
      return res.status(500).json({ valid: false, error: 'Failed to set weekly prize' });
    }
    rememberPrize(prize_name, image_url || '');
    return res.status(200).json({ valid: true, message: `Prize for ${week} recorded` });
  });
});

// GET /weekly-prizes — all per-week prizes on record, newest week first
app.get('/weekly-prizes', (req: any, res: any) => {
  db.all(
    `SELECT week, prize_name, image_url, updated_at FROM weekly_prizes ORDER BY week DESC`,
    [],
    (err: any, rows: any) => {
      if (err) {
        console.error('Error fetching weekly prizes:', err);
        return res.status(500).json({ valid: false, error: 'Failed to fetch weekly prizes' });
      }
      return res.status(200).json({ valid: true, weeklyPrizes: rows });
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

// Helper: ISO-8601 week label ("2026-W25") for a date, computed in UTC.
//
// IMPORTANT: weeks are computed in JS, never via SQLite's
// strftime('%G-W%V', ...). The bundled SQLite (3.44.x) predates the %G/%V
// format codes (added in 3.46.0) and returns NULL for them, which silently
// matched zero rows and broke every week-based query — no week ever finalized
// or reset. All week filtering below uses isoWeekToRange() timestamp bounds
// instead, which only rely on plain (well-supported) datetime comparison.
function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Format a Date as the 'YYYY-MM-DD HH:MM:SS' UTC string SQLite stores via
// CURRENT_TIMESTAMP, so range bounds compare lexically against stored rows.
function toSqlUTC(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

// Convert an ISO week label ("2026-W25") to the half-open UTC datetime range
// [Monday 00:00:00, next Monday 00:00:00) the week spans. Returns null for a
// malformed label.
function isoWeekToRange(week: string): { start: string; end: string } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const wk = parseInt(m[2], 10);
  // Monday of ISO week 1 is the Monday of the week containing Jan 4.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (wk - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start: toSqlUTC(start), end: toSqlUTC(end) };
}

// Parse a stored 'YYYY-MM-DD HH:MM:SS' UTC timestamp into a Date.
function parseSqlUTC(ts: string): Date {
  return new Date(ts.replace(' ', 'T') + 'Z');
}

// The actual finalization logic — separate from HTTP so cron can call it directly
// week can be null (use current week) or an ISO week string like "2026-W24"
function finalizeWeeklyWinner(callback: (err: string | null, result?: any) => void, weekOverride?: string) {
  const targetWeek = weekOverride || getISOWeek(new Date());
  console.log(`⏰ Finalizing week: ${targetWeek}`);

  const range = isoWeekToRange(targetWeek);
  if (!range) {
    console.error(`Invalid week label: ${targetWeek}`);
    return callback(`Invalid week label: ${targetWeek}`);
  }

  // Get all past winners to exclude them
  db.all(`SELECT wallet FROM winners`, [], (err: any, pastWinners: any) => {
    if (err) {
      console.error('Error fetching past winners:', err);
      return callback('Failed to fetch past winners');
    }

    const excludedWallets = pastWinners.map((w: any) => w.wallet);

    // Get all scores from the target week, ordered by score (lowest = best),
    // excluding past winners. Week membership is a UTC timestamp range rather
    // than strftime (see getISOWeek note).
    const placeholders = excludedWallets.length > 0 ? excludedWallets.map(() => '?').join(',') : "'nonexistent'";
    const query = `
      SELECT wallet, name, score, timestamp
      FROM scores
      WHERE timestamp >= ? AND timestamp < ?
        AND wallet NOT IN (${placeholders})
      ORDER BY score ASC
      LIMIT 1
    `;

    db.get(query, [range.start, range.end, ...excludedWallets], (err: any, topScore: any) => {
      if (err) {
        console.error('Error fetching top scorer:', err);
        return callback('Failed to fetch scores');
      }

      if (!topScore) {
        console.log(`❌ No eligible winner found for week ${targetWeek}`);
        return callback(null, { message: `No eligible winner for week ${targetWeek}` });
      }

      // Records the winner with the resolved prize, then clears the week's
      // scores. Shared by both the per-week and fallback prize paths below.
      const recordWinnerWithPrize = (prize: any) => {
        db.run(
          `INSERT INTO winners (wallet, name, score, week, prize_name, prize_image_url)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [topScore.wallet, topScore.name, topScore.score, targetWeek, prize?.prize_name || '', prize?.image_url || ''],
          (err: any) => {
            if (err) {
              console.error('Error recording winner:', err);
              return callback('Failed to record winner');
            }

            console.log(`🏆 Winner recorded: ${topScore.name} (${topScore.score}m) for week ${targetWeek} [prize: ${prize?.prize_name || '(none)'}]`);

            // Clear all scores from the target week (fresh leaderboard for next week)
            db.run(
              `DELETE FROM scores WHERE timestamp >= ? AND timestamp < ?`,
              [range.start, range.end],
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
      };

      // Resolve the prize for THIS specific week from per-week history first;
      // fall back to the live current prize only for legacy weeks that predate
      // weekly_prizes (so each backlogged week still gets its own correct prize).
      db.get(`SELECT prize_name, image_url FROM weekly_prizes WHERE week = ?`, [targetWeek], (err: any, weeklyPrize: any) => {
        if (err) {
          console.error('Error fetching weekly prize:', err);
          return callback('Failed to fetch prize');
        }
        if (weeklyPrize) return recordWinnerWithPrize(weeklyPrize);
        db.get(`SELECT prize_name, image_url FROM current_prize WHERE id = 1`, [], (err2: any, prize: any) => {
          if (err2) {
            console.error('Error fetching current prize:', err2);
            return callback('Failed to fetch prize');
          }
          recordWinnerWithPrize(prize);
        });
      });
    });
  });
}

// Catch-up safety net: on every startup, finalize any PAST week that has
// scores on the board but no champion recorded yet. node-cron only fires while
// the process is alive and has NO missed-run recovery, so a redeploy, restart,
// crash, or sleep across the Sunday 23:59 UTC tick would otherwise skip a week
// permanently (this is exactly what happened to W25 and W26). Running this on
// boot closes that gap: any week the cron missed gets finalized the next time
// the server comes up. The current (still-active) week is never touched, and a
// missed week is only finalized once its prize is on record (see deferral
// below) so each week is crowned with its own correct prize.
function catchUpMissedWeeks() {
  const currentWeek = getISOWeek(new Date());

  // Distinct PAST weeks that still have scores sitting on the board. Weeks are
  // derived in JS (not strftime — see getISOWeek note); week strings are
  // zero-padded ("2026-W05"), so lexical `<` orders them correctly.
  db.all(
    `SELECT timestamp FROM scores`,
    [],
    (err: any, scoreRows: any) => {
      if (err) {
        console.error('Catch-up: failed to read score weeks:', err);
        return;
      }

      const pastWeeks = Array.from(
        new Set(
          (scoreRows as any[])
            .map((r: any) => r.timestamp)
            .filter((ts: any) => typeof ts === 'string' && ts)
            .map((ts: string) => getISOWeek(parseSqlUTC(ts)))
            .filter((w: string) => w < currentWeek)
        )
      ).sort() as string[];

      // Weeks that already have a champion recorded — never re-finalize these.
      db.all(`SELECT DISTINCT week FROM winners`, [], (err2: any, wonRows: any) => {
        if (err2) {
          console.error('Catch-up: failed to read winners:', err2);
          return;
        }

        // Weeks that have a prize on record — a backlogged week is only
        // finalized once its prize is known, so a missed week can never be
        // crowned with a guessed/wrong prize. Weeks without one are deferred
        // until an admin sets it via /set-weekly-prize (then the next boot or a
        // manual /finalize-week picks them up).
        db.all(`SELECT week FROM weekly_prizes`, [], (err3: any, prizeRows: any) => {
          if (err3) {
            console.error('Catch-up: failed to read weekly prizes:', err3);
            return;
          }

          const finalized = new Set((wonRows as any[]).map((r: any) => r.week));
          const havePrize = new Set((prizeRows as any[]).map((r: any) => r.week));
          const candidates = pastWeeks.filter((w: string) => !finalized.has(w));

          const ready = candidates.filter((w: string) => havePrize.has(w));
          const deferred = candidates.filter((w: string) => !havePrize.has(w));

          if (deferred.length > 0) {
            console.log(`⏸️  Catch-up: ${deferred.length} week(s) deferred (no prize on record) — set one via /set-weekly-prize then redeploy/restart: ${deferred.join(', ')}`);
          }

          if (ready.length === 0) {
            console.log('✅ Catch-up: no ready weeks to finalize');
            return;
          }

          console.log(`🔄 Catch-up: ${ready.length} missed week(s) to finalize: ${ready.join(', ')}`);

          // Finalize oldest-first, strictly one at a time — each finalization
          // deletes its own week's scores, so the calls must not overlap.
          let i = 0;
          const finalizeNext = () => {
            if (i >= ready.length) {
              console.log('✅ Catch-up: complete');
              return;
            }
            const week = ready[i++];
            finalizeWeeklyWinner((err4: string | null, result?: any) => {
              if (err4) {
                console.error(`❌ Catch-up: error finalizing ${week}: ${err4}`);
              } else if (result?.winner) {
                console.log(`🏆 Catch-up: ${result.winner.name} won ${week}`);
              } else {
                console.log(`⚠️  Catch-up: ${result?.message || `nothing to finalize for ${week}`}`);
              }
              finalizeNext();
            }, week);
          };
          finalizeNext();
        });
      });
    }
  );
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
    `SELECT wallet, name, score, timestamp FROM scores ORDER BY timestamp DESC`,
    [],
    (err: any, rows: any) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      // Compute the ISO week in JS (SQLite here can't — see getISOWeek note).
      const scores = (rows as any[]).map((r: any) => ({
        ...r,
        week: r.timestamp ? getISOWeek(parseSqlUTC(r.timestamp)) : null,
      }));
      res.status(200).json({ scores });
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

  // Self-heal any weeks the in-process cron missed while the server was down.
  catchUpMissedWeeks();
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
