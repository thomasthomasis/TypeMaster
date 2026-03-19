import { Client, Session } from "@heroiclabs/nakama-js";

// Connection settings (replace with your server details)
const client = new Client("defaultkey", "127.0.0.1", "7350", false);

export const nakamaService = {
  client,

  // Authenticate and return a session
  authenticate: async (email: string, password: string, isRegister: boolean): Promise<Session> => {

    const session = await client.authenticateEmail(email, password, isRegister);
    
    localStorage.setItem("nakama_token", session.token);
    localStorage.setItem("nakama_refresh_token", session.refresh_token);

    return session;
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

    return Session.restore(token, refreshToken);
  }
};