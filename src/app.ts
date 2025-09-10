import express from 'express';
import { authenticatePlayer } from './middlewares/authentication';
import playerController from './modules/player/player.controller';

const app = express();

app.use(express.json());
app.use(authenticatePlayer);

// Routes
app.use('/players', playerController);

export default app;
