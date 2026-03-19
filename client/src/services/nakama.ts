import { Client, Session } from "@heroiclabs/nakama-js";
import { v4 as uuidv4 } from "uuid";

// Connection settings (replace with your server details)
const client = new Client("defaultkey", "127.0.0.1", "7350", false);

export const nakamaService = {
  client,

  authenticateGuest: async (): Promise<Session> => {
    let deviceId = localStorage.getItem('nakama_device_id');

    if(!deviceId) {
      deviceId = uuidv4();
      localStorage.setItem('nakama_device_id', deviceId);
    }

    const session = await client.authenticateDevice(deviceId, true);

    localStorage.setItem("nakama_token", session.token);
    return session;
  },

  // Authenticate and return a session
  authenticateEmail: async (email: string, password: string, isRegister: boolean): Promise<Session> => {

    const session = await client.authenticateEmail(email, password, isRegister);
    
    localStorage.setItem("nakama_token", session.token);
    localStorage.setItem("nakama_refresh_token", session.refresh_token);

    return session;
  },

  /**
   * GOOGLE AUTH: Exchange a Google ID Token for a Nakama Session.
   * You get the 'token' from the Google One Tap or Identity Services SDK.
   */
  authenticateGoogle: async (idToken: string, create: boolean = true): Promise<Session> => {
    const session = await client.authenticateGoogle(idToken, create);
    
    localStorage.setItem("nakama_token", session.token);
    localStorage.setItem("nakama_refresh_token", session.refresh_token);

    return session;
  },

  authenticateDiscord: async (code: string, verifier: string, currentSession?: Session | null): Promise<Session> => {
    console.group("--- NAKAMA_AUTH_SEQUENCE ---");
    console.log("01_INPUT_DATA:", { code: code?.substring(0, 5) + "...", verifier: verifier?.substring(0, 5) + "..." });

    try {
      const payload = { code, verifier };

      console.log("02_OUTGOING_PAYLOAD:", payload);

      const response = await client.rpc((currentSession ?? undefined) as any, "exchange_discord_code", payload);
      console.log("03_RAW_RPC_RESPONSE:", response);

      if (!response || !response.payload) {
        throw new Error("RPC_RESPONSE_OR_PAYLOAD_MISSING");
      }

      const rawPayload = response.payload;
      console.log("05_RAW_PAYLOAD_TYPE:", typeof rawPayload);


      let data;
      try {
        data = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
        console.log("06_PARSED_DATA_OBJECT:", data);
      } catch (parseErr) {
        console.error("06_FATAL: Failed to parse payload string:", rawPayload);
        throw parseErr;
      }

      if (!data || !data.token) {
        console.error("07_FATAL: Token missing in parsed data. Check Go backend output!");
        throw new Error("TOKEN_NOT_FOUND_IN_PAYLOAD");
      }

      console.log("08_INITIALIZING_SESSION_RESTORE: Using token:", data.token.substring(0, 10) + "...");


      const newSession = Session.restore(data.token, "");
      console.log("09_SUCCESS: Session Object Created:", newSession);

      localStorage.setItem("nakama_token", data.token)
      localStorage.removeItem("is_guest");
      console.groupEnd();
      return newSession;
    }
    catch(error) {
      console.error("--- AUTH_SEQUENCE_FAILED ---");
      console.error("ERROR_TYPE:", error instanceof Error ? error.message : "Unknown");
      console.error("FULL_ERROR_OBJECT:", error);
      console.groupEnd();
      throw error;
    }
  },

  /**
   * 
   * ACCOUNT UPGRADE: Links an email/password to the current session.
   * Use this when a "Guest" wants to become a permanent user.
   */
  linkEmail: async (session: Session, email: string, password: string) => {
    return await client.linkEmail(session, {
      email: email,
      password: password
    });
  },

  // Get current user data
  getAccount: async (session: Session) => {
    return await client.getAccount(session);
  },
  
  // Use this to restore a session from localStorage on refresh
  restoreSession: () => {
    const token = localStorage.getItem("nakama_token");
    const refreshToken = localStorage.getItem("nakama_refresh_token");
    
    if (!token || !refreshToken) {
      console.log("No tokens found!")
      return null;
    }

    try {
      return Session.restore(token, refreshToken);
    }
    catch(e) {
      return null;
    }
  }
};