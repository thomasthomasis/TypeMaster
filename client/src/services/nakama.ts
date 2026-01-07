import { Client, Session } from "@heroiclabs/nakama-js";

class NakamaService {
  private client: Client;
  private session: Session | null = null;

  constructor() {
    // Connect to Nakama server
    // "defaultkey" is the default server key
    // "localhost" is where Nakama is running
    // "7350" is the HTTP port
    this.client = new Client("defaultkey", "localhost", "7350");
    this.client.ssl = false; // No SSL for local development
  }

  async authenticate(deviceId: string): Promise<Session> {
    // Authenticate with a device ID (creates account if doesn't exist)
    this.session = await this.client.authenticateDevice(deviceId, true);
    console.log("Authenticated!", this.session);
    return this.session;
  }

  getClient(): Client {
    return this.client;
  }

  getSession(): Session | null {
    return this.session;
  }
}

// Export a single instance
export default new NakamaService();