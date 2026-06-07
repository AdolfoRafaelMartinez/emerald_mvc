import fs from 'fs';
import path from 'path';

export const GAME_METADATA = {
  clue: {
    id: "clue",
    name: "Clue",
    description: "A classic detective mystery board game. Find out who did it, where, and with what weapon.",
    image: "/images/clue.png"
  },
  dnd: {
    id: "dnd",
    name: "Dungeons & Dragons",
    description: "The world's greatest tabletop roleplaying game. Learn the basic rules, spells, races, and classes.",
    image: "/images/dnd.png"
  },
  tictactoe: {
    id: "tictactoe",
    name: "Tic-Tac-Toe",
    description: "A simple, classic two-player alignment game played on a 3x3 grid. Get three in a row to win!",
    image: "/images/tictactoe.png"
  },
  catan: {
    id: "catan",
    name: "Settlers of Catan",
    description: "An interactive demonstration. Build settlements and trade resources while the Bayesian Advisor learns your winning strategy.",
    image: "/images/catan.png"
  },
  schwab: {
    id: "schwab",
    name: "Schwab Portfolio Advisor",
    description: "A professional financial demonstration. Manage a dynamic portfolio and let the Bayesian Advisor learn your risk profile.",
    image: "/images/schwab.png"
  }
};

export function getGameInfo(id) {
  if (GAME_METADATA[id]) {
    return GAME_METADATA[id];
  }
  const name = id.split(/[-_]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  return {
    id: id,
    name: name,
    description: `Consult the master for the rules and strategies of ${name}.`,
    image: "/images/default.png"
  };
}

export function getAvailableGames() {
  const gamesPath = path.join(process.cwd(), 'games');
  if (!fs.existsSync(gamesPath)) return [];
  
  return fs.readdirSync(gamesPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => getGameInfo(dirent.name));
}
