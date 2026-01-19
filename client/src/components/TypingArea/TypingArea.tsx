import React, { useState, useEffect, useMemo } from 'react';
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

export const TypingArea = () => {
  const { stormPosition, advanceStorm, advanceMatch, takeDamage, stormDps, stormSpeed, isDead, wpm } = useGameStore();
  const [text, setText] = useState(() => generateWords(200));
  const [input, setInput] = useState("");

  const translateY = useSpring(0);
  const translateX = useSpring(0);

  // Difficulty Scaling Loop
  useEffect(() => {
    if (isDead) return;
    const timer = setInterval(() => {
      advanceMatch();
      advanceStorm(stormSpeed);
    }, 1000);
    return () => clearInterval(timer);
  }, [isDead, stormSpeed]);

  // Centering Logic
  useEffect(() => {
    const currentChar = input.length;
    const currentLine = Math.floor(currentChar / CHARS_PER_LINE);
    const charInLine = currentChar % CHARS_PER_LINE;

    // Center at Row 4 (Index 3), Column 20
    if (currentLine >= 3) {
      translateY.set(-(currentLine - 3) * LINE_HEIGHT);
    }
    if (charInLine >= 20) {
      translateX.set(-(charInLine - 20) * CHAR_WIDTH);
    }
  }, [input.length]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDead) return; // KILL INPUT IF DEAD
    const val = e.target.value;
    if (val === text.substring(0, val.length)) {
      setInput(val);
    }
  };

  return (
    <div className="typing-area-window multi-row">
      {/* Stats Overlay */}
      <div className="storm-stats">
        <span>STORM SPEED: <b className="red-text">{Math.round(stormSpeed * 100)}</b></span>
        <span>STORM DPS: <b className="red-text">{stormDps.toFixed(1)}</b></span>
        <span>WPM: <b className="cyan-text">{wpm}</b></span>
      </div>

      <input className="invisible-input" value={input} onChange={handleInput} autoFocus />

      <motion.div className="text-canvas" style={{ x: translateX, y: translateY }}>
        {text.split("").map((char, i) => {
          const isBehindStorm = i < stormPosition;
          return (
            <span key={i} className={`char-base ${i < input.length ? 'char-typed' : ''} ${isBehindStorm ? 'char-storm-haze' : ''}`}>
              {input.length === i && <div className="user-caret" />}
              {Math.floor(stormPosition) === i && <div className="storm-caret" />}
              {char}
            </span>
          );
        })}
      </motion.div>
      
      <div className="typing-vignette" />
      {isDead && <div className="death-screen">ELIMINATED BY THE STORM</div>}
    </div>
  );
};