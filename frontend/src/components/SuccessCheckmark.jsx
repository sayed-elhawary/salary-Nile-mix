import React from 'react';
import { motion } from 'framer-motion';

const SuccessCheckmark = ({ onComplete }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.5 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.5 }}
    onAnimationComplete={onComplete}
    className="fixed inset-0 flex items-center justify-center z-50 bg-black/20 font-cairo"
  >
    <motion.div
      className="relative flex flex-col items-center justify-center bg-white p-8 rounded-full shadow-lg border border-green-100"
      animate={{
        scale: [1, 1.1, 1],
        transition: { duration: 1.5, repeat: 2, repeatType: 'loop' },
      }}
    >
      <svg className="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <motion.path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
          d="M5 13l4 4L19 7"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1, transition: { duration: 0.8 } }}
        />
      </svg>
      <motion.span
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0, transition: { delay: 0.5 } }}
        className="mt-4 text-sm font-semibold text-green-600"
      >
        تم بنجاح
      </motion.span>
    </motion.div>
  </motion.div>
);

export default SuccessCheckmark;
