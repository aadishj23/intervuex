import { DeviceSettings, useCall, VideoPreview } from "@stream-io/video-react-sdk";
import { useEffect, useState } from "react";
import { Card } from "./ui/card";
import { AlertTriangle, CameraIcon, MicIcon, MonitorIcon, SettingsIcon } from "lucide-react";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";
import { useProctoring } from "@/hooks/useProctoring";
import { useUserRole } from "@/hooks/useUserRole";

function MeetingSetup({ onSetupComplete }: { onSetupComplete: () => void }) {
  const [isCameraDisabled, setIsCameraDisabled] = useState(true);
  const [isMicDisabled, setIsMicDisabled] = useState(false);
  const [isCheckingScreens, setIsCheckingScreens] = useState(true);

  const call = useCall();
  const { isCandidate, isLoading: isRoleLoading } = useUserRole();
  const { detectScreens, hasMultipleScreens, screenCount } = useProctoring({ enabled: false });

  if (!call) return null;

  useEffect(() => {
    if (!call) return;
    
    const toggleCamera = async () => {
      try {
        // Check if call is still active before toggling
        const callingState = call.state.callingState;
        if (callingState !== 'joined' && callingState !== 'ringing') {
          console.warn("Cannot toggle camera - call not in active state:", callingState);
          return;
        }
        
        if (isCameraDisabled) {
          await call.camera.disable();
        } else {
          await call.camera.enable();
        }
      } catch (error) {
        console.error("Error toggling camera:", error);
        // Revert state on error
        setIsCameraDisabled(!isCameraDisabled);
      }
    };

    toggleCamera();
  }, [isCameraDisabled, call]);

  useEffect(() => {
    if (!call) return;
    
    const toggleMic = async () => {
      try {
        // Check if call is still active before toggling
        const callingState = call.state.callingState;
        if (callingState !== 'joined' && callingState !== 'ringing') {
          console.warn("Cannot toggle microphone - call not in active state:", callingState);
          return;
        }
        
        if (isMicDisabled) {
          await call.microphone.disable();
        } else {
          await call.microphone.enable();
        }
      } catch (error) {
        console.error("Error toggling microphone:", error);
        // Revert state on error
        setIsMicDisabled(!isMicDisabled);
      }
    };

    toggleMic();
  }, [isMicDisabled, call]);

  // Detect screens on mount for candidates
  useEffect(() => {
    const checkScreens = async () => {
      if (!isRoleLoading && isCandidate) {
        try {
          console.log('🔍 Candidate detected - starting screen check...');
          
          const result = await detectScreens();
          console.log('📊 Screen detection completed:', result);
          
          // Log what the user should see
          if (result.hasMultiple) {
            console.error('❌ MULTIPLE SCREENS DETECTED - User will be blocked from joining');
          } else {
            console.log('✅ Single screen detected - User can join');
          }
        } catch (error) {
          console.error("❌ Error detecting screens:", error);
        } finally {
          setIsCheckingScreens(false);
        }
      } else if (!isRoleLoading) {
        // Not a candidate, no need to check
        console.log('👔 Interviewer detected - skipping screen check');
        setIsCheckingScreens(false);
      }
    };

    checkScreens();
  }, [isCandidate, isRoleLoading, detectScreens]);

  const handleJoin = async () => {
    // Prevent candidates with multiple screens from joining
    if (isCandidate && hasMultipleScreens) {
      return;
    }
    
    await call.join();
    onSetupComplete();
  };

  const handleRecheck = async () => {
    setIsCheckingScreens(true);
    try {
      console.log('🔄 User requested re-check...');
      const result = await detectScreens();
      console.log('📊 Re-check completed:', result);
    } catch (error) {
      console.error("❌ Error re-checking screens:", error);
    } finally {
      setIsCheckingScreens(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background/95">
      <div className="w-full max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* VIDEO PREVIEW CONTAINER */}
          <Card className="md:col-span-1 p-6 flex flex-col">
            <div>
              <h1 className="text-xl font-semibold mb-1">Camera Preview</h1>
              <p className="text-sm text-muted-foreground">Make sure you look good!</p>
            </div>

            {/* VIDEO PREVIEW */}
            <div className="mt-4 flex-1 min-h-[400px] rounded-xl overflow-hidden bg-muted/50 border relative">
              <div className="absolute inset-0">
                <VideoPreview className="h-full w-full" />
              </div>
            </div>
          </Card>

          {/* CARD CONTROLS */}

          <Card className="md:col-span-1 p-6">
            <div className="h-full flex flex-col">
              {/* MEETING DETAILS  */}
              <div>
                <h2 className="text-xl font-semibold mb-1">Meeting Details</h2>
                <p className="text-sm text-muted-foreground break-all">{call.id}</p>
              </div>

              <div className="flex-1 flex flex-col justify-between">
                <div className="spacey-6 mt-8">
                  {/* CAM CONTROL */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <CameraIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Camera</p>
                        <p className="text-sm text-muted-foreground">
                          {isCameraDisabled ? "Off" : "On"}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={!isCameraDisabled}
                      onCheckedChange={(checked) => setIsCameraDisabled(!checked)}
                    />
                  </div>

                  {/* MIC CONTROL */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <MicIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Microphone</p>
                        <p className="text-sm text-muted-foreground">
                          {isMicDisabled ? "Off" : "On"}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={!isMicDisabled}
                      onCheckedChange={(checked) => setIsMicDisabled(!checked)}
                    />
                  </div>

                  {/* DEVICE SETTINGS */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <SettingsIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Settings</p>
                        <p className="text-sm text-muted-foreground">Configure devices</p>
                      </div>
                    </div>
                    <DeviceSettings />
                  </div>
                </div>

                {/* SCREEN DETECTION WARNING - Only for candidates */}
                {isCandidate && (
                  <div className="mt-6 space-y-3">
                    {isCheckingScreens ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MonitorIcon className="h-4 w-4 animate-pulse" />
                        <span>Checking display setup...</span>
                      </div>
                    ) : hasMultipleScreens ? (
                      <Card className="p-4 border-red-500 bg-red-50 dark:bg-red-950/20">
                        <div className="flex gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
                          <div className="space-y-2 flex-1">
                            <p className="font-semibold text-red-600 dark:text-red-500">
                              ❌ Multiple Displays Detected - Cannot Join
                            </p>
                            <p className="text-sm text-red-600/90 dark:text-red-400">
                              You have <strong>{screenCount} displays</strong> connected. For proctoring purposes, <strong>you must use exactly 1 screen only</strong>. Please disconnect ALL external monitors and use only your primary display to join the interview.
                            </p>
                            <Button 
                              onClick={handleRecheck}
                              variant="outline"
                              size="sm"
                              className="mt-2 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              Re-check Display Setup
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500">
                        <MonitorIcon className="h-4 w-4" />
                        <span>✓ Single display detected</span>
                      </div>
                    )}
                  </div>
                )}

                {/* JOIN BTN */}
                <div className="space-y-3 mt-8">
                  <Button 
                    className="w-full" 
                    size="lg" 
                    onClick={handleJoin}
                    disabled={isCandidate && (isCheckingScreens || hasMultipleScreens)}
                  >
                    {isCandidate && hasMultipleScreens 
                      ? "❌ Cannot Join - Only 1 Screen Allowed" 
                      : isCandidate && isCheckingScreens
                      ? "Checking Screens..."
                      : "Join Meeting"}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    {isCandidate && hasMultipleScreens
                      ? "⚠️ You must disconnect ALL external monitors (only 1 screen allowed)"
                      : "Do not worry, our team is super friendly! We want you to succeed. 🎉"
                    }
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
export default MeetingSetup;
