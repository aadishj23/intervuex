import {
  CallControls,
  CallingState,
  CallParticipantsList,
  PaginatedGridLayout,
  SpeakerLayout,
  useCallStateHooks,
  useCall,
} from "@stream-io/video-react-sdk";
import MobileVideoCarousel from "./MobileVideoCarousel";
import { AlertTriangle, LayoutListIcon, LoaderIcon, UsersIcon, ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./ui/resizable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import EndCallButton from "./EndCallButton";
import CodeEditor from "./CodeEditor";
import { useProctoring } from "@/hooks/useProctoring";
import { useUserRole } from "@/hooks/useUserRole";
import FullscreenExitWarning from "./FullscreenExitWarning";
import toast from "react-hot-toast";

function MeetingRoom() {
  const router = useRouter();
  const [layout, setLayout] = useState<"grid" | "speaker">("speaker");
  const [showParticipants, setShowParticipants] = useState(false);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
  const [fullscreenExitEvents, setFullscreenExitEvents] = useState<Map<string, number>>(new Map());
  const [isControlsMinimized, setIsControlsMinimized] = useState(false);
  
  const { useCallCallingState } = useCallStateHooks();
  const call = useCall();
  const { isCandidate, isInterviewer } = useUserRole();

  const callingState = useCallCallingState();

  const { 
    enterFullscreen, 
    isFullscreen, 
    fullscreenExitCount 
  } = useProctoring({ 
    enabled: isCandidate,
    onFullscreenExit: (exitCount) => {
      setShowFullscreenWarning(true);
      // Warning will stay until user manually re-enters fullscreen
      // (due to browser security, automatic re-entry is not possible)
    }
  });

  // Hide warning when user returns to fullscreen
  useEffect(() => {
    if (isFullscreen && showFullscreenWarning) {
      console.log('✓ User returned to fullscreen - hiding warning');
      setShowFullscreenWarning(false);
    }
  }, [isFullscreen, showFullscreenWarning]);

  // Auto-enter fullscreen when meeting starts (candidates only)
  useEffect(() => {
    if (callingState === CallingState.JOINED && isCandidate) {
      // Small delay to ensure UI is ready
      setTimeout(() => {
        enterFullscreen();
      }, 500);
    }
  }, [callingState, isCandidate, enterFullscreen]);

  // Listen for fullscreen exit events from candidates (for interviewers to see)
  useEffect(() => {
    if (!call || !isInterviewer) {
      console.log('Not setting up custom event listener:', { call: !!call, isInterviewer });
      return;
    }

    console.log('Setting up custom event listener for interviewer');

    const handleCustomEvent = (event: any) => {
      console.log('Custom event received by interviewer:', event);
      console.log('Event type:', event.type);
      console.log('Event keys:', Object.keys(event));
      
      // Stream's custom events might have the data at the top level or nested
      const eventType = event.type || event.event?.type;
      const eventData = event.data || event.event || event;
      
      if (eventType === 'fullscreen_exit' || eventData?.type === 'fullscreen_exit') {
        const exitCount = eventData.exitCount || event.exitCount || 0;
        const userId = eventData.userId || event.userId || event.user?.id;
        const userName = eventData.userName || event.userName || event.user?.name;
        
        console.log('Processing fullscreen exit:', { userId, userName, exitCount, eventData });
        
        // Get participant info from the call state as fallback
        const participants = call.state.participants || {};
        const participant = Object.values(participants).find((p: any) => p.userId === userId);
        const participantName = userName || 
                               participant?.name || 
                               event.user?.name || 
                               participant?.userId || 
                               userId || 
                               'A candidate';
        
        console.log('Fullscreen exit event processed:', {
          userId,
          participantName,
          exitCount,
          participant,
        });
        
        // Update the exit events map
        setFullscreenExitEvents(prev => {
          const newMap = new Map(prev);
          newMap.set(userId || 'unknown', exitCount);
          return newMap;
        });

        // Show toast notification to interviewer
        toast.error(
          `⚠️ ${participantName} exited fullscreen mode (${exitCount} time${exitCount > 1 ? 's' : ''})`,
          { 
            duration: 6000,
            icon: <AlertTriangle className="h-5 w-5" />
          }
        );
      }
    };

    // Listen for custom events
    call.on('custom', handleCustomEvent);
    
    console.log('Custom event listener registered for interviewer');

    return () => {
      call.off('custom', handleCustomEvent);
      console.log('Custom event listener removed for interviewer');
    };
  }, [call, isInterviewer]);

  if (callingState !== CallingState.JOINED) {
    return (
      <div className="h-96 flex items-center justify-center">
        <LoaderIcon className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem-1px)]">
      {/* Fullscreen Warning Overlay - Candidates Only */}
      {isCandidate && showFullscreenWarning && (
        <FullscreenExitWarning 
          exitCount={fullscreenExitCount}
          onEnterFullscreen={enterFullscreen}
        />
      )}

      {/* Fullscreen Status Indicator - Interviewer View */}
      {isInterviewer && fullscreenExitEvents.size > 0 && (
        <div className="absolute top-2 right-2 z-10">
          <div className="bg-red-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>
              Candidate left fullscreen {Array.from(fullscreenExitEvents.values())[0]} time(s)
            </span>
          </div>
        </div>
      )}
      {/* Mobile Layout - Vertical Stack */}
      <div className="md:hidden flex flex-col h-full">
        {/* Video Section - Top 30% on mobile */}
        <div className="h-[30vh] relative border-b overflow-hidden">
          <div className="absolute inset-0 w-full h-full">
            <MobileVideoCarousel />

            {/* PARTICIPANTS LIST OVERLAY */}
            {showParticipants && (
              <div className="absolute right-0 top-0 h-full w-[250px] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
                <CallParticipantsList onClose={() => setShowParticipants(false)} />
              </div>
            )}
          </div>
        </div>

        {/* Code Editor Section - Bottom 70% on mobile */}
        <div className="flex-1 overflow-hidden relative">
          <CodeEditor />
          
          {/* Floating Meeting Controls - Mobile */}
          <div className="absolute bottom-4 left-0 right-0 z-50 px-4">
            <div className="bg-background/95 backdrop-blur-md rounded-2xl border shadow-2xl overflow-hidden">
              {/* Minimize/Maximize Button */}
              <div className="flex justify-center py-1 border-b">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setIsControlsMinimized(!isControlsMinimized)}
                  aria-label={isControlsMinimized ? "Show controls" : "Hide controls"}
                >
                  {isControlsMinimized ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </Button>
              </div>
              
              {/* Controls Content */}
              {!isControlsMinimized && (
                <div className="p-3">
                  {/* Main Controls Row */}
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <CallControls onLeave={() => router.push("/")} />
                  </div>
                  
                  {/* Secondary Controls Row */}
                  <div className="flex items-center justify-center gap-2 pt-2 border-t">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="size-10">
                          <LayoutListIcon className="size-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setLayout("grid")}>
                          Grid View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLayout("speaker")}>
                          Speaker View
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="outline"
                      size="icon"
                      className="size-10"
                      onClick={() => setShowParticipants(!showParticipants)}
                    >
                      <UsersIcon className="size-5" />
                    </Button>

                    <div className="md:hidden">
                      <EndCallButton />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Layout - Horizontal Resizable */}
      <div className="hidden md:block h-full">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={25} minSize={20} maxSize={35} className="relative">
            {/* VIDEO LAYOUT */}
            <div className="absolute inset-0">
              {layout === "grid" ? <PaginatedGridLayout /> : <SpeakerLayout />}

              {/* PARTICIPANTS LIST OVERLAY */}
              {showParticipants && (
                <div className="absolute right-0 top-0 h-full w-[300px] bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
                  <CallParticipantsList onClose={() => setShowParticipants(false)} />
                </div>
              )}
            </div>

            {/* VIDEO CONTROLS */}
            <div className="absolute bottom-4 left-0 right-0">
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 flex-wrap justify-center px-4">
                  <CallControls onLeave={() => router.push("/")} />

                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="size-10">
                          <LayoutListIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setLayout("grid")}>
                          Grid View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLayout("speaker")}>
                          Speaker View
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="outline"
                      size="icon"
                      className="size-10"
                      onClick={() => setShowParticipants(!showParticipants)}
                    >
                      <UsersIcon className="size-4" />
                    </Button>

                    <EndCallButton />
                  </div>
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={75} minSize={25}>
            <CodeEditor />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
export default MeetingRoom;
