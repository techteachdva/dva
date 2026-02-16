/**
 * Crystal Wizards WebRTC Signaling Server (PartyKit)
 * Implements the Godot WebRTC signaling protocol for lobby/matchmaking.
 *
 * Protocol: JSON messages with { type, id, data }
 * - 0 JOIN: join/create lobby (data = 6-letter room code)
 * - 1 ID: server assigns client ID (host=1, others=2,3,4)
 * - 2 PEER_CONNECT: new peer joined
 * - 3 PEER_DISCONNECT: peer left
 * - 4 OFFER, 5 ANSWER, 6 CANDIDATE: WebRTC relay (id = destination peer)
 * - 7 SEAL: host seals lobby (no new joins)
 *
 * Connect: wss://YOUR_PROJECT.partykit.dev/party/signaling/ROOM_CODE
 * Room code = 6-letter code (e.g. ABC123)
 */

import type * as Party from "partykit/server";

const CMD = {
  JOIN: 0,
  ID: 1,
  PEER_CONNECT: 2,
  PEER_DISCONNECT: 3,
  OFFER: 4,
  ANSWER: 5,
  CANDIDATE: 6,
  SEAL: 7,
} as const;

function protoMessage(type: number, id: number, data: string): string {
  return JSON.stringify({ type, id, data: data || "" });
}

type PeerState = { assignedId: number };

export default class SignalingServer implements Party.Server {
  // Map connection.id -> assigned numeric ID (1=host, 2,3,4=peers)
  peerIds: Map<string, number> = new Map();
  sealed: boolean = false;

  constructor(readonly room: Party.Room) {}

  getConnections(): Party.Connection[] {
    return Array.from(this.room.getConnections());
  }

  getAssignedId(connectionId: string): number {
    return this.peerIds.get(connectionId) ?? 0;
  }

  getConnectionByAssignedId(assignedId: number): Party.Connection | undefined {
    for (const [connId, id] of this.peerIds) {
      if (id === assignedId) {
        return this.getConnections().find((c) => c.id === connId);
      }
    }
    return undefined;
  }

  async onConnect(connection: Party.Connection) {
    const connections = this.getConnections();
    const isHost = connections.length <= 1;

    const assignedId = isHost ? 1 : this.peerIds.size + 1;
    this.peerIds.set(connection.id, assignedId);

    // Room ID is the lobby code (e.g. ABC123)
    const lobbyName = this.room.id;

    // Send JOIN confirmation with lobby name
    connection.send(protoMessage(CMD.JOIN, 0, lobbyName));
    // Send assigned ID
    connection.send(protoMessage(CMD.ID, assignedId, ""));

    // Notify existing peers about new peer
    for (const conn of connections) {
      if (conn.id !== connection.id) {
        conn.send(protoMessage(CMD.PEER_CONNECT, assignedId, ""));
        connection.send(protoMessage(CMD.PEER_CONNECT, this.getAssignedId(conn.id), ""));
      }
    }
  }

  async onMessage(message: string, sender: Party.Connection) {
    if (this.sealed) return;

    let json: { type?: number; id?: number; data?: string };
    try {
      json = JSON.parse(message);
    } catch {
      return;
    }

    const type = typeof json.type === "number" ? Math.floor(json.type) : -1;
    const id = typeof json.id === "number" ? Math.floor(json.id) : -1;
    const data = typeof json.data === "string" ? json.data : "";

    const senderId = this.getAssignedId(sender.id);

    if (type === CMD.SEAL) {
      if (senderId === 1) {
        this.sealed = true;
        for (const conn of this.getConnections()) {
          conn.send(protoMessage(CMD.SEAL, 0, ""));
        }
      }
      return;
    }

    if (type === CMD.OFFER || type === CMD.ANSWER || type === CMD.CANDIDATE) {
      const destId = id === 1 ? 1 : id;
      const dest = this.getConnectionByAssignedId(destId);
      if (dest) {
        dest.send(protoMessage(type, senderId, data));
      }
    }
  }

  async onClose(connection: Party.Connection) {
    const assignedId = this.peerIds.get(connection.id);
    this.peerIds.delete(connection.id);

    if (assignedId !== undefined) {
      for (const conn of this.getConnections()) {
        conn.send(protoMessage(CMD.PEER_DISCONNECT, assignedId, ""));
      }
    }
  }
}
