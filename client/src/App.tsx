import { GameContainer } from "./components/GameContainer/GameContainer";
import { HealthBar } from "./components/HealthBar/HealthBar";
import { TypingArea } from "./components/TypingArea/TypingArea";
import { useGameStore } from "./store/useGameStore";
import "./App.css";

function App() {

  const health = useGameStore((state) => state.health);

  return (
    <div className="game-root">
      {/* Left Gutter: Targets */}
      <aside className="col-span-2 border-r border-gray-800 p-4">
        <h3 className="text-cyan-500 font-bold mb-4">OPPONENTS</h3>
        {/* Opponent list here */}
      </aside>

      {/* Center: The Battle Zone */}
      <main className="center-view">
        <GameContainer>
          <HealthBar health={health} />
          
          <div className="spacer" style={{ height: '40px' }} />

          <TypingArea />
        </GameContainer>
      </main>

      {/* Right Gutter: Log */}
      <aside className="col-span-2 border-l border-gray-800 p-4">
        <h3 className="text-red-500 font-bold mb-4">MATCH LOG</h3>
      </aside>
    </div>
  );
}

export default App;