import type * as Party from "partykit/server";

interface RoomState {
  currentWord: string;
  isCycling: boolean;
  cycleSpeed: number;
  wordListFile: string;
  minSyllables: number;
  maxSyllables: number;
  hostId: string | null;
}

export default class RhymeNexusParty implements Party.Server {
  // Maps connection ID → Discord session user ID
  private connToUser = new Map<string, string>();
  // Ordered list of connected user IDs (for host reassignment)
  private joinOrder: string[] = [];
  // Reconnection grace: tracks the previous host for 30s after they disconnect
  private prevHostId: string | null = null;
  private prevHostLeftAt: number | null = null;

  private roomState: RoomState = {
    currentWord: "",
    isCycling: false,
    cycleSpeed: 10,
    wordListFile: "word-list.txt",
    minSyllables: 0,
    maxSyllables: 0,
    hostId: null,
  };

  constructor(readonly room: Party.Room) {}

  private getUserId(conn: Party.Connection, ctx?: Party.ConnectionContext): string {
    if (ctx) {
      return new URL(ctx.request.url).searchParams.get("userId") ?? conn.id;
    }
    return this.connToUser.get(conn.id) ?? conn.id;
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const userId = this.getUserId(conn, ctx);
    this.connToUser.set(conn.id, userId);

    const now = Date.now();
    const isReturningHost =
      this.prevHostId === userId &&
      this.prevHostLeftAt !== null &&
      now - this.prevHostLeftAt < 30_000;

    if (isReturningHost) {
      // Restore host within grace period
      this.roomState.hostId = userId;
      this.prevHostId = null;
      this.prevHostLeftAt = null;
      // Notify all existing clients that host has been restored
      this.room.broadcast(
        JSON.stringify({ type: "HOST_CHANGE", newHostId: userId }),
        [conn.id]
      );
    } else if (!this.roomState.hostId) {
      // No host — first to arrive becomes host
      // (Cloudflare Durable Objects process one connection at a time,
      //  so no simultaneous-join race condition is possible)
      this.roomState.hostId = userId;
    }

    if (!this.joinOrder.includes(userId)) {
      this.joinOrder.push(userId);
    }

    // Send full room state snapshot to the new connection
    conn.send(
      JSON.stringify({
        type: "ROOM_STATE",
        ...this.roomState,
        isHost: this.roomState.hostId === userId,
      })
    );
  }

  onClose(conn: Party.Connection) {
    const userId = this.getUserId(conn);
    this.connToUser.delete(conn.id);
    this.joinOrder = this.joinOrder.filter((id) => id !== userId);

    if (this.roomState.hostId === userId) {
      // Remember departing host for grace-period restore
      this.prevHostId = userId;
      this.prevHostLeftAt = Date.now();
      this.roomState.hostId = this.joinOrder[0] ?? null;

      this.room.broadcast(
        JSON.stringify({ type: "HOST_CHANGE", newHostId: this.roomState.hostId })
      );
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    const userId = this.getUserId(sender);
    // Silently reject any message from a non-host client
    if (userId !== this.roomState.hostId) return;

    const msg = JSON.parse(message) as Record<string, unknown>;

    switch (msg.type as string) {
      case "WORD_CHANGE":
        this.roomState.currentWord = msg.word as string;
        this.room.broadcast(
          JSON.stringify({ type: "WORD_CHANGE", word: msg.word })
        );
        break;

      case "CYCLE_STATE":
        this.roomState.isCycling = msg.isCycling as boolean;
        this.roomState.cycleSpeed = msg.cycleSpeed as number;
        this.room.broadcast(
          JSON.stringify({
            type: "CYCLE_STATE",
            isCycling: this.roomState.isCycling,
            cycleSpeed: this.roomState.cycleSpeed,
          })
        );
        break;

      case "SETTINGS_CHANGE": {
        if (msg.wordListFile !== undefined)
          this.roomState.wordListFile = msg.wordListFile as string;
        if (msg.minSyllables !== undefined)
          this.roomState.minSyllables = msg.minSyllables as number;
        if (msg.maxSyllables !== undefined)
          this.roomState.maxSyllables = msg.maxSyllables as number;
        // Re-broadcast as-is (msg already contains type field)
        this.room.broadcast(message);
        break;
      }

      case "HOST_TRANSFER": {
        const newHostId = msg.newHostId as string;
        if (this.joinOrder.includes(newHostId)) {
          this.roomState.hostId = newHostId;
          this.prevHostId = null;
          this.prevHostLeftAt = null;
          this.room.broadcast(
            JSON.stringify({ type: "HOST_CHANGE", newHostId })
          );
        }
        break;
      }
    }
  }
}
