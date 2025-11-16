"use client";

import { AlertTriangle, Maximize } from "lucide-react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";

interface FullscreenExitWarningProps {
  exitCount: number;
  onEnterFullscreen: () => void;
}

export default function FullscreenExitWarning({ exitCount, onEnterFullscreen }: FullscreenExitWarningProps) {
  const [attemptedAuto, setAttemptedAuto] = useState(false);

  useEffect(() => {
    // Wait for automatic attempt to complete (1.5s + 0.5s buffer)
    const timer = setTimeout(() => {
      setAttemptedAuto(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-6 border-red-500 border-2 animate-in fade-in zoom-in duration-200">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center animate-pulse">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-500" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-500">
              ⚠️ Fullscreen Mode Required
            </h2>
            <p className="text-muted-foreground">
              You have exited fullscreen mode <span className="font-bold text-red-600">{exitCount} time{exitCount > 1 ? 's' : ''}</span>.
            </p>
            <p className="text-sm text-muted-foreground">
              For proctoring purposes, you must remain in fullscreen mode throughout the interview.
              <span className="block mt-1 font-semibold text-red-600">The interviewer has been notified.</span>
            </p>
          </div>

          <div className="w-full space-y-3">
            <Button 
              onClick={onEnterFullscreen}
              size="lg"
              className="w-full bg-red-600 hover:bg-red-700 text-white animate-pulse"
            >
              <Maximize className="mr-2 h-5 w-5" />
              Click Here to Return to Fullscreen
            </Button>
            
            {!attemptedAuto && (
              <div className="text-xs text-muted-foreground">
                Attempting automatic re-entry...
              </div>
            )}
            
            {attemptedAuto && (
              <p className="text-xs text-yellow-600 dark:text-yellow-500">
                ⚠️ Due to browser security, you must click the button above to continue.
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

