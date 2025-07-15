import React from 'react';
import { motion } from 'framer-motion';

const SuccessCheckmark = ({ onComplete }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.5 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.5 }}
    onAnimationComplete={onComplete}
    className="fixed inset-0 flex items-center justify-center z-50 bg-black/30"
  >
    <motion.div
      animate={{
        scale: [1, 1.1, 1],
        transition: { duration: 1.5, repeat: Infinity, repeatType: 'loop' },
      }}
      className="relative w-20 h-20"
    >
      <svg className="w-full h-full text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <motion.path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          d="M5 13l4 4L19 7"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1, transition: { duration: 0.8 } }}
        />
      </svg>
    </motion.div>
  </motion.div>
);

export default SuccessCheckmark;
