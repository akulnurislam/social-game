# Social Game API Documentation

This document describes the REST API for the Social Game backend.  
You can also explore and test the API using the following collections:

- [Postman Collection](./social-game-postman.json)
- [Bruno Collection](./social-game-bruno.json)

## Authentication

All endpoints (except **Create Player**) require a header:
- `X-Player-ID`: <player_uuid>
  - Only a valid **UUID** is needed as authentication for simplicity.
  - The server will use this UUID to identify and authorize the player.
  - No additional token or password is required.

## REST API Endpoints

### Players

<details>
<summary>Endpoints for managing players.</summary>

- **Create Player**

  ```
  curl --request POST \
    --url http://localhost:3000/players \
    --header 'content-type: application/json' \
    --data '{
    "username": "John",
    "telegram_id": "1000000001"
  }'
  ```

  Example Response:

  ```
  {
    "id": "21fc47fe-854d-4319-a357-153edc8955a9",
    "telegram_id": "1000000001",
    "username": "John",
    "created_at": "2025-09-13T16:44:47.784Z"
  }
  ```

- **Get My Player**

  ```
  curl --request GET \
    --url http://localhost:3000/players/me \
    --header 'X-Player-ID: <PlayerID>'
  ```

  Example Response:

  ```
  {
    "id": "21fc47fe-854d-4319-a357-153edc8955a9",
    "telegram_id": "1000000001",
    "username": "John",
    "created_at": "2025-09-13T16:44:47.784Z"
  }
  ```

</details>

### Groups

<details>
<summary>Endpoints for creating and managing player groups.</summary>

- **Create Group**

  ```
  curl --request POST \
    --url http://localhost:3000/groups \
    --header 'content-type: application/json' \
    --header 'X-Player-ID: <PlayerID>' \
    --data '{
    "name": "John Group"
  }'
  ```

  Example Response:

  ```
  {
    "id": "ac9c959e-4539-4eea-ba00-b290c0720486",
    "name": "John Group",
    "owner": "21fc47fe-854d-4319-a357-153edc8955a9",
    "meta": {},
    "created_at": "2025-09-13T16:54:55.010Z"
  }
  ```

- **List Groups**

  ```
  curl --request GET \
    --url http://localhost:3000/groups \
    --header 'X-Player-ID: <PlayerID>'
  ```

  Example Response:

  ```
  [
    {
      "id": "ac9c959e-4539-4eea-ba00-b290c0720486",
      "name": "John Group",
      "owner": "21fc47fe-854d-4319-a357-153edc8955a9",
      "meta": {},
      "created_at": "2025-09-13T16:54:55.010Z"
    }
  ]
  ```

- **Get Group Info**

  ```
  curl --request GET \
    --url http://localhost:3000/groups/<GroupID> \
    --header 'X-Player-ID: <PlayerID>'
  ```

  Example Response:

  ```
  {
    "id": "ac9c959e-4539-4eea-ba00-b290c0720486",
    "name": "John Group",
    "owner": "21fc47fe-854d-4319-a357-153edc8955a9",
    "meta": {},
    "created_at": "2025-09-13T16:54:55.010Z"
  }
  ```

- **Join Group**

  ```
  curl --request POST \
    --url http://localhost:3000/groups/<GroupID>/join \
    --header 'X-Player-ID: <PlayerID>'
  ```

  Example Response:

  ```
  {
    "message": "Joined group successfully"
  }
  ```

- **Leave Group**

  ```
  curl --request POST \
    --url http://localhost:3000/groups/<GroupID>/leave \
    --header 'X-Player-ID: <PlayerID>'
  ```

  Example Response:

  ```
  {
    "message": "Left group successfully"
  }
  ```

- **List Group Members**

  ```
  curl --request GET \
    --url http://localhost:3000/groups/<GroupID>/members \
    --header 'X-Player-ID: <PlayerID>'
  ```

  Example Response:

  ```
  [
    {
      "player_id": "21fc47fe-854d-4319-a357-153edc8955a9",
      "role": "owner",
      "joined_at": "2025-09-13T16:54:55.010Z"
    }
  ]
  ```

</details>

### Battles

<details>
<summary>Endpoints for managing battles between groups.</summary>

- **Create Battle**

  ```
  curl --request POST \
    --url http://localhost:3000/battles \
    --header 'content-type: application/json' \
    --header 'X-Player-ID: <PlayerID>' \
    --data '{
    "group_attacker": "ac9c959e-4539-4eea-ba00-b290c0720486",
    "group_defender": "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
  }'
  ```

  Example Response:

  ```
  {
    "id": "1bfaa114-d44d-4149-a804-04839826e274",
    "group_attacker": "ac9c959e-4539-4eea-ba00-b290c0720486",
    "group_defender": "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "state": "pending",
    "meta": {
      "mode": "classic"
    },
    "started_at": null,
    "finished_at": null,
    "created_at": "2025-09-13T17:06:14.326Z"
  }
  ```

- **Join Battle**

  ```
  curl --request POST \
    --url http://localhost:3000/battles/<BattleID>/join \
    --header 'X-Player-ID: <PlayerID>'
  ```

  Example Response:

  ```
  {
    "message": "Already joined"
  }
  ```

- **Begin Battle**

  ```
  curl --request POST \
    --url http://localhost:3000/battles/<BattleID>/begin \
    --header 'X-Player-ID: <PlayerID>'
  ```

  Example Response:

  ```
  {
    "id": "1bfaa114-d44d-4149-a804-04839826e274",
    "group_attacker": "ac9c959e-4539-4eea-ba00-b290c0720486",
    "group_defender": "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "state": "running",
    "meta": {
      "mode": "classic"
    },
    "started_at": "2025-09-13T17:11:45.808Z",
    "finished_at": null,
    "created_at": "2025-09-13T17:06:14.326Z"
  }
  ```

- **Finish Battle**

  ```
  curl --request POST \
    --url http://localhost:3000/battles/<BattleID>/finish \
    --header 'X-Player-ID: <PlayerID>'
  ```

  Example Response:

  ```
  {
    "id": "1bfaa114-d44d-4149-a804-04839826e274",
    "group_attacker": "ac9c959e-4539-4eea-ba00-b290c0720486",
    "group_defender": "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    "state": "finished",
    "meta": {
      "mode": "classic"
    },
    "started_at": "2025-09-13T17:11:45.808Z",
    "finished_at": "2025-09-13T17:14:16.845Z",
    "created_at": "2025-09-13T17:06:14.326Z"
  }
  ```

- **List Battle Members**

  ```
  curl --request GET \
    --url http://localhost:3000/battles/<BattleID>/members \
    --header 'X-Player-ID: <PlayerID>'
  ```

  Example Response:

  ```
  [
    {
      "battle_id": "1bfaa114-d44d-4149-a804-04839826e274",
      "player_id": "21fc47fe-854d-4319-a357-153edc8955a9",
      "role": "initiator",
      "joined_at": "2025-09-13T17:06:14.330Z"
    },
    {
      "battle_id": "1bfaa114-d44d-4149-a804-04839826e274",
      "player_id": "11111111-1111-1111-1111-111111111111",
      "role": "participant",
      "joined_at": "2025-09-13T17:06:14.330Z"
    }
  ]
  ```

</details>

### Leaderboards

<details>
<summary>Endpoints for viewing game leaderboards.</summary>

- **List Leaderboard**

  ```
  curl --request GET \
    --url http://localhost:3000/leaderboards \
    --header 'X-Player-ID: <PlayerID>'
  ```

  Example Response:

  ```
  [
    {
      "id": "ec494fb3-744c-4616-9037-f4281d3e3543",
      "group_id": "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "score": "158",
      "updated_at": "2025-09-13T16:00:54.703Z"
    },
    {
      "id": "de48a14b-88b1-40a3-9ed8-dff0252a5cf1",
      "group_id": "bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "score": "63",
      "updated_at": "2025-09-13T16:02:34.482Z"
    }
  ]
  ```

</details>
