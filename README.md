# social-game
## Project Structure
<details>
<summary>Structure</summary>

```
├── package.json
├── tsconfig.json
├── docker-compose.yml
├── .env.example
├── README.md
├── API.md
├── ARCHITECTURE.md
├── migrations
│   └── 001_init.sql
└── src
    ├── index.ts              # Entry point
    ├── server.ts             # API bootstrap (Express)
    ├── ws-server.ts          # WebSocket bootstrap
    ├── app.ts                # Express app setup (middlewares, routes)
    ├── migrate.ts            # Run migrations
    ├── error-handler.ts      # Centralized error handler
    │
    ├── core                  # Core infrastructure
    │   ├── db.ts             # Postgres pool/connection
    │   ├── redis.ts          # Redis pub/sub client
    │   └── ws.ts             # WebSocket setup & events
    │
    ├── exceptions            # Custom exceptions
    │   └── app-exception.ts  # Base exception
    │
    ├── middlewares           # Express middlewares
    │   └── authentication.ts # Auth middleware
    │
    ├── types                 # Shared types & augmentations
    │   └── express.d.ts      # Extend Express Request/Response types
    │
    └── modules               # Feature modules
        ├── player
        │   ├── player.ts            # Entity (interfaces, constants)
        │   ├── player.repository.ts # DB queries
        │   ├── player.service.ts    # Business logic
        │   ├── player.controller.ts # REST (Express routes)
        │   └── player.ws.ts         # WebSocket handlers
        │
        ├── group
        ├── battle
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
   - Prevent spamming of actions (join/attack/etc.)
   - Redis key: `rate:player:{playerId}:{action}`
   - Example: `rate:player:123:join`
   - Stores an increment counter with an expiry window (e.g., 10s).
   - If limit exceeded → `AppException('Too many actions', 429)`.
2. **Group Cooldowns**
   - Prevents groups from starting battles too frequently.
   - Redis key: `cd:group:{groupId}:battle`
   - Example: `cd:group:abc:battle`
   - Set with TTL (e.g., 60s) when a group creates a battle.
   - If another battle is requested before cooldown expires → `AppException('Group on cooldown', 429)`.
3. **Join Guards**
   - Prevents cheating in participant lists:
     - Cannot join a finished battle.
     - Cannot join both attacker & defender sides.
     - Cannot double-join the same battle.
   - Uses DB checks and Redis temporary markers
   - Redis key: `join:player:{battleId}:{playerId}`
   - Helps avoid race conditions in high-traffic environments.
4. **Start Locks**
   - Prevents concurrent race conditions where two players try to start the same battle simultaneously.
   - Redis key: `lock:battle:{battleId}:begin`
   - Uses **SETNX + TTL** (atomic lock).
   - If lock exists → `AppException('Battle is already being started', 409)`.
5. **Finish Guards**
   - Prevents finishing a battle too soon after starting (anti-abuse).
   - Enforce **minimum battle duration** (e.g., 30s).
   - Redis key: `meta:battle:{battleId}:started`
   - Checked before allowing finish.
</details>

<details>
<summary>Redis Key Naming Conventions</summary>

### Redis Key Naming Conventions

| Key pattern | Purpose | TTL |
| --- | --- | --- |
| `rate:player:{playerId}:{action}` | Per-player action rate limit | 10s |
| `cd:group:{groupId}:battle` | Group cooldown after starting battle | 60s |
| `join:player:{battleId}:{playerId}` | Temporary join marker | 5s |
| `lock:battle:{battleId}:begin` | Concurrency lock for beginBattle | 5s |
| `meta:battle:{battleId}:started` | Store battle start time | ∞ |
</details>

<details>
<summary>Implementation Flow</summary>

### Implementation Flow

1. **Battle Lifecycle**
   ```mermaid
   stateDiagram-v2
    [*] --> Pending
    Pending --> Running: beginBattle (lock acquired)
    Running --> Finished: finishBattle (>=30s elapsed)
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
    Service->>Redis: GET cd:group:{groupId}:battle
    alt Cooldown exists
     Redis-->>Service: TTL > 0
     Service-->>Player: Error (group on cooldown)
    else No cooldown
     Service->>Redis: SET cd:group:{groupId}:battle (TTL=60s)
     Service->>DB: INSERT battle
     Service->>DB: INSERT battle_members (creator as initiator)
     Service-->>Player: Battle created
    end
   ```
3. **Join Battle**
   ```mermaid
   sequenceDiagram
    participant Player
    participant Service
    participant Redis
    participant DB

    Player->>Service: POST /battles/:id/join
    Service->>DB: SELECT battle (check state)
    alt battle finished
     DB-->>Service: state=finished
     Service-->>Player: Error (cannot join finished battle)
    else
     Service->>Redis: SETNX join:player:{battleId}:{playerId}
     alt already joined
      Redis-->>Service: Key exists
      Service-->>Player: Error (duplicate join)
     else success
      Service->>DB: INSERT battle_members
      Service-->>Player: Joined battle
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
    Service->>Redis: SETNX lock:battle:{id}:begin
    alt lock exists
     Redis-->>Service: lock present
     Service-->>Player: Error (battle already started)
    else success
     Service->>DB: UPDATE battle.state = running
     Service->>Redis: HSET battle:{id} started=timestamp
     Service-->>Player: Battle started
    end
   ```
5. **Finish Battle**
   ```mermaid
   sequenceDiagram
    participant Player
    participant Service
    participant Redis
    participant DB

    Player->>Service: POST /battles/:id/finish
    Service->>DB: SELECT battle (check state)
    alt not running
     DB-->>Service: state != running
     Service-->>Player: Error (cannot finish)
    else running
     Service->>Redis: HGET battle:{id} started
     Service->>Service: check elapsed >= 30s
     alt too early
      Service-->>Player: Error (finish too soon)
     else valid
      Service->>DB: UPDATE battle.state = finished
      Service->>DB: UPDATE leaderboard (optional)
      Service-->>Player: Battle finished
     end
    end
   ```
</details>
