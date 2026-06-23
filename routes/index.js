import express from 'express';
import fs from 'fs';
import path from 'path';
import { getAvailableGames, getGameInfo } from '../utils/gameHelper.js';
import Stripe from 'stripe';
import dotenv from "dotenv";

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const YOUR_DOMAIN = 'http://www.armtegm.com';

var router = express.Router();

router.get('/', function (req, res, next) {
  const games = getAvailableGames();
  res.render('index', { games: games });
});

router.get('/game/:gameName', function (req, res, next) {
  const gameName = req.params.gameName;
  const gamesPath = path.join(process.cwd(), 'games', gameName);

  if (!fs.existsSync(gamesPath) || !fs.statSync(gamesPath).isDirectory()) {
    return res.status(404).render('error', { message: 'Game not found', error: { status: 404 } });
  }

  const game = getGameInfo(gameName);
  if (gameName === 'catan') {
    return res.render('catan', { game: game });
  }
  if (gameName === 'wealth') {
    return res.render('wealth', { game: game });
  }
  res.render('game', { game: game });
});

router.get('/schwab', function (req, res, next) {
  res.render('schwab');
});

router.get('/checkout', function (req, res, next) {
  res.render('checkout');
});

router.post('/create-checkout-session', async (req, res, next) => {
  try {
    let priceId = req.body.priceId;
    // Fallback to default if priceId is empty, missing, or a dummy placeholder option
    if (!priceId || priceId.includes('_apprentice') || priceId.includes('_archmage')) {
      priceId = 'price_1TlG8mHOAmfdroOCyiElxlIQ';
    }
    const quantity = parseInt(req.body.quantity) || 1;

    // Dynamically detect domain protocol and host to support localhost and production environments
    const hostDomain = `${req.protocol}://${req.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: priceId,
          quantity: quantity,
        },
      ],
      mode: 'payment',
      success_url: `${hostDomain}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      automatic_tax: { enabled: true },
    });

    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      res.json({ url: session.url });
    } else {
      res.redirect(303, session.url);
    }
  } catch (error) {
    next(error);
  }
});

export default router;