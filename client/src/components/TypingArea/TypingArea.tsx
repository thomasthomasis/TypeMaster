import React, { useState, useEffect, useRef } from 'react';
import { motion, useSpring } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';
import './TypingArea.css';

const CHARS_PER_LINE = 40;
const LINE_HEIGHT = 48; // px
const CHAR_WIDTH = 24;  // px


const generateWords = (count: number) => {
    const words = ["system", "override", "protocol", "breach", "uplink", "cipher", "neural", "proxy", "vortex", "storm"];
  return Array.from({ length: count }, () => words[Math.floor(Math.random() * words.length)]).join(" ") + " ";
}

interface CharacterProps {
  char: string;
  index: number;
  inputLength: number;
  stormPosition: number;
}

const Character = React.memo(
  ({ char, index, inputLength, stormPosition }: CharacterProps) => {
    const isBehindStorm = index < stormPosition;
    const isStormPosition = index === Math.floor(stormPosition);
    const isUserPosition = inputLength === index;
    const isTyped = index < inputLength;
    
    return (
      <span className={`char-base ${isTyped ? 'char-typed' : ''} ${isBehindStorm ? 'char-storm-haze' : ''}`}>
        {isUserPosition && <div className="user-caret" />}
        {isStormPosition && (
          <div 
            className="storm-caret" 
            style={{ 
              transform: `translateX(${(stormPosition % 1) * CHAR_WIDTH}px)` 
            }} 
          />
        )}
        {char}
      </span>
    );
  },
  // Custom comparison - only re-render if THIS character's state changed
  (prevProps, nextProps) => {
    const prevIsStormFloor = Math.floor(prevProps.stormPosition);
    const nextIsStormFloor = Math.floor(nextProps.stormPosition);
    
    // Check if this character is the storm position (needs sub-pixel updates)
    const prevIsStorm = prevIsStormFloor === prevProps.index;
    const nextIsStorm = nextIsStormFloor === nextProps.index;
    
    // If this is the storm character, check if fractional part changed significantly
    if (prevIsStorm || nextIsStorm) {
      if (prevIsStorm !== nextIsStorm) return false; // Storm moved to/from this char
      if (prevIsStorm && Math.abs(prevProps.stormPosition - nextProps.stormPosition) > 0.05) {
        return false; // Storm moved within this char
      }
    }
    
    const prevIsUser = prevProps.inputLength === prevProps.index;
    const nextIsUser = nextProps.inputLength === nextProps.index;
    const prevIsTyped = prevProps.index < prevProps.inputLength;
    const nextIsTyped = nextProps.index < nextProps.inputLength;
    const prevIsBehindStorm = prevProps.index < prevIsStormFloor;
    const nextIsBehindStorm = nextProps.index < nextIsStormFloor;
    
    // Only re-render if something about THIS character changed
    return (
      prevProps.char === nextProps.char &&
      prevIsUser === nextIsUser &&
      prevIsTyped === nextIsTyped &&
      prevIsBehindStorm === nextIsBehindStorm
    );
  }
);

Character.displayName = 'Character';

export const TypingArea = () => {
  // Selective Zustand subscriptions - only subscribe to what we need
  const stormPosition = useGameStore((state) => state.stormPosition);
  const stormSpeed = useGameStore((state) => state.stormSpeed);
  const stormDps = useGameStore((state) => state.stormDps);
  const isDead = useGameStore((state) => state.isDead);
  const matchTime = useGameStore((state) => state.matchTime);
  const wpm = useGameStore((state) => state.wpm);
  
  // Get actions (don't cause re-renders)
  const advanceStorm = useGameStore((state) => state.advanceStorm);
  const advanceMatch = useGameStore((state) => state.advanceMatch);
  const takeDamage = useGameStore((state) => state.takeDamage);

  const [text, setText] = useState(() => generateWords(200));
  const [completedChars, setCompletedChars] = useState(0);
  const [input, setInput] = useState("");

  const translateY = useSpring(0, { stiffness: 200, damping: 30 });
  const lastStormUpdate = useRef(0);
  const lastMatchUpdate = useRef(0);

  // Single optimized game loop
  useEffect(() => {
    if (isDead) return;

    let animationFrameId: number;

    const gameLoop = (timestamp: number) => {
      // Update storm position and check damage (every 100ms = 10fps)
      if (timestamp - lastStormUpdate.current >= 100) {
        advanceStorm();
        
        const totalProgress = completedChars + input.length; // Calculate here
        // Batch damage check with storm update
        if (stormPosition >= totalProgress  && matchTime >= 5) {
          takeDamage(stormDps / 10);
        }
        
        lastStormUpdate.current = timestamp;
      }

      // Update match time (every 1000ms)
      if (timestamp - lastMatchUpdate.current >= 1000) {
        advanceMatch();
        lastMatchUpdate.current = timestamp;
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => cancelAnimationFrame(animationFrameId);
  }, [isDead, advanceStorm, advanceMatch, takeDamage, stormPosition, input.length, matchTime, stormDps]);

  // Vertical Centering Logic
  useEffect(() => {
    const currentChar = completedChars + input.length;
    const currentLine = Math.floor(currentChar / CHARS_PER_LINE);

    if (currentLine >= 3) {
      translateY.set(-(currentLine - 3) * LINE_HEIGHT);
    } else {
      translateY.set(0);
    }
  }, [completedChars, input.length, translateY]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDead) return;

    const val = e.target.value;

    const expectedText = text.substring(completedChars, completedChars + val.length)

    if (val === expectedText) {
      setInput(val);

      const WINDOW_SIZE = 100;
      if(val.length > WINDOW_SIZE) {
        const charsToShift = val.length - WINDOW_SIZE;
        setCompletedChars(prev => prev + charsToShift);
        setInput(val.substring(charsToShift))
      }
    }
  };

  // Virtual scrolling - only render visible characters
  const totalProgress = completedChars + input.length;
  const currentLine = Math.floor(totalProgress / CHARS_PER_LINE);
  const bufferLines = 3; // Lines above viewport
  const forwardLines = 7; // Lines below viewport (show more ahead)
  
  const startLine = Math.max(0, currentLine - bufferLines);
  const endLine = currentLine + forwardLines;
  
  const startChar = startLine * CHARS_PER_LINE;
  const endChar = Math.min(text.length, endLine * CHARS_PER_LINE);
  
  const visibleText = text.slice(startChar, endChar);

  return (
      <div className="typing-area-window multi-row">
        {/* Stats Overlay */}
        <div className="storm-stats">
          <span>STORM SPEED: <b className="red-text">{Math.round(stormSpeed)}</b> CPM</span>
          <span>STORM DPS: <b className="red-text">{stormDps.toFixed(1)}</b></span>
          <span>WPM: <b className="cyan-text">{wpm}</b></span>
          <span>PROGRESS: <b className="cyan-text">{totalProgress}</b></span>
        </div>

        <input className="invisible-input" value={input} onChange={handleInput} autoFocus />

        <motion.div 
          className="text-canvas" 
          style={{ 
            y: translateY,
            paddingTop: `${startLine * LINE_HEIGHT}px` // Maintain scroll position for hidden chars
          }}
        >
          {visibleText.split("").map((char, i) => {
            const actualIndex = startChar + i;
            return (
              <Character 
                key={actualIndex} 
                char={char} 
                index={actualIndex} 
                inputLength={totalProgress}
                stormPosition={stormPosition}
              />
            );
          })}
        </motion.div>
        
        <div className="typing-vignette" />
        {isDead && <div className="death-screen">ELIMINATED BY THE STORM</div>}
      </div>
  );
};