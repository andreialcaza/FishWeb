type PeerDataConnection = {
  peer: string;
  open: boolean;
  on(event: "open", callback: () => void): void;
  on(event: "data", callback: (data: unknown) => void): void;
  on(event: "close" | "error", callback: (error?: Error) => void): void;
  send(data: unknown): void;
  close(): void;
};

type PeerClient = {
  id: string;
  on(event: "open", callback: (id: string) => void): void;
  on(event: "connection", callback: (connection: PeerDataConnection) => void): void;
  on(event: "error", callback: (error: Error) => void): void;
  connect(id: string, options: { reliable: boolean }): PeerDataConnection;
  destroy(): void;
};

declare global {
  interface Window { Peer?: new (id?: string, options?: object) => PeerClient; }
}

type RoomMessage =
  | { type: "hello"; name: string }
  | { type: "roster"; players: string[] }
  | { type: "leave" }
  | { type: "game"; sequence: number; payload: Record<string, unknown> }
  | { type: "game-request"; payload: Record<string, unknown> };

export interface MultiplayerCallbacks {
  status(message: string): void;
  roomCode(code: string): void;
  players(names: readonly string[]): void;
  gameMessage(payload: Record<string, unknown>): void;
  gameRequest(payload: Record<string, unknown>): void;
}

export class MultiplayerRoom {
  private peer?: PeerClient;
  private host = false;
  private readonly connections = new Map<string, PeerDataConnection>();
  private readonly names = new Map<string, string>();
  private name = "Player";
  private roomCodeValue = "";
  private nextGameSequence = 0;
  private lastGameSequence = 0;

  constructor(private readonly callbacks: MultiplayerCallbacks) {}

  async create(name: string): Promise<void> {
    this.reset();
    this.name = cleanName(name);
    if (!window.Peer) throw new Error("The multiplayer networking library did not load. Check your connection and reload.");
    this.host = true;
    this.callbacks.status("Creating room…");
    const id = "fishweb-" + randomCode();
    const peer = new window.Peer(id, { debug: 1 });
    this.peer = peer;
    await new Promise<void>((resolve, reject) => {
      peer.on("open", (openedId) => {
        this.roomCodeValue = openedId;
        this.callbacks.roomCode(openedId);
        this.callbacks.status("Room open. Share the room code with up to 3 friends.");
        this.publishRoster();
        resolve();
      });
      peer.on("connection", (connection) => this.accept(connection));
      peer.on("error", (error) => {
        this.callbacks.status(error.message || "Connection error.");
        reject(error);
      });
    });
  }

  async join(code: string, name: string): Promise<void> {
    this.reset();
    this.name = cleanName(name);
    const room = code.trim().toLowerCase();
    if (!/^fishweb-[a-z0-9-]{4,40}$/.test(room)) throw new Error("Enter a valid FishWeb room code.");
    if (!window.Peer) throw new Error("The multiplayer networking library did not load. Check your connection and reload.");
    this.host = false;
    this.callbacks.status("Joining room…");
    const peer = new window.Peer(undefined, { debug: 1 });
    this.peer = peer;
    await new Promise<void>((resolve, reject) => {
      peer.on("open", () => {
        const connection = peer.connect(room, { reliable: true });
        this.connections.set(room, connection);
        this.roomCodeValue = room;
        this.callbacks.roomCode(room);
        connection.on("open", () => {
          connection.send({ type: "hello", name: this.name } satisfies RoomMessage);
          this.callbacks.status("Connected. Waiting for the room host.");
          resolve();
        });
        connection.on("data", (data) => this.receive(data, connection));
        connection.on("close", () => this.callbacks.status("The room connection was closed."));
        connection.on("error", (error) => reject(error ?? new Error("Could not join that room.")));
      });
      peer.on("error", reject);
    });
  }

  leave(): void {
    this.broadcast({ type: "leave" });
    this.reset();
    this.callbacks.roomCode("");
    this.callbacks.players([]);
    this.callbacks.status("Not connected to a room.");
  }

  sendGame(payload: Record<string, unknown>): void {
    if (this.host) {
      this.broadcast({ type: "game", sequence: ++this.nextGameSequence, payload });
    } else {
      const connection = this.connections.get(this.roomCodeValue);
      if (connection?.open) connection.send({ type: "game-request", payload });
    }
  }

  get isHost(): boolean { return this.host; }
  get roomCode(): string { return this.roomCodeValue; }

  private accept(connection: PeerDataConnection): void {
    if (this.connections.size >= 3) {
      connection.close();
      return;
    }
    this.connections.set(connection.peer, connection);
    this.names.set(connection.peer, "Player");
    connection.on("data", (data) => this.receive(data, connection));
    connection.on("close", () => {
      this.connections.delete(connection.peer);
      this.names.delete(connection.peer);
      this.publishRoster();
    });
    connection.on("error", () => {
      this.connections.delete(connection.peer);
      this.names.delete(connection.peer);
      this.publishRoster();
    });
  }

  private receive(data: unknown, connection: PeerDataConnection): void {
    if (!data || typeof data !== "object" || !("type" in data)) return;
    const message = data as Partial<RoomMessage>;
    if (message.type === "hello" && this.host && typeof message.name === "string") {
      this.names.set(connection.peer, cleanName(message.name));
      this.publishRoster();
    } else if (message.type === "game-request" && this.host && message.payload && typeof message.payload === "object") {
      this.callbacks.gameRequest(message.payload as Record<string, unknown>);
    } else if (message.type === "game" && !this.host && message.payload && typeof message.payload === "object"
      && typeof message.sequence === "number" && Number.isSafeInteger(message.sequence)
      && message.sequence > this.lastGameSequence) {
      this.lastGameSequence = message.sequence;
      this.callbacks.gameMessage(message.payload as Record<string, unknown>);
    } else if (message.type === "leave" && this.host) {
      this.connections.delete(connection.peer);
      this.publishRoster();
    } else if (message.type === "roster" && !this.host && Array.isArray(message.players)) {
      const players = message.players.filter((player): player is string => typeof player === "string").slice(0, 4);
      this.callbacks.players(players);
      this.callbacks.status("Connected to room. Waiting for the host to start.");
    }
  }

  private publishRoster(): void {
    const players = [this.name, ...[...this.connections.keys()].map((id) => this.names.get(id) ?? "Player")].slice(0, 4);
    this.callbacks.players(players);
    this.broadcast({ type: "roster", players });
  }

  private broadcast(message: RoomMessage): void {
    for (const connection of this.connections.values()) {
      if (connection.open) connection.send(message);
    }
  }

  private reset(): void {
    for (const connection of this.connections.values()) connection.close();
    this.connections.clear();
    this.names.clear();
    this.peer?.destroy();
    this.peer = undefined;
    this.host = false;
    this.roomCodeValue = "";
    this.nextGameSequence = 0;
    this.lastGameSequence = 0;
  }
}

function cleanName(value: string): string {
  return value.trim().replace(/[<>]/g, "").slice(0, 18) || "Player";
}

function randomCode(): string {
  return Math.random().toString(36).slice(2, 8).padEnd(6, "0");
}
