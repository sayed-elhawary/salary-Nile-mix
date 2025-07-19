import React from 'react';
import { motion } from 'framer-motion';

const LoadingSpinner = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 flex items-center justify-center z-50 bg-black/20 font-cairo"
  >
    <motion.div
      className="relative flex flex-col items-center justify-center bg-white p-8 rounded-full shadow-lg border border-blue-100"
      animate={{ scale: [1, 1.05, 1], rotate: 360 }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
    >
      <svg className="w-12 h-12" viewBox="0 0 50 50">
        <motion.circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="#60A5FA"
          strokeWidth="4"
          strokeDasharray="80 200"
          strokeLinecap="round"
        />
      </svg>
      <span className="mt-4 text-sm font-semibold text-blue-400">
        جارٍ التحميل...
      </span>
    </motion.div>
  </motion.div>
);

export default LoadingSpinner;
