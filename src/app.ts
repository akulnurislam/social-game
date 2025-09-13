import express from 'express';
import { errorHandler } from './error-handler';
import { authenticatePlayer } from './middlewares/authentication';
import battleController from './modules/battle/battle.controller';
import groupController from './modules/group/group.controller';
import playerController from './modules/player/player.controller';

const app = express();

app.use(express.json());
app.use(authenticatePlayer);

// Routes
app.use('/players', playerController);
app.use('/groups', groupController);
app.use('/battles', battleController);

app.use(errorHandler);

export default app;
