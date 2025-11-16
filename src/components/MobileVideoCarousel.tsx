"use client";

import { useCallStateHooks, ParticipantView } from "@stream-io/video-react-sdk";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export default function MobileVideoCarousel() {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Show all participants (they may have video, audio, or both)
  const activeParticipants = participants;

  useEffect(() => {
    // Reset to first participant if current index is out of bounds
    if (currentIndex >= activeParticipants.length && activeParticipants.length > 0) {
      setCurrentIndex(0);
    }
  }, [activeParticipants.length, currentIndex]);

  const scrollToIndex = (index: number) => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollWidth = container.scrollWidth;
    const itemWidth = scrollWidth / activeParticipants.length;
    container.scrollTo({
      left: itemWidth * index,
      behavior: "smooth",
    });
    setCurrentIndex(index);
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const itemWidth = scrollWidth / activeParticipants.length;
    const newIndex = Math.round(scrollLeft / itemWidth);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < activeParticipants.length) {
      setCurrentIndex(newIndex);
    }
  };

  const goToPrevious = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : activeParticipants.length - 1;
    scrollToIndex(newIndex);
  };

  const goToNext = () => {
    const newIndex = currentIndex < activeParticipants.length - 1 ? currentIndex + 1 : 0;
    scrollToIndex(newIndex);
  };

  if (activeParticipants.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-muted/50">
        <p className="text-sm text-muted-foreground">No participants</p>
      </div>
    );
  }

  if (activeParticipants.length === 1) {
    return (
      <div className="h-full w-full relative" style={{ backgroundColor: '#000' }}>
        <ParticipantView
          participant={activeParticipants[0]}
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full relative" style={{ backgroundColor: '#000' }}>
      {/* Carousel Container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="h-full w-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
      >
        {activeParticipants.map((participant, index) => (
          <div
            key={participant.sessionId || participant.userId}
            className="h-full w-full flex-shrink-0 snap-center relative"
            style={{ minWidth: '100%', maxWidth: '100%' }}
          >
            <ParticipantView
              participant={participant}
            />
          </div>
        ))}
      </div>

      {/* Navigation Buttons */}
      {activeParticipants.length > 1 && (
        <>
          <Button
            variant="outline"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/80 hover:bg-background"
            onClick={goToPrevious}
            aria-label="Previous participant"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/80 hover:bg-background"
            onClick={goToNext}
            aria-label="Next participant"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      )}

      {/* Indicator Dots */}
      {activeParticipants.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
          {activeParticipants.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToIndex(index)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === currentIndex
                  ? "w-6 bg-primary"
                  : "w-1.5 bg-primary/30 hover:bg-primary/50"
              )}
              aria-label={`Go to participant ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

