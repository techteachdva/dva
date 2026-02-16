# Crystal Wizards WebRTC Signaling (PartyKit)

WebSocket signaling server for Godot WebRTC multiplayer. Relays offers, answers, and ICE candidates between peers.

## Deploy

```bash
npm install
npx partykit deploy
```

After deploy, note the URL (e.g. `wss://crystal-wizards-signaling.partykit.dev/party/main`). The game uses this as the signaling base URL; room codes are appended (e.g. `.../party/main/ABC123`).

## Protocol

Implements the Godot WebRTC signaling protocol (JSON): JOIN, ID, PEER_CONNECT, PEER_DISCONNECT, OFFER, ANSWER, CANDIDATE, SEAL.
