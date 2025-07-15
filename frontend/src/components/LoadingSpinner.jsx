import React from 'react';
import { motion } from 'framer-motion';

const LoadingSpinner = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 flex items-center justify-center z-50 bg-black/30"
  >
    <motion.div
      className="relative flex items-center justify-center"
      animate={{ rotate: 360 }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
    >
      <svg className="w-16 h-16" viewBox="0 0 50 50">
        <motion.circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="#06B6D4"
          strokeWidth="4"
          strokeDasharray="80 200"
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-sm font-medium text-teal-600 font-amiri">
        جارٍ التحميل
      </span>
    </motion.div>
  </motion.div>
);

export default LoadingSpinner;
