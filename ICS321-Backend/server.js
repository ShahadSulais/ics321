const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');
const path = require('path');
const mysql = require('mysql2');

const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// 1. Add New Tournament
app.post('/api/add-tournament', (req, res) => {
  const { tName, tStart, tEnd } = req.body;
  console.log('📥 Request Body:', req.body);

  const sql = 'INSERT INTO tournament (tr_name, start_date, end_date) VALUES (?, ?, ?)';
  db.query(sql, [tName, tStart, tEnd], (err, result) => {
    if (err) {
      console.error('❌ Error adding tournament:', err);
      return res.status(500).send('Error adding tournament');
    }
    res.send('Tournament added successfully!');
  });
});

// 2. Add Team to Tournament
app.post('/api/add-team', (req, res) => {
  const { teamId, tournamentIdForTeam, teamGroup } = req.body;

  const sql = `
    INSERT INTO tournament_team 
    (team_id, tr_id, team_group, match_played, won, draw, lost, goal_for, goal_against, goal_diff, points, group_position)
    VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0)
  `;

  db.query(sql, [teamId, tournamentIdForTeam, teamGroup], (err, result) => {
    if (err) {
      console.error('❌ Error adding team:', err);
      return res.status(500).send('Error adding team to tournament');
    }
    res.send('✅ Team added to tournament successfully!');
  });
});

// 3. Select Captain for Team
app.post('/api/select-captain', (req, res) => {
  const { matchNo, teamIdForCaptain, playerIdCaptain } = req.body;

  const sql = `
    INSERT INTO match_captain (match_no, team_id, player_captain)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [matchNo, teamIdForCaptain, playerIdCaptain], (err, result) => {
    if (err) {
      console.error('❌ Error selecting captain:', err);
      return res.status(500).send('Error selecting captain');
    }
    res.send('✅ Captain selected successfully!');
  });
});

// 4. Approve Player to Join Team
app.post('/api/approve-player', (req, res) => {
  const { playerId, teamIdForPlayer, tournamentIdForPlayer } = req.body;

  const sql = `
    INSERT INTO team_player (player_id, team_id, tr_id)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [playerId, teamIdForPlayer, tournamentIdForPlayer], (err, result) => {
    if (err) {
      console.error('❌ Error approving player:', err);
      return res.status(500).send('Error approving player');
    }
    res.send('✅ Player approved successfully!');
  });
});

// 5. Delete Tournament
app.delete('/api/delete-tournament/:tournamentId', (req, res) => {
  const { tournamentId } = req.params;

  const sql = 'DELETE FROM tournament WHERE tr_id = ?';
  db.query(sql, [tournamentId], (err, result) => {
    if (err) {
      console.error('Error deleting tournament:', err);
      return res.status(500).send('Error deleting tournament');
    }
    res.send('Tournament deleted successfully!');
  });
});

// 6. Get Match Results With Details
app.get('/api/match-results/:tournamentName', (req, res) => {
  const { tournamentName } = req.params;
  const sql = `
    SELECT 
      mp.match_no,
      mp.play_date,
      t1.team_name AS team1,
      t2.team_name AS team2,
      mp.goal_score,
      v.venue_name AS venue,
      p.name AS referee
    FROM match_played mp
    JOIN team t1 ON mp.team_id1 = t1.team_id
    JOIN team t2 ON mp.team_id2 = t2.team_id
    JOIN venue v ON mp.venue_id = v.venue_id
    JOIN match_support ms ON mp.match_no = ms.match_no AND ms.support_type = 'RF'
    JOIN person p ON ms.support_id = p.kfupm_id
    WHERE mp.match_no IN (
      SELECT match_no
      FROM match_details
      WHERE team_id IN (
        SELECT team_id
        FROM tournament_team
        WHERE tr_id = (SELECT tr_id FROM tournament WHERE tr_name = ? LIMIT 1)
      )
    )
    ORDER BY mp.play_date ASC
  `;

  db.query(sql, [tournamentName], async (err, matches) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!matches.length) return res.json([]);

    const results = await Promise.all(matches.map(async match => {
      const [goals] = await db.promise().query(`
        SELECT p.name AS player, gd.goal_time AS minute, t.team_name AS team
        FROM goal_details gd
        JOIN player pl ON gd.player_id = pl.player_id
        JOIN person p ON pl.player_id = p.kfupm_id
        JOIN team t ON gd.team_id = t.team_id
        WHERE gd.match_no = ?
      `, [match.match_no]);

      const [redCards] = await db.promise().query(`
        SELECT p.name AS player, pb.booking_time AS minute, t.team_name AS team
        FROM player_booked pb
        JOIN player pl ON pb.player_id = pl.player_id
        JOIN person p ON pl.player_id = p.kfupm_id
        JOIN team t ON pb.team_id = t.team_id
        WHERE pb.match_no = ? AND pb.sent_off = 'Y'
      `, [match.match_no]);

      const [penalties] = await db.promise().query(`
        SELECT p.name AS player, ps.kick_no, ps.score_goal, t.team_name AS team
        FROM penalty_shootout ps
        JOIN player pl ON ps.player_id = pl.player_id
        JOIN person p ON pl.player_id = p.kfupm_id
        JOIN team t ON ps.team_id = t.team_id
        WHERE ps.match_no = ?
      `, [match.match_no]);

      const [subs] = await db.promise().query(`
        SELECT p.name AS player, io.time_in_out AS minute, io.in_out, io.play_schedule AS schedule, io.play_half AS half, t.team_name AS team
        FROM player_in_out io
        JOIN player pl ON io.player_id = pl.player_id
        JOIN person p ON pl.player_id = p.kfupm_id
        JOIN team t ON io.team_id = t.team_id
        WHERE io.match_no = ?
      `, [match.match_no]);

      return {
        ...match,
        goals,
        redCards,
        penalties,
        subs
      };
    }));

    res.json(results);
  });
});

// 7. Get All Tournaments
app.get('/api/tournaments', (req, res) => {
  const sql = 'SELECT tr_name FROM tournament ORDER BY tr_name';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).send('Error fetching tournaments');
    res.json(results);
  });
});

// 8. Get Top Scorers by Tournament
// ✅ Final Fix: Top Scorers API
app.get('/api/top-scorers/:tournamentName', (req, res) => {
  const { tournamentName } = req.params;

  const sql = `
    SELECT 
      p.name AS player_name,
      t.team_name AS team_name,
      COUNT(*) AS total_goals
    FROM goal_details gd
    JOIN player pl ON gd.player_id = pl.player_id
    JOIN person p ON pl.player_id = p.kfupm_id
    JOIN team t ON gd.team_id = t.team_id
    JOIN tournament_team tt ON t.team_id = tt.team_id
    JOIN tournament tr ON tr.tr_id = tt.tr_id
    WHERE tr.tr_name = ?
    GROUP BY p.name, t.team_name
    ORDER BY total_goals DESC
  `;

  db.query(sql, [tournamentName], (err, results) => {
    if (err) {
      console.error('❌ SQL Error:', err);
      return res.status(500).send('Error fetching top scorers');
    }

    console.log('✅ Top Scorers:', results); // ✅ Verify this logs expected structure
    res.json(results); // Send the exact field names your frontend expects
  });
});


// 9. Get Red Cards by Team
app.get('/api/red-cards/:teamName', (req, res) => {
  const { teamName } = req.params;

  const sql = `
    SELECT p.name AS player, pb.booking_time AS time, pb.play_half AS half, t2.team_name AS opponent
    FROM player_booked pb
    JOIN player pl ON pb.player_id = pl.player_id
    JOIN person p ON pl.player_id = p.kfupm_id
    JOIN team t1 ON pb.team_id = t1.team_id
    JOIN match_played mp ON pb.match_no = mp.match_no
    JOIN team t2 ON (t2.team_id = mp.team_id1 OR t2.team_id = mp.team_id2) AND t2.team_id != pb.team_id
    WHERE pb.sent_off = 'Y' AND t1.team_name = ?
  `;

  db.query(sql, [teamName], (err, results) => {
    if (err) return res.status(500).send('Error loading red cards');
    res.json(results);
  });
});

app.get('/api/team-members/:teamName', (req, res) => {
  const { teamName } = req.params;

  const sql = `
    SELECT 
      p.name AS player_name,
      pl.jersey_no,
      pp.position_desc,
      IF(mc.player_captain = pl.player_id, 'Y', 'N') AS is_captain,
      t.team_name,
      (SELECT p1.name
       FROM match_support ms1
       JOIN match_played mp1 ON ms1.match_no = mp1.match_no
       JOIN person p1 ON ms1.support_id = p1.kfupm_id
       WHERE ms1.support_type = 'CH'
         AND (mp1.team_id1 = t.team_id OR mp1.team_id2 = t.team_id)
       LIMIT 1) AS coach_name,
      (SELECT p2.name
       FROM match_support ms2
       JOIN match_played mp2 ON ms2.match_no = mp2.match_no
       JOIN person p2 ON ms2.support_id = p2.kfupm_id
       WHERE ms2.support_type = 'MG'
         AND (mp2.team_id1 = t.team_id OR mp2.team_id2 = t.team_id)
       LIMIT 1) AS manager_name
    FROM team_player tp
    JOIN team t ON tp.team_id = t.team_id
    JOIN player pl ON tp.player_id = pl.player_id
    JOIN person p ON pl.player_id = p.kfupm_id
    JOIN playing_position pp ON pl.position_to_play = pp.position_id
    LEFT JOIN match_captain mc ON tp.player_id = mc.player_captain AND tp.team_id = mc.team_id
    WHERE t.team_name = ?
  `;

  db.query(sql, [teamName], (err, results) => {
    if (err) {
      console.error('❌ Error fetching team members:', err);
      return res.status(500).send('Error fetching team members');
    }

    let coachName = 'Not Assigned';
    let managerName = 'Not Assigned';

    if (results.length) {
      coachName = results[0].coach_name || 'Not Assigned';
      managerName = results[0].manager_name || 'Not Assigned';
    }

    const players = results.map(row => ({
      name: row.player_name,
      number: row.jersey_no,
      position: row.position_desc,
      isCaptain: row.is_captain === 'Y'
    }));

    res.json({ coach: coachName, manager: managerName, players });
  });
});



app.get('/api/team-members/:teamName', (req, res) => {
  const { teamName } = req.params;

  const sql = `
    SELECT 
      p.name AS player_name,
      pl.jersey_no,
      pp.position_desc,
      IF(mc.player_captain = pl.player_id, 'Y', 'N') AS is_captain,
      t.team_name,
      (SELECT p1.name
       FROM match_support ms1
       JOIN match_played mp1 ON ms1.match_no = mp1.match_no
       JOIN person p1 ON ms1.support_id = p1.kfupm_id
       WHERE ms1.support_type = 'CH'
         AND (mp1.team_id1 = t.team_id OR mp1.team_id2 = t.team_id)
       LIMIT 1) AS coach_name,
      (SELECT p2.name
       FROM match_support ms2
       JOIN match_played mp2 ON ms2.match_no = mp2.match_no
       JOIN person p2 ON ms2.support_id = p2.kfupm_id
       WHERE ms2.support_type = 'MG'
         AND (mp2.team_id1 = t.team_id OR mp2.team_id2 = t.team_id)
       LIMIT 1) AS manager_name
    FROM team_player tp
    JOIN team t ON tp.team_id = t.team_id
    JOIN player pl ON tp.player_id = pl.player_id
    JOIN person p ON pl.player_id = p.kfupm_id
    JOIN playing_position pp ON pl.position_to_play = pp.position_id
    LEFT JOIN match_captain mc ON tp.player_id = mc.player_captain AND tp.team_id = mc.team_id
    WHERE t.team_name = ?
  `;

  db.query(sql, [teamName], (err, results) => {
    if (err) {
      console.error('❌ Error fetching team members:', err);
      return res.status(500).send('Error fetching team members');
    }

    let coachName = 'Not Assigned';
    let managerName = 'Not Assigned';

    if (results.length) {
      coachName = results[0].coach_name || 'Not Assigned';
      managerName = results[0].manager_name || 'Not Assigned';
    }

    const players = results.map(row => ({
      name: row.player_name,
      number: row.jersey_no,
      position: row.position_desc,
      isCaptain: row.is_captain === 'Y'
    }));

    res.json({ coach: coachName, manager: managerName, players });
  });
});

// ✅ Get All Teams
app.get('/api/teams', (req, res) => {
  const sql = 'SELECT DISTINCT team_name FROM team ORDER BY team_name';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).send('Error fetching teams');
    res.json(results);
  });
});

// ✅ Get All Tournaments
app.get('/api/tournaments', (req, res) => {
  const sql = 'SELECT DISTINCT tr_name FROM tournament ORDER BY tr_name';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching tournaments:', err);
      return res.status(500).send('Error fetching tournaments');
    }
    res.json(results);
  });
});

// ✅ Get Standings by Tournament
app.get('/api/standings/:tournamentName', (req, res) => {
  const { tournamentName } = req.params;

  const sql = `
    SELECT 
      t.team_name,
      tt.match_played,
      tt.won,
      tt.draw,
      tt.lost,
      tt.goal_for,
      tt.goal_against,
      tt.goal_diff,
      tt.points
    FROM tournament_team tt
    JOIN team t ON tt.team_id = t.team_id
    JOIN tournament tr ON tt.tr_id = tr.tr_id
    WHERE tr.tr_name = ?
    ORDER BY tt.points DESC, tt.goal_diff DESC
  `;

  db.query(sql, [tournamentName], (err, results) => {
    if (err) {
      console.error('Error fetching standings:', err);
      return res.status(500).send('Error fetching standings');
    }
    res.json(results);
  });
});

app.get('/api/team-members/:teamName', (req, res) => {
  const { teamName } = req.params;

  const sql = `
    SELECT 
      p.name AS player_name,
      pl.jersey_no,
      pp.position_desc,
      IF(mc.player_captain = pl.player_id, 'Y', 'N') AS is_captain,
      
      -- Subqueries for coach and manager
      (SELECT p1.name
       FROM match_support ms1
       JOIN match_played mp1 ON ms1.match_no = mp1.match_no
       JOIN person p1 ON ms1.support_id = p1.kfupm_id
       WHERE ms1.support_type = 'CH'
         AND (mp1.team_id1 = t.team_id OR mp1.team_id2 = t.team_id)
       LIMIT 1) AS coach_name,

      (SELECT p2.name
       FROM match_support ms2
       JOIN match_played mp2 ON ms2.match_no = mp2.match_no
       JOIN person p2 ON ms2.support_id = p2.kfupm_id
       WHERE ms2.support_type = 'MG'
         AND (mp2.team_id1 = t.team_id OR mp2.team_id2 = t.team_id)
       LIMIT 1) AS manager_name

    FROM team_player tp
    JOIN team t ON tp.team_id = t.team_id
    JOIN player pl ON tp.player_id = pl.player_id
    JOIN person p ON pl.player_id = p.kfupm_id
    JOIN playing_position pp ON pl.position_to_play = pp.position_id
    LEFT JOIN match_captain mc ON tp.team_id = mc.team_id

    WHERE t.team_name = ?
  `;

  db.query(sql, [teamName], (err, results) => {
    if (err) {
      console.error('❌ Error fetching team members:', err);
      return res.status(500).send('Error fetching team members');
    }

    let coachName = 'Not Assigned';
    let managerName = 'Not Assigned';

    if (results.length) {
      coachName = results[0].coach_name || 'Not Assigned';
      managerName = results[0].manager_name || 'Not Assigned';
    }

    const players = results.map(row => ({
      name: row.player_name,
      number: row.jersey_no,
      position: row.position_desc,
      isCaptain: row.is_captain === 'Y'
    }));

    res.json({ coach: coachName, manager: managerName, players });
  });
});



// ✅ Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});


