import { Client } from 'https://cdn.jsdelivr.net/npm/@heroiclabs/nakama-js@2.8.0/+esm';

const client = new Client("defaultkey", "127.0.0.1", "7350");
client.useSSL = false;

let session = null;

// Initialize App
async function init() {
    const token = localStorage.getItem("nakama_token");
    if (token) {
        // Try to restore session
        session = { token }; 
        try {
            await refreshUI();
        } catch (e) {
            localStorage.removeItem("nakama_token");
            session = null;
        }
    }
}

async function refreshUI() {
    if (!session) {
        // If no session exists, ensure we show the logged-out state
        document.getElementById('logged-out-ui').classList.remove('hidden');
        document.getElementById('logged-in-ui').classList.add('hidden');
        document.getElementById('stats-summary').classList.add('hidden');
        document.getElementById('lobby-status').innerText = "Ready to start?";
        return;
    }

    try {
        // 1. Fetch the full account object from Nakama
        const account = await client.getAccount(session);
        const user = account.user;

        console.log(account);
        
        // 2. Determine if the user is a Guest or Pro (has an email linked)
        const isPro = account.email && account.email.length > 0;

        // 3. Update Header UI
        // Inside refreshUI(), update Step 3:
        const userDisplay = document.getElementById('user-display');

        // Check if email is verified in the Nakama account object
        const isVerified = account.verify_time && account.verify_time.length > 0;
        const verifyBadge = isVerified ? ' <span title="Verified Account" style="color:var(--neon-green); margin-left:5px;">✔</span>' : '';

        const guestBadge = isPro ? "" : ' <small style="color: #888; font-size: 0.7rem;">(GUEST)</small>';

        userDisplay.innerHTML = `${user.username}${verifyBadge}${guestBadge}`;
        

        // Toggle visibility of Auth groups
        document.getElementById('logged-out-ui').classList.add('hidden');
        document.getElementById('logged-in-ui').classList.remove('hidden');

        // 4. Update Main Lobby Hero text
        document.getElementById('lobby-status').innerText = isPro 
            ? `Welcome back, ${user.username}` 
            : `Playing as ${user.username}`;

        // 5. Fetch and Display Storage Data (Rank/Coins)
        // We look for the "profile" key in the "player_data" collection
        const storageResult = await client.readStorageObjects(session, {
            object_ids: [{
                collection: "player_data",
                key: "profile",
                user_id: user.id
            }]
        });

        const statsElement = document.getElementById('stats-summary');
        
        if (storageResult.objects.length > 0) {
            // Nakama JS SDK automatically parses the JSON string into an object
            const profile = storageResult.objects[0].value;
            
            statsElement.classList.remove('hidden');
            statsElement.innerHTML = `
                <span style="margin-right: 15px;">🏆 Rank: <b>${profile.rank_points || 0}</b></span>
                <span>💰 Coins: <b>${profile.coins || 0}</b></span>
            `;
        } else {
            // If no storage object exists yet (new account), show default values
            statsElement.classList.remove('hidden');
            statsElement.innerHTML = `🏆 Rank: 0 | 💰 Coins: 0`;
            console.log("No storage profile found. It will be created after the first match.");
        }

    } catch (e) {
        console.error("Failed to refresh UI:", e);
        // If the session is invalid (expired token), log them out
        if (e.status === 401) {
            logout();
        }
    }
}

function generateGuestName() {
    const adjectives = ["Swift", "Neon", "Cyber", "Silent", "Hyper"];
    const nouns = ["Typist", "Ghost", "Stroker", "Runner", "Void"];
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${randomNum}`;
}

async function quickPlay() {
    // 1. Always ensure we have a Device ID
    let deviceId = localStorage.getItem("nk_device_id");
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem("nk_device_id", deviceId);
    }

    try {
        // 2. Authenticate (This logs them back into their existing guest account if the deviceId matches)
        session = await client.authenticateCustom(deviceId, true);
        localStorage.setItem("nakama_token", session.token);

        // 3. Fetch account to check current username
        const account = await client.getAccount(session);
        
        /* CHECK: Does the username still have the auto-generated Nakama prefix?
           If yes, this is either a brand new user OR a guest who hasn't been named yet.
           If no, they already have their persistent custom name!
        */
        if (account.user.username.startsWith("nk-")) {
            const newName = generateGuestName();
            await client.updateAccount(session, { 
                username: newName, 
                display_name: newName 
            });
            console.log("New guest name generated and saved to server:", newName);
        } else {
            console.log("Welcome back guest:", account.user.username);
        }
        
        await refreshUI();
        
        // 4. Proceed to Matchmaking Socket
        //startMatchmaking();

    } catch (e) { 
        console.error("Guest Auth Failed", e); 
    }
}

async function submitAuth() {
    const modalTitle = document.getElementById('modal-title').innerText;
    const isSignUp = modalTitle === "Sign Up";
    
    const identifier = document.getElementById('login-id').value; // Username or Email
    const password = document.getElementById('login-password').value;
    const chosenUsername = document.getElementById('reg-username').value;

    try {
        if (isSignUp) {
            if (session) {
                await client.linkEmail(session, identifier, password);
                await client.updateAccount(session, { username: chosenUsername, display_name: chosenUsername });
                window.openVerifyModal();
            } else {
                session = await client.authenticateEmail(identifier, password, true, chosenUsername);
                window.openVerifyModal();
            }
        } else {
            // --- ADDED LOGIN LOGIC ---
            const emailParam = identifier.includes("@") ? identifier : "";
            const userParam = identifier.includes("@") ? "" : identifier;
            session = await client.authenticateEmail(emailParam, password, false, userParam);
        }

        localStorage.setItem("nakama_token", session.token);
        window.closeModal();
        await refreshUI();

    } catch (e) {
        alert("Auth Error: " + (e.message || "Check credentials"));
    }
}

// --- VERIFICATION LOGIC ---

// Helper to open/close the verify modal
window.openVerifyModal = () => document.getElementById('verify-modal').style.display = 'flex';
window.closeVerifyModal = () => {
    document.getElementById('verify-modal').style.display = 'none';
    // Clear inputs on close
    document.querySelectorAll('#code-inputs input').forEach(i => i.value = '');
};

// Handle Auto-Focusing of the 6 boxes
const codeInputs = document.querySelectorAll('#code-inputs input');
codeInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
        if (e.target.value.length === 1 && index < codeInputs.length - 1) {
            codeInputs[index + 1].focus(); 
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && index > 0) {
            codeInputs[index - 1].focus();
        }
    });
});

// The Submit Function
async function submitVerification() {
    const code = Array.from(codeInputs).map(i => i.value).join('');
    
    if (code.length !== 6) {
        alert("Please enter all 6 digits.");
        return;
    }

    try {
        const response = await client.rpc(session, "verify_email_code", { code: code });
        alert("Verification Successful! Rank and Rewards Unlocked.");
        window.closeVerifyModal();
        await refreshUI();
    } catch (e) {
        console.error("Verification failed", e);
        alert("Invalid code. Please check your email.");
        codeInputs.forEach(i => i.value = '');
        codeInputs[0].focus();
    }
}

// --- EVENT LISTENERS ---

document.getElementById('btn-quick-play').onclick = quickPlay;
document.getElementById('btn-submit-auth').onclick = submitAuth;
document.getElementById('btn-submit-verify').onclick = submitVerification;

// Close modals when clicking outside
window.onclick = (event) => {
    if (event.target.classList.contains('modal-overlay')) {
        event.target.style.display = 'none';
    }
};

window.openModal = () => {
    document.getElementById('auth-modal').style.display = 'flex';
};

window.closeModal = () => {
    document.getElementById('auth-modal').style.display = 'none';
};

window.logout = () => {
    localStorage.removeItem("nakama_token");
    window.location.reload();
};

// Initialize the app
init();