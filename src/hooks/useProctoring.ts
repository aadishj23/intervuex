import { useEffect, useState, useCallback, useRef } from "react";
import { useCall, useCallStateHooks } from "@stream-io/video-react-sdk";
import toast from "react-hot-toast";

/**
 * Proctoring Hook for Interview Sessions
 * 
 * This hook provides screen detection and fullscreen management for proctoring.
 * It should ONLY be enabled for candidates, not interviewers.
 * 
 * Screen Detection Methods (in order of preference):
 * 1. Window Management API (getScreenDetails) - Most accurate, requires permission
 *    - Browser Support: Chrome 100+, Edge 100+ (with flag)
 *    - Detects exact number of screens
 * 
 * 2. Screen.isExtended - Good fallback for detecting multiple monitors
 *    - Browser Support: Chrome 100+, Edge 100+
 *    - Returns boolean for extended desktop
 * 
 * 3. Aspect Ratio Heuristic - Basic fallback
 *    - Works on all browsers
 *    - Detects unusually wide screens (> 3:1 aspect ratio) as likely multiple monitors
 * 
 * Requirements:
 * - Candidates must have EXACTLY 1 screen (not 2 or more)
 * - Candidates must remain in fullscreen throughout the interview
 * - Any fullscreen exit triggers warnings and auto re-entry
 */

interface ProctoringState {
  isFullscreen: boolean;
  screenCount: number;
  fullscreenExitCount: number;
  hasMultipleScreens: boolean;
}

interface UseProctoringOptions {
  enabled: boolean;
  onFullscreenExit?: (exitCount: number) => void;
}

export const useProctoring = ({ enabled, onFullscreenExit }: UseProctoringOptions = { enabled: true }) => {
  const call = useCall();
  const { useLocalParticipant } = useCallStateHooks();
  const localParticipant = useLocalParticipant();
  const [state, setState] = useState<ProctoringState>({
    isFullscreen: false,
    screenCount: 1,
    fullscreenExitCount: 0,
    hasMultipleScreens: false,
  });
  
  const fullscreenExitCountRef = useRef(0);
  const isEnteringFullscreenRef = useRef(false);

  // Detect number of screens
  const detectScreens = useCallback(async () => {
    try {
      console.log('=== Starting Screen Detection ===');
      
      // Method 1: Window Management API - Most accurate
      if ('getScreenDetails' in window) {
        try {
          console.log('Attempting Window Management API (getScreenDetails)...');
          // @ts-ignore - Screen Details API is experimental
          const screenDetails = await window.getScreenDetails();
          const screenCount = screenDetails.screens.length;
          const hasMultiple = screenCount > 1;
          
          console.log('✓ Window Management API succeeded:', { 
            screenCount, 
            hasMultiple,
            screens: screenDetails.screens 
          });
          
          setState(prev => ({
            ...prev,
            screenCount,
            hasMultipleScreens: hasMultiple,
          }));
          
          return { screenCount, hasMultiple };
        } catch (permissionError: any) {
          console.warn('✗ Window Management API failed:', permissionError.message);
          // Fall through to next method
        }
      } else {
        console.log('✗ Window Management API not available in this browser');
      }
      
      // Method 2: Screen.isExtended - Good for detecting extended desktop
      // Note: This is async in some browsers
      try {
        // @ts-ignore
        if (typeof window.screen.isExtended !== 'undefined') {
          console.log('Attempting screen.isExtended API...');
          // @ts-ignore
          let isExtended = window.screen.isExtended;
          
          // On some browsers, isExtended might be a promise
          if (isExtended instanceof Promise) {
            isExtended = await isExtended;
          }
          
          const hasMultiple = isExtended === true;
          const screenCount = hasMultiple ? 2 : 1;
          
          console.log('✓ screen.isExtended result:', { screenCount, hasMultiple, isExtended });
          
          setState(prev => ({
            ...prev,
            screenCount,
            hasMultipleScreens: hasMultiple,
          }));
          
          return { screenCount, hasMultiple };
        } else {
          console.log('✗ screen.isExtended not available');
        }
      } catch (e) {
        console.log('✗ screen.isExtended check failed:', e);
      }
      
      // Method 3: Check available screen dimensions vs current window
      const availWidth = window.screen.availWidth;
      const availHeight = window.screen.availHeight;
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const windowOuterWidth = window.outerWidth;
      
      console.log('Screen dimensions:', {
        availWidth,
        availHeight,
        screenWidth,
        screenHeight,
        windowOuterWidth,
      });
      
      // Method 4: Aspect ratio heuristic - Ultra-wide screens
      const aspectRatio = screenWidth / screenHeight;
      const isUltraWide = aspectRatio > 2.5; // Lower threshold from 3.0
      
      console.log('Aspect ratio check:', {
        aspectRatio: aspectRatio.toFixed(2),
        isUltraWide,
        threshold: 2.5
      });
      
      // Method 5: Check if screen is much wider than typical laptop/desktop
      // Most single monitors are between 1.3:1 (4:3) and 2.4:1 (21:9 ultrawide)
      // Anything beyond 2.5:1 is likely multiple monitors
      const isSuspiciouslyWide = aspectRatio > 2.5;
      
      // Method 6: Try to detect via mediaDevices (displays with different capabilities)
      let hasMultipleFromMedia = false;
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter(d => d.kind === 'videoinput');
          console.log('Video input devices:', videoInputs.length);
        }
      } catch (e) {
        console.log('Could not enumerate media devices');
      }
      
      const hasMultiple = isSuspiciouslyWide;
      const screenCount = hasMultiple ? 2 : 1;
      
      console.log('Final detection result (heuristic):', { 
        screenCount,
        hasMultiple,
        method: 'aspect-ratio-heuristic'
      });
      
      setState(prev => ({
        ...prev,
        screenCount,
        hasMultipleScreens: hasMultiple,
      }));
      
      return { screenCount, hasMultiple };
      
    } catch (error) {
      console.error("Error detecting screens:", error);
      // Conservative approach: if we can't detect, assume unsafe (multiple screens)
      console.warn('⚠️ Detection failed completely - defaulting to BLOCKING for safety');
      setState(prev => ({
        ...prev,
        screenCount: 2,
        hasMultipleScreens: true,
      }));
      return { screenCount: 2, hasMultiple: true };
    }
  }, []);

  // Request fullscreen
  const enterFullscreen = useCallback(async () => {
    if (!enabled) {
      console.log('🚫 Fullscreen request blocked - proctoring not enabled');
      return;
    }
    
    // Check if already in fullscreen
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).msFullscreenElement
    );
    
    if (isCurrentlyFullscreen) {
      console.log('✓ Already in fullscreen mode');
      return true;
    }
    
    try {
      console.log('🔄 Attempting to enter fullscreen...');
      isEnteringFullscreenRef.current = true;
      const elem = document.documentElement;
      
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
        console.log('✓ Fullscreen entered (standard API)');
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
        console.log('✓ Fullscreen entered (webkit API)');
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen();
        console.log('✓ Fullscreen entered (ms API)');
      }
      
      // Reset flag after a delay
      setTimeout(() => {
        isEnteringFullscreenRef.current = false;
      }, 1000);
      
      return true;
    } catch (error: any) {
      console.error("❌ Error entering fullscreen:", error.message || error);
      isEnteringFullscreenRef.current = false;
      return false;
    }
  }, [enabled]);

  // Exit fullscreen
  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
    } catch (error) {
      console.error("Error exiting fullscreen:", error);
    }
  }, []);

  // Send custom event to notify other participants
  const notifyFullscreenExit = useCallback(async (exitCount: number) => {
    if (!call) return;
    
    try {
      // Get user info from local participant
      const userId = localParticipant?.userId || call.state.localParticipant?.userId;
      const userName = localParticipant?.name || call.state.localParticipant?.name || 'A participant';
      
      console.log('Sending fullscreen exit event:', { userId, userName, exitCount });
      
      // Send custom event through Stream's sendCustomEvent
      // Stream's sendCustomEvent accepts an object that will be sent to all participants
      const customEvent = {
        type: 'fullscreen_exit',
        exitCount,
        timestamp: Date.now(),
        userId,
        userName,
      };
      
      console.log('📤 Sending fullscreen exit event:', customEvent);
      console.log('Call state:', { callId: call.id, participants: Object.keys(call.state.participants || {}) });
      
      try {
        await call.sendCustomEvent(customEvent);
        console.log('✅ Fullscreen exit event sent successfully');
      } catch (sendError: any) {
        console.error('❌ Error sending custom event:', sendError);
        console.error('Error details:', {
          message: sendError.message,
          stack: sendError.stack,
          error: sendError
        });
      }
    } catch (error) {
      console.error("Error sending fullscreen exit event:", error);
    }
  }, [call, localParticipant]);

  // Handle fullscreen change
  useEffect(() => {
    if (!enabled) return;

    const handleFullscreenChange = () => {
      const isNowFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement
      );

      console.log('🔔 Fullscreen change detected:', { 
        isNowFullscreen, 
        isEnteringProgrammatically: isEnteringFullscreenRef.current 
      });

      setState(prev => ({ ...prev, isFullscreen: isNowFullscreen }));

      // If exiting fullscreen (and not programmatically entering)
      if (!isNowFullscreen && !isEnteringFullscreenRef.current) {
        fullscreenExitCountRef.current += 1;
        
        console.warn(`⚠️ User exited fullscreen! Exit count: ${fullscreenExitCountRef.current}`);
        
        setState(prev => ({
          ...prev,
          fullscreenExitCount: fullscreenExitCountRef.current,
        }));

        // Notify callback
        if (onFullscreenExit) {
          onFullscreenExit(fullscreenExitCountRef.current);
        }

        // Send notification to other participants
        notifyFullscreenExit(fullscreenExitCountRef.current);

        // Show warning
        toast.error(
          `⚠️ Warning: You exited fullscreen mode! Click to return. (${fullscreenExitCountRef.current} time${
            fullscreenExitCountRef.current > 1 ? 's' : ''
          })`,
          { duration: 10000 }
        );

        // Note: We cannot automatically re-enter fullscreen due to browser security
        // "Transient activation" requirement means fullscreen must be triggered by user interaction
        // The warning modal will prompt the user to click a button to re-enter
        console.log('⚠️ User must click a button to re-enter fullscreen (browser security requirement)');
        
        // We still try automatic re-entry, but it will likely fail
        // This is a fallback that works on some older browsers
        setTimeout(() => {
          console.log('🔄 Attempting automatic fullscreen re-entry (may fail due to browser security)...');
          enterFullscreen().then(() => {
            console.log('✓ Automatic re-entry succeeded (rare)');
          }).catch((error) => {
            console.log('❌ Automatic re-entry failed (expected):', error.message || error);
            console.log('👆 User must manually click the button to re-enter fullscreen');
          });
        }, 1500);
      } else if (isNowFullscreen && !isEnteringFullscreenRef.current) {
        console.log('✓ User entered fullscreen manually or via auto re-entry');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, [enabled, enterFullscreen, notifyFullscreenExit, onFullscreenExit]);

  // Listen for fullscreen exit events from other participants
  useEffect(() => {
    if (!call) return;

    const handleCustomEvent = (event: any) => {
      if (event.type === 'fullscreen_exit') {
        // This will be handled by the interviewer to show notifications
        console.log('Fullscreen exit detected from participant:', event);
      }
    };

    // Subscribe to custom events
    call.on('custom', handleCustomEvent);

    return () => {
      call.off('custom', handleCustomEvent);
    };
  }, [call]);

  // Continuously monitor for display changes
  useEffect(() => {
    if (!enabled) return;

    let screenDetails: any = null;
    let checkInterval: NodeJS.Timeout | null = null;

    // Initial detection
    detectScreens();

    // Try to use Window Management API for real-time monitoring
    const setupScreenMonitoring = async () => {
      if ('getScreenDetails' in window) {
        try {
          // @ts-ignore
          screenDetails = await window.getScreenDetails();
          
          // Listen for screen changes
          if (screenDetails && 'addEventListener' in screenDetails) {
            const handleScreensChange = () => {
              console.log('🖥️ Screen configuration changed - re-detecting screens');
              detectScreens();
            };
            
            screenDetails.addEventListener('screenschange', handleScreensChange);
            
            return () => {
              if (screenDetails && 'removeEventListener' in screenDetails) {
                screenDetails.removeEventListener('screenschange', handleScreensChange);
              }
            };
          }
        } catch (error) {
          console.log('Could not set up Window Management API monitoring:', error);
        }
      }
    };

    // Set up monitoring
    const cleanupScreenMonitoring = setupScreenMonitoring();

    // Fallback: Periodic check for screen changes (every 5 seconds)
    checkInterval = setInterval(() => {
      console.log('🔄 Periodic screen check');
      detectScreens();
    }, 5000);

    // Also listen for window resize events (might indicate display changes)
    const handleResize = () => {
      // Debounce resize events
      clearTimeout((handleResize as any).timeout);
      (handleResize as any).timeout = setTimeout(() => {
        console.log('📐 Window resized - checking for display changes');
        detectScreens();
      }, 1000);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      if (cleanupScreenMonitoring) {
        cleanupScreenMonitoring.then(cleanup => cleanup && cleanup());
      }
      window.removeEventListener('resize', handleResize);
      if ((handleResize as any).timeout) {
        clearTimeout((handleResize as any).timeout);
      }
    };
  }, [enabled, detectScreens]);

  return {
    ...state,
    enterFullscreen,
    exitFullscreen,
    detectScreens,
  };
};

