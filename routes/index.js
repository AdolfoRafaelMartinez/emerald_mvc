import express from 'express';
import fs from 'fs';
import path from 'path';
import { getAvailableGames, getGameInfo } from '../utils/gameHelper.js';

var router = express.Router();

router.get('/', function(req, res, next) {
  const games = getAvailableGames();
  res.render('index', { games: games });
});

router.get('/game/:gameName', function(req, res, next) {
  const gameName = req.params.gameName;
  const gamesPath = path.join(process.cwd(), 'games', gameName);
  
  if (!fs.existsSync(gamesPath) || !fs.statSync(gamesPath).isDirectory()) {
    return res.status(404).render('error', { message: 'Game not found', error: { status: 404 } });
  }
  
  const game = getGameInfo(gameName);
  res.render('game', { game: game });
});

export default router;