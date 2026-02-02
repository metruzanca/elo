export type SSEEventType =
  | "play_session_invite"
  | "player_joined"
  | "player_left"
  | "match_started"
  | "match_ended"
  | "elo_update"
  | "play_session_ended";

export interface SSEEvent {
  type: SSEEventType;
  data: any;
}

export interface SSEClient {
  id: string;
  userId: number;
  playSessionId?: number;
  matchId?: number;
  send: (event: SSEEvent) => void;
  close: () => void;
}

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private playSessionClients: Map<number, Set<string>> = new Map();
  private matchClients: Map<number, Set<string>> = new Map();

  addClient(client: SSEClient) {
    this.clients.set(client.id, client);

    if (client.playSessionId) {
      if (!this.playSessionClients.has(client.playSessionId)) {
        this.playSessionClients.set(client.playSessionId, new Set());
      }
      this.playSessionClients.get(client.playSessionId)!.add(client.id);
    }

    if (client.matchId) {
      if (!this.matchClients.has(client.matchId)) {
        this.matchClients.set(client.matchId, new Set());
      }
      this.matchClients.get(client.matchId)!.add(client.id);
    }
  }

  removeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (client.playSessionId) {
      const sessionClients = this.playSessionClients.get(client.playSessionId);
      if (sessionClients) {
        sessionClients.delete(clientId);
        if (sessionClients.size === 0) {
          this.playSessionClients.delete(client.playSessionId);
        }
      }
    }

    if (client.matchId) {
      const matchClients = this.matchClients.get(client.matchId);
      if (matchClients) {
        matchClients.delete(clientId);
        if (matchClients.size === 0) {
          this.matchClients.delete(client.matchId);
        }
      }
    }

    this.clients.delete(clientId);
  }

  broadcastToPlaySession(playSessionId: number, event: SSEEvent) {
    const clientIds = this.playSessionClients.get(playSessionId);
    if (!clientIds) return;

    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client) {
        try {
          client.send(event);
        } catch (error) {
          // Client disconnected, remove it
          this.removeClient(clientId);
        }
      }
    }
  }

  broadcastToMatch(matchId: number, event: SSEEvent) {
    const clientIds = this.matchClients.get(matchId);
    if (!clientIds) return;

    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client) {
        try {
          client.send(event);
        } catch (error) {
          // Client disconnected, remove it
          this.removeClient(clientId);
        }
      }
    }
  }

  broadcastToUser(userId: number, event: SSEEvent) {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.userId === userId) {
        try {
          client.send(event);
        } catch (error) {
          this.removeClient(clientId);
        }
      }
    }
  }

  getClientCount(playSessionId?: number, matchId?: number): number {
    if (playSessionId) {
      return this.playSessionClients.get(playSessionId)?.size || 0;
    }
    if (matchId) {
      return this.matchClients.get(matchId)?.size || 0;
    }
    return this.clients.size;
  }
}

export const sseManager = new SSEManager();
