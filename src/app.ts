import express from 'express';
import { authenticatePlayer } from './middlewares/authentication';
import playerController from './modules/player/player.controller';
import groupController from './modules/group/group.controller';

const app = express();

app.use(express.json());
app.use(authenticatePlayer);

// Routes
app.use('/players', playerController);
app.use('/groups', groupController);

export default app;
