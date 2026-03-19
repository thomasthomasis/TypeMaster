import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { nakamaService } from "../../services/nakama";
import { useEffect, useRef, useState } from "react";
import { setAuth } from "../../store/authSlice";
import type { RootState } from "../../store/store";

export const DiscordCallback = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { session } = useSelector((state: RootState) => state.auth);
  const [searchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const hasTriggered = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');
    const verifier = sessionStorage.getItem('discord_verifier');

    console.log(code)
    console.log(verifier)

    const runAuth = async () => {
        if(hasTriggered.current || !code || !verifier) return;
        hasTriggered.current = true;
        setIsProcessing(true);

        try {
        let currentSession = session;

        // 1. If no session exists, create a Guest one first
        if (!currentSession) {
            console.log("Creating temporary Guest session...");
            currentSession = await nakamaService.authenticateGuest();
            // Update Redux so the rest of the app knows we are 'in'
            dispatch(setAuth({ session: currentSession, isGuest: true }));
        }

        // 2. Use the Guest session to exchange the Discord code
        console.log("Exchanging Discord code using Guest context...");
        const discordSession = await nakamaService.authenticateDiscord(
            code, 
            verifier, 
            currentSession
        );

        // 3. Upgrade to the permanent Discord session
        dispatch(setAuth({ session: discordSession, isGuest: false }));
        sessionStorage.removeItem('discord_code_verifier');
        navigate('/');
        
        } catch (err) {
        console.error("Auth Pipeline Failed:", err);
        setIsProcessing(false);
        hasTriggered.current = false;
        }
    };

    runAuth();
    }, [searchParams, session, dispatch, navigate]); // React will re-run once Guest session hits Redux

  return <div>initializing_secure_handshake...</div>;
};