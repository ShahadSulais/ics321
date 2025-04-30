const express = require('express');
const router = express.Router();
const db = require('../db');

// Add Tournament
router.post('/add-tournament', (req, res) => {
  const { name, start_date, end_date } = req.body;
  db.query('INSERT INTO tournament (name, start_date, end_date) VALUES (?, ?, ?)', 
    [name, start_date, end_date], 
    (err, result) => {
      if (err) return res.status(500).send('Error adding tournament');
      res.send('Tournament added successfully!');
    }
  );
});

// Add Team
router.post('/add-team', (req, res) => {
  const { team_id, tournament_id, team_group } = req.body;
  db.query('INSERT INTO tournament_team (team_id, tournament_id, team_group) VALUES (?, ?, ?)', 
    [team_id, tournament_id, team_group], 
    (err, result) => {
      if (err) return res.status(500).send('Error adding team');
      res.send('Team added successfully!');
    }
  );
});

// Select Captain
router.post('/select-captain', (req, res) => {
  const { match_no, team_id, player_id } = req.body;
  db.query('UPDATE match_captain SET player_id = ? WHERE match_no = ? AND team_id = ?', 
    [player_id, match_no, team_id], 
    (err, result) => {
      if (err) return res.status(500).send('Error selecting captain');
      res.send('Captain selected successfully!');
    }
  );
});

// Approve Player
router.post('/approve-player', (req, res) => {
  const { player_id, team_id, tournament_id } = req.body;
  db.query('INSERT INTO team_player (player_id, team_id, tournament_id) VALUES (?, ?, ?)', 
    [player_id, team_id, tournament_id], 
    (err, result) => {
      if (err) return res.status(500).send('Error approving player');
      res.send('Player approved successfully!');
    }
  );
});

// Delete Tournament
router.delete('/delete-tournament/:tournament_id', (req, res) => {
  const { tournament_id } = req.params;
  db.query('DELETE FROM tournament WHERE tournament_id = ?', 
    [tournament_id], 
    (err, result) => {
      if (err) return res.status(500).send('Error deleting tournament');
      res.send('Tournament deleted successfully!');
    }
  );
});

// Add Penalty Kick
router.post('/add-penalty', (req, res) => {
  const { match_no, team, player, kick_no, scored } = req.body;
  db.query('INSERT INTO penalty (match_no, team, player, kick_no, scored) VALUES (?, ?, ?, ?, ?)', 
    [match_no, team, player, kick_no, scored], 
    (err, result) => {
      if (err) return res.status(500).send('Error adding penalty');
      res.send('Penalty kick added successfully!');
    }
  );
});

// Add Match Result
router.post('/add-match-result', (req, res) => {
  const { match_no, team_id, tournament_id, goals, win_lose } = req.body;
  db.query('INSERT INTO match_details (match_no, team_id, tournament_id, goals, win_lose) VALUES (?, ?, ?, ?, ?)', 
    [match_no, team_id, tournament_id, goals, win_lose], 
    (err, result) => {
      if (err) return res.status(500).send('Error adding match result');
      res.send('Match result added successfully!');
    }
  );
});

module.exports = router;
