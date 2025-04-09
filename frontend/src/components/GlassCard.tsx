import React from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import '../styles/card.css';

interface GlassCardProps {
  imageUrl: string;
  children?: React.ReactNode;
}

const GlassCard: React.FC<GlassCardProps> = ({ imageUrl, children }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-50, 50], [15, -15]);
  const rotateY = useTransform(x, [-50, 50], [-15, 15]);

  return (
    <motion.div
      className="glass-card-container card"
      style={{
        perspective: 1000,
      }}
    >
      <motion.div
        className="glass-card"
        style={{
          rotateX,
          rotateY,
          x,
          y,
        }}
        drag
        dragElastic={0.2}
        dragConstraints={{ top: -50, bottom: 50, left: -50, right: 50 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div
          className="glass-card-background"
          style={{
            backgroundImage: `url(${imageUrl})`,
          }}
        />
        <div className="glass-card-overlay">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default GlassCard;
