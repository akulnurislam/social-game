# Social Game

A simple social game backend built with Node.js, PostgreSQL, and Redis, featuring:

- Players: Create and manage player accounts.
- Groups: Join or create groups to play together.
- Battles: Challenge other groups with cooldowns and anti-cheat protection.
- Leaderboard: Track rankings and achievements.
- Social: Features like gifting and help between players.
- Bot: Telegram integration for interaction.

The system uses **Redis locks**, **cooldowns**, and **guards** to enforce fair play and prevent cheating during battles

## Tech Stack
- Node.js (v22.19.0+) with TypeScript
- PostgreSQL (v16.2+) as the relational database
- Redis (v8.2.0+) for locks, cooldowns, and caching
- Express.js for REST APIs
- WebSocket for real-time communication
- Docker Compose for local development setup

## Requirements
- Node.js: `>=22.19.0`
- PostgreSQL: `>=16.2`
- Redis: `>=8.2.0`

## Getting Started
<details open>
<summary>Getting Started</summary>

### Running
1. Copy environment file
   ```
   cp .env.example .env
   ```
   Fill in your database, Redis, and other settings.

2. Run database migration (first time only)
   ```
   npm run migrate
   ```

3. Start development server\
   You can also pass an argument to run a specific service `api`, `ws`, or `bot`
   ```
   npm run dev <optional-args>
   ```

4. Build for production
   ```
   npm run build
   ```

5. Run in production
   - Run API + WebSocket + Telegram Bot in one instance:
     ```
     npm start
     ```
   - Run API only:
     ```
     npm run start:api
     ```
   - Run WebSocket only:
     ```
     npm run start:ws
     ```
   - Run Telegram Bot only:
     ```
     npm run start:bot
     ```

### Testing
Run unit tests with
```
npm test
```

### WebSocket test client
Replace `<playerId>` with a UUID to simulate a player connecting to the WebSocket server.
```
npm run client:ws <playerId>
```
</details>

## Documentation

- For a detailed system design, see the [Architecture Overview](./ARCHITECTURE.md)
- For request/response specifications, see the [API Documentation](./API.md)
- For testing instructions and simulation flows, see the [Testing Guide](./TESTING.md)

## Project Structure
<details>
<summary>Project Structure</summary>

```
├── package.json
├── tsconfig.json                    # TypeScript configuration
├── .env.example                     # Example environment variables
├── README.md
├── API.md                           # API reference documentation
├── ARCHITECTURE.md                  # System architecture overview
│
├── migrations
│   └── 001_init.sql                 # Initial database setup: basic schema
│
├── scripts
│   ├── build.ts                     # ESBuild configuration and build script
│   ├── migrate.ts                   # Script to run database migration files
│   └── ws-client.ts                 # WebSocket test client
│
└── src
    ├── index.ts                     # Entry point
    ├── server.ts                    # API bootstrap (Express)
    ├── ws-server.ts                 # WebSocket bootstrap
    ├── bot.ts                       # Telegram Bot bootstrap
    ├── app.ts                       # Express app setup (middlewares, routes)
    ├── error-handler.ts             # Centralized error handler (API)
    │
    ├── core                         # Core infrastructure
    │   ├── db.ts                    # Postgres pool/connection
    │   ├── redis.ts                 # Redis pub/sub client
    │
    ├── exceptions                   # Custom exceptions
    │   └── app-exception.ts         # Base exception
    │
    ├── middlewares                  # Express middlewares
    │   └── authentication.ts        # Auth middleware
    │
    ├── types                        # Shared types & augmentations
    │   └── express.d.ts             # Extend Express Request/Response types
    │
    ├── constants
    │   └── redis-channels.ts        # Centralized Redis channel names for publish/subscribe
    │
    └── modules                      # Feature modules
        ├── battle
        │   ├── battle.ts            # Entity (interfaces, constants)
        │   ├── battle.repository.ts # DB queries
        │   ├── battle.service.ts    # Business logic
        │   ├── battle.controller.ts # REST (Express routes)
        │   └── battle.ws.ts         # WebSocket handlers
        │
        ├── player
        ├── group
        ├── leaderboard
        ├── social
        └── bot
```
</details>

## Anti-Cheat & Cooldown System (with Redis)

This backend uses Redis to enforce fair gameplay and prevent cheating in battles.\
I’ve implemented a multi-layer guard system inside BattleService that leverages short-lived locks, cooldowns, and membership checks.

<details>
<summary>Core Concepts (Battle)</summary>

### Core Concepts (Battle)

1. **Per-Player Rate Limits**
   - Prevent spamming of actions (create/join/attack/etc.)
   - Redis key: `ratelimit:{playerId}:{action}`
   - Example: `ratelimit:123:create_battle`
   - Stores an increment counter with an expiry window (e.g., 60s).
   - If limit exceeded → `AppException('Too many battle creation attempts. Try again later.', 429)`.
2. **Group Cooldowns**
   - Prevents groups from creating battles too frequently.
   - Redis key: `cooldown:attack:{groupId}`
   - Example: `cooldown:attack:abc`
   - Set with TTL (e.g., 5m) when a group creates a battle.
   - If another battle is requested before cooldown expires → `AppException('Attacking group is on cooldown. Try later.', 429)`.
3. **Join Guards**
   - Can only join one battle within a 60-second window.
   - Prevents cheating in participant lists:
     - Cannot join a finished battle.
     - Cannot join both attacker & defender sides.
     - Cannot double-join the same battle.
   - Uses DB checks and Redis temporary markers
   - Redis key: `ratelimit:{playerId}:join_battle`
   - Example: `ratelimit:123:join_battle`
   - Helps avoid race conditions in high-traffic environments.
4. **Start Locks**
   - Prevents concurrent race conditions where two players try to start the same battle simultaneously.
   - Redis key: `lock:battle:{battleId}:begin`
   - Uses **SETNX + TTL** (atomic lock).
   - If lock exists → `AppException('Battle is already being started.', 409)`.
5. **Finish Guards**
   - Prevents finishing a battle too soon after starting (anti-abuse).
   - Enforce **minimum battle duration** (e.g., 60s).
   - Check from `started_at` field in `battle` entity.
   - If `now - battle.started_at < 60s` → `AppException('Battle cannot be finished yet.', 400)`
</details>

<details>
<summary>Redis Key Naming Conventions</summary>

### Redis Key Naming Conventions

| Key pattern | Purpose | TTL |
| --- | --- | --- |
| `ratelimit:{playerId}:{action}` | Per-player action rate limit | 60 seconds |
| `cooldown:attack:{groupId}` | Group cooldown after creating battle | 5 minutes |
| `lock:battle:{battleId}:begin` | Concurrency lock for beginBattle | 5 seconds |
| `leaderboard:24` | Sorted set tracking group scores for the last 24 hours | 24 hours |
| `member:battle:{battleId}` | Store all player IDs that are participating in a specific battle. Only players who started the battle and joined are added. | 30 minutes or **Battle finished** |
</details>

<details>
<summary>Redis Pub/Sub Channels</summary>

### Redis Pub/Sub Channels
The backend uses Redis Pub/Sub to broadcast battle events. Each battle-related action has its own channel:

| Channel | Description | Payload Example |
| --- | --- | --- |
| `battle:begin` | Triggered when a battle starts. | `{ "battleId": "uuid" }` |
| `battle:join` | Triggered when a player joins an ongoing battle. | `{ "battleId": "uuid", "playerId": "uuid" }` |
| `battle:finished` | Triggered when a battle finishes. | `{ "battleId": "uuid", "winnerGroupId": "uuid", "score": 100 }` |
</details>

<details open>
<summary>Implementation Flow</summary>

### Implementation Flow

1. **Battle Lifecycle**
   ```mermaid
   stateDiagram-v2
       [*] --> Pending
       Pending --> Running: beginBattle (lock acquired)
       Running --> Finished: finishBattle (>=60s elapsed)
       Finished --> [*]
   ```
2. **Create Battle**
   ```mermaid
   sequenceDiagram
       participant Player
       participant Service
       participant Redis
       participant DB

       Player->>Service: POST /battles

       Service->>DB: Get attackerMembers, defenderMembers
       alt Creator invalid membership
           Service-->>Player: Error 400 (must be in exactly one group)
       else Valid membership
           Service->>Redis: INCR ratelimit:{playerId}:create_battle (TTL=60s)
           alt Player exceeded limit
               Service-->>Player: Error 429 (too many battle creation attempts)
           else Within limit
               Service->>Redis: SETNX cooldown:attack:{attackerGroupId} (TTL=5m)
               alt Group on cooldown
                   Service-->>Player: Error 429 (attacker group on cooldown)
               else Cooldown acquired
                   Service->>DB: INSERT battle (attacker vs defender)
                   Service->>DB: INSERT battle_members (creator as initiator)
                   Service-->>Player: Battle created
               end
           end
       end
   ```
3. **Join Battle**
   ```mermaid
   sequenceDiagram
       participant Player
       participant Service
       participant DB
       participant Redis
   
       Player->>Service: POST /battles/:id/join
       Service->>DB: findById(battleId)
       alt not found
           DB-->>Service: null
           Service-->>Player: Error 404 (battle not found)
       else found
           alt not running
               DB-->>Service: state != running
               Service-->>Player: Error 400 (cannot join)
           else running
               Service->>DB: listMembers(battleId)
               alt already joined
                   DB-->>Service: player exists
                   Service-->>Player: Error 400 (player already joined)
               else not joined
                   Service->>Redis: INCR ratelimit:{playerId}:join_battle (TTL=60s)
                   alt join attempts > 3
                       Redis-->>Service: count exceeded
                       Service-->>Player: Error 429 (too many join attempts)
                   else ok
                       Service->>DB: Get attackerMembers, defenderMembers
                       Service->>Service: validate group membership
                       alt invalid membership
                           Service-->>Player: Error 400 (must belong to exactly one side)
                       else valid
                           Service->>DB: INSERT battle_members (playerId, role)
                           Service->>Redis: SADD member:battle:{battleId} <playerId>
                           Service->>Redis: PUBLISH battle:join { battleId, playerId }
                           Service-->>Player: Joined battle
                       end
                   end
               end
           end
       end
   ```
4. **Begin Battle**
   ```mermaid
   sequenceDiagram
       participant Player
       participant Service
       participant Redis
       participant DB

       Player->>Service: POST /battles/:id/begin
       Service->>DB: findById(battleId)
       alt Battle not found
           DB-->>Service: null
           Service-->>Player: Error 404 (battle not found)
       else Battle exists
           alt State != pending
               Service-->>Player: Error 400 (battle cannot be started)
           else Pending
               Service->>Redis: SETNX lock:battle:{battleId}:begin (TTL=5s)
               alt Lock not acquired
                   Service-->>Player: Error 409 (another request is starting)
               else Lock acquired
                   Service->>DB: listMembers(battleId)
                   Service->>Service: check authorization (initiator or owner)
                   alt Not authorized
                       Service-->>Player: Error 403 (not authorized)
                   else Authorized
                       Service->>DB: UPDATE battle (state=running, started=now)
                       Service->>Redis: SADD member:battle:{battleId} <playerId>
                       Service->>Redis: PUBLISH battle:begin { battleId }
                       Service-->>Player: Battle started
                   end
                   Service->>Redis: DEL lock:battle:{battleId}:begin (releaseLock)
               end
           end
       end
   ```
5. **Finish Battle**
   ```mermaid
   sequenceDiagram
       participant Player
       participant Service
       participant DB
       participant Redis
   
       Player->>Service: POST /battles/:id/finish
       Service->>DB: findById(battleId)
       alt not found
            DB-->>Service: null
            Service-->>Player: Error 404 (battle not found)
        else found
            alt not running
                DB-->>Service: state != running
                Service-->>Player: Error 400 (cannot finish)
            else running
                Service->>Service: check elapsed >= 60s (battle.started_at)
                alt too early
                    Service-->>Player: Error 400 (finish too soon)
                else valid
                    Service->>DB: listMembers(battleId)
                    Service->>Service: check authorization (initiator or owner)
                    alt not authorized
                        Service-->>Player: Error 403 (not authorized)
                    else authorized
                        Service->>DB: UPDATE battle.state = finished
                        Service->>Service: pick random winner + score
                        Service->>DB: UPSERT leaderboard (winnerGroupId, score, updatedAt)
                        Service->>Redis: ZINCRBY leaderboard:24h <score> <winnerGroupId>
                        Service->>Redis: PUBLISH battle:finished { battleId, winnerGroupId, score }
                        Service-->>Player: Battle finished
                    end
                end
        end
    end
   ```
</details>
