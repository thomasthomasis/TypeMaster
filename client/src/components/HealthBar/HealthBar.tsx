import React from "react";
import { motion } from "framer-motion";
import "./HealthBar.css";

interface HealthBarProps {
    health: number;
}

export const HealthBar = ({ health }: HealthBarProps) => {

    const getHpColor = (hp: number) => {
        if (hp > 60) return "rgb(34, 197, 94)";
        if (hp > 30) return "rgb(234, 179, 8)";

        return "rgb(239, 68, 68)";
    };

    return (
    <div className="health-hud-container">
      <div className="health-label-row">
        <span>Vitality</span>
        <span>{health}%</span>
      </div>

      <div className="health-bar-track">
      {/* GHOST BAR: Slower transition than the main bar */}
      <motion.div
        className="health-bar-ghost"
        animate={{ width: `${health}%` }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
      />

      {/* MAIN BAR: Fast, snappy transition */}
      <motion.div
        className="health-bar-fill"
        style={{ zIndex: 2, position: 'relative' }}
        animate={{ width: `${health}%`, backgroundColor: getHpColor(health) }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      />
    </div>
    </div>
  );
}