'use client';

import { usePwa } from './pwa-provider';
import { X, Share, PlusSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function PwaIosPrompt() {
  const { isIosWithFallback, dismissIosPrompt } = usePwa();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {isIosWithFallback && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-20 left-4 right-4 z-50 p-4 bg-card border border-border rounded-xl shadow-2xl md:max-w-sm md:mx-auto md:left-auto md:bottom-6"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <h3 className="font-semibold text-foreground mb-1">Install Plaiz Copier</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Install this application on your home screen for quick and easy access.
              </p>
              
              <div className="flex items-center text-sm text-muted-foreground space-x-2">
                <span>Tap</span>
                <span className="p-1.5 bg-secondary rounded-md"><Share className="w-4 h-4 text-foreground" /></span>
                <span>then</span>
                <span className="p-1.5 bg-secondary rounded-md"><PlusSquare className="w-4 h-4 text-foreground" /></span>
                <span>Add to Home Screen</span>
              </div>
            </div>
            
            <button 
              onClick={dismissIosPrompt}
              className="p-2 -mr-2 -mt-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
