import { Client, Session } from "@heroiclabs/nakama-js";
import type { Socket } from '@heroiclabs/nakama-js';

export type MatchDataUpdate = {
  opCode: number;
  payload: any;
}

class NakamaService {
  private static instance: NakamaService;
  private client: Client;
  private socket: Socket | null = null;
  private session: Session | null = null;

  // A Set of listeners to avoid duplicates automatically
  private listeners = new Set<(data: MatchDataUpdate) => void>();

  constructor() {
    this.client = new Client("defaultkey", "127.0.0.1", "7350", false);
  }

  public static getInstance(): NakamaService {
    if(!NakamaService.instance) {
      NakamaService.instance = new NakamaService();
    }

    return NakamaService.instance;
  }

  async authenticate(deviceId: string): Promise<Session> {
    try {
      console.log("Attempting to authenticate with device ID:", deviceId);

      this.session = await this.client.authenticateDevice(deviceId, true, deviceId);
      console.log("Authenticated successfully!", this.session);
      return this.session;
    } catch (error: any) {
      console.error("Authentication error:", error);
      throw error;
    }
  }

  async createSocket(): Promise<Socket> {
    if(!this.session) {
      throw new Error("Must authenticate before creating socket");
    }

    this.socket = this.client.createSocket(false);

    this.socket.onmatchdata = (result) => {
      const payload = JSON.parse(new TextDecoder().decode(result.data));

      // Notify all UI subscribers
      this.listeners.forEach(l => l({
        opCode: result.op_code,
        payload
      }));
    };

    await this.socket.connect(this.session, true);
    console.log("Socket connected!");
    return this.socket;
  }

  public subscribe(callback: (data: MatchDataUpdate) => void) {
    this.listeners.add(callback);

    // Return an unsubscribe function for easy React cleanup
    return () => this.listeners.delete(callback);
  }

  // Wrapper for sending data
  public sendMatchData(matchId: string, opCode: number, data: any) {
    if(!this.socket) return;

    const payload = new TextEncoder().encode(JSON.stringify(data));
    this.socket.sendMatchState(matchId, opCode, payload);
  }

  async createMatch(): Promise<string> {
    if(!this.socket) {
      throw new Error("Socket not connected");
    }

    // Create a match using our registered match handler
    const match = await this.socket.createMatch("typing99");
    console.log("Match created: ", match.match_id);
    return match.match_id;
  }

  async joinMatch(matchId: string): Promise<void> {
    if(!this.socket) {
      throw new Error("Socket not connected");
    }

    await this.socket.joinMatch(matchId);
    console.log("Joined match: ", matchId);
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  getClient(): Client {
    return this.client;
  }

  getSession(): Session | null {
    return this.session;
  }
}

// Export a single instance
export default NakamaService.getInstance();