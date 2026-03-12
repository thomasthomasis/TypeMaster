import { Client } from "@heroiclabs/nakama-js";

const client = new Client("defaultkey", "127.0.0.1", "7350")

async function runAuthTest() {
    console.log("--- 🧪 STARTING AUTH FLOW TEST ---");

    // Authenticate as guest
    const guestId = "test_guest_" + Math.random().toString(36).substring(7);
    let session = await client.authenticateCustom(guestId, true);
    console.log(`✅ Logged in as GUEST. UserID: ${session.user_id}`);

    // Earn some "guest" progress (simulate backend stats)
    // We'll call an RPC or just wait for the AfterAuthHook to create the profile
    console.log("⏳ Waiting for backend to initialize Guest Profile...");
    await new Promise(r => setTimeout(r, 1000));

    // Upgrade to an email account
    const email = `player_${Math.random().toString(36).substring(7)}@test.com`;
    const password = "password12345";

    try {
        await client.linkEmail(session, email, password);
        console.log(`✅ LINK SUCCESSFUL: Guest account linked to ${email}`);
    } catch (e) {
        console.error("❌ Link failed:", e);
        return;
    }

    // Verify persistence
    // We log out and log back in with the email to ensure the ID is the same
    console.log("🔄 Re-authenticating with Email to verify...");
    const newSession = await client.authenticateEmail(email, password, false);
    
    if (newSession.user_id === session.user_id) {
        console.log("🏆 TEST PASSED: Account preserved across upgrade!");
        console.log(`Final Profile: Email: ${email} | ID: ${newSession.user_id}`);
    } else {
        console.error("❌ TEST FAILED: UserID changed!");
    }
}

async function handleConversion(currentSession, email, password) {
    try {
        await client.linkEmail(currentSession, email, password);
        console.log("Success! Guest account upgraded to Email.")
        return currentSession;
    }
    catch(err) {
        if(err.status === 409) {
            console.log("Email already in use. Switching to existing account.")

            return await client.authenticateEmail(email, password, false);
        }

        throw err;
    }
}

runAuthTest();