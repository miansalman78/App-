import { moderateScale } from '@/utils/scaling';
import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

// Format time in seconds to MM:SS or SS.S
const formatTime = (seconds: number): string => {
  if (seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const decimal = Math.floor((seconds % 1) * 10);
  
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${secs}.${decimal}s`;
};

interface OverlayItem {
  id: string;
  startTime: number;
  endTime: number;
  type: 'audio' | 'text' | 'image' | 'sticker';
  label: string;
}

interface SplitPoint {
  id: string;
  time: number;
  transitionType?: string;
}

interface VideoSegment {
  id: string;
  startTime: number;
  endTime: number;
  isDeleted: boolean;
}

interface VideoTimelineProps {
  duration: number; // Video duration in seconds
  currentTime: number; // Current playback time
  onTimeChange: (time: number) => void;
  onTrimStart: (time: number) => void;
  onTrimEnd: (time: number) => void;
  trimStart?: number;
  trimEnd?: number;
  videoFrames?: string[]; // Array of frame URIs for thumbnails
  isLoading?: boolean; // Loading state for frames
  overlays?: OverlayItem[]; // Image and sticker overlays
  onOverlayTimeChange?: (id: string, startTime: number, endTime: number) => void;
  splitPoints?: SplitPoint[]; // Video split points for gaps
  onSplitPointClick?: (splitId: string, time: number) => void; // Callback when split icon is clicked
  videoSegments?: VideoSegment[]; // Video segments created by splits
  onSegmentDelete?: (segmentId: string) => void; // Callback to delete a segment
}

// Overlay Bar Component for individual draggable bars
function OverlayBarItem({ 
  overlay, 
  index, 
  duration, 
  trackWidthState, 
  onOverlayTimeChange 
}: { 
  overlay: OverlayItem; 
  index: number; 
  duration: number; 
  trackWidthState: number;
  onOverlayTimeChange?: (id: string, startTime: number, endTime: number) => void;
}) {
  const startPx = (overlay.startTime / duration) * trackWidthState;
  const endPx = (overlay.endTime / duration) * trackWidthState;
  const widthPx = Math.max(endPx - startPx, 30);
  const color = overlay.type === 'audio' ? '#6BCF7F' 
    : overlay.type === 'image' ? '#FF6B6B' 
    : overlay.type === 'text' ? '#FFD93D' 
    : '#4ECDC4';
  
  const overlayStartX = useSharedValue(startPx);
  const overlayEndX = useSharedValue(endPx);
  
  // Main bar drag gesture - move position
  const barDragGesture = Gesture.Pan()
    .onStart(() => {
      overlayStartX.value = startPx;
      overlayEndX.value = endPx;
    })
    .onUpdate((event) => {
      const newStart = Math.max(0, Math.min(startPx + event.translationX, trackWidthState - widthPx));
      overlayStartX.value = newStart;
      overlayEndX.value = newStart + widthPx;
    })
    .onEnd(() => {
      'worklet';
      const newStartTime = (overlayStartX.value / trackWidthState) * duration;
      const newEndTime = (overlayEndX.value / trackWidthState) * duration;
      if (onOverlayTimeChange) {
        runOnJS(onOverlayTimeChange)(overlay.id, newStartTime, newEndTime);
      }
    });
  
  // Left edge drag gesture - adjust start time (resize from left)
  const leftEdgeGesture = Gesture.Pan()
    .onStart(() => {
      overlayStartX.value = startPx;
      overlayEndX.value = endPx;
    })
    .onUpdate((event) => {
      const minWidth = 20; // Minimum 20px width
      const newStart = Math.max(0, Math.min(startPx + event.translationX, overlayEndX.value - minWidth));
      overlayStartX.value = newStart;
    })
    .onEnd(() => {
      'worklet';
      const newStartTime = (overlayStartX.value / trackWidthState) * duration;
      const endTime = overlay.endTime;
      if (onOverlayTimeChange) {
        runOnJS(onOverlayTimeChange)(overlay.id, newStartTime, endTime);
      }
    });
  
  // Right edge drag gesture - adjust end time (resize from right)
  const rightEdgeGesture = Gesture.Pan()
    .onStart(() => {
      overlayStartX.value = startPx;
      overlayEndX.value = endPx;
    })
    .onUpdate((event) => {
      const minWidth = 20; // Minimum 20px width
      const newEnd = Math.max(overlayStartX.value + minWidth, Math.min(endPx + event.translationX, trackWidthState));
      overlayEndX.value = newEnd;
    })
    .onEnd(() => {
      'worklet';
      const startTime = overlay.startTime;
      const newEndTime = (overlayEndX.value / trackWidthState) * duration;
      if (onOverlayTimeChange) {
        runOnJS(onOverlayTimeChange)(overlay.id, startTime, newEndTime);
      }
    });
  
  const animatedStyle = useAnimatedStyle(() => ({
    left: overlayStartX.value,
    width: overlayEndX.value - overlayStartX.value,
  }));
  
  return (
    <GestureDetector gesture={barDragGesture}>
      <Animated.View
        style={[
          styles.overlayBarLarge,
          {
            backgroundColor: color,
            top: index * moderateScale(32),
          },
          animatedStyle,
        ]}
      >
        <View style={styles.overlayBarContent}>
          {/* Left edge handle - resize start time */}
          <GestureDetector gesture={leftEdgeGesture}>
            <Animated.View style={[styles.overlayHandle, styles.overlayEdgeHandle]}>
              <MaterialIcons name="drag-handle" size={12} color="white" />
            </Animated.View>
          </GestureDetector>
          
          <Text style={styles.overlayLabelLarge} numberOfLines={1}>
            {overlay.label}
          </Text>
          
          <Text style={styles.overlayDuration}>
            {formatTime(overlay.endTime - overlay.startTime)}
          </Text>
          
          {/* Right edge handle - resize end time */}
          <GestureDetector gesture={rightEdgeGesture}>
            <Animated.View style={[styles.overlayHandle, styles.overlayEdgeHandle]}>
              <MaterialIcons name="drag-handle" size={12} color="white" />
            </Animated.View>
          </GestureDetector>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export default function VideoTimeline({
  duration,
  currentTime,
  onTimeChange,
  onTrimStart,
  onTrimEnd,
  trimStart = 0,
  trimEnd = duration,
  videoFrames = [],
  isLoading = false,
  overlays = [],
  splitPoints = [],
  onOverlayTimeChange,
  onSplitPointClick,
  videoSegments = [],
  onSegmentDelete,
}: VideoTimelineProps) {
  // Timeline layout width (px)
  const [trackWidthState, setTrackWidthState] = useState(0);
  const trackWidth = useSharedValue(0);
  const [showTrimUI, setShowTrimUI] = useState(false);
  
  // Debug: Log trim values
  useEffect(() => {
    console.log('Trim UI Debug:', {
      showTrimUI,
      trimStart,
      trimEnd,
      trackWidthState,
      duration
    });
  }, [showTrimUI, trimStart, trimEnd, trackWidthState, duration]);

  // Debug: Log videoFrames changes
  useEffect(() => {
    console.log('🎬 VideoTimeline videoFrames updated:', {
      frameCount: videoFrames.length,
      duration,
      trimStart,
      trimEnd,
      frameSamples: videoFrames.slice(0, 3).map(f => ({ uri: f ? f.substring(0, 50) + '...' : 'empty' }))
    });
  }, [videoFrames, duration, trimStart, trimEnd]);
  const pxPerSecond = moderateScale(60);
  const frameGapPx = 0; // No gap between frames
  const markersScrollRef = useRef<ScrollView>(null);
  const thumbnailsScrollRef = useRef<ScrollView>(null);
  const overlayScrollRef = useRef<ScrollView>(null);
  const isMarkersScrolling = useRef(false);
  const isThumbnailsScrolling = useRef(false);
  const isOverlayScrolling = useRef(false);

  // Handle sizes
  const handleDiameter = moderateScale(18);
  const minGapPx = moderateScale(10);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPositionFromTime = (time: number) => {
    if (trackWidthState === 0 || duration === 0) return 0;
    // For trimmed videos, the time should be relative to the trimmed duration
    // If we have trim info, adjust the time calculation
    const adjustedTime = trimStart > 0 ? Math.max(0, time - trimStart) : time;
    return (adjustedTime / duration) * trackWidthState;
  };
  
  const getPositionPercentage = (time: number) => {
    if (duration === 0) return 0;
    // For trimmed videos, the time should be relative to the trimmed duration
    const adjustedTime = trimStart > 0 ? Math.max(0, time - trimStart) : time;
    return (adjustedTime / duration) * 100;
  };
  // Animated shared values store pixel positions
  const trimStartX = useSharedValue(0);
  const trimEndX = useSharedValue(0);

  // Sync initial values when layout or props change
  useEffect(() => {
    // Since we're always showing 0-based trimmed duration
    // trimStart is always 0, trimEnd is the trimmed duration
    const startPx = (trimStart / duration) * trackWidthState;
    const endPx = (trimEnd / duration) * trackWidthState;
    
    // Clamp positions to track boundaries
    const clampedStartPx = Math.max(0, Math.min(startPx, trackWidthState));
    const clampedEndPx = Math.max(0, Math.min(endPx, trackWidthState));
    
    console.log(`🎯 Trim marker positioning: trimStart=${trimStart}, trimEnd=${trimEnd}, startPx=${clampedStartPx}, endPx=${clampedEndPx}, duration=${duration}, trackWidthState=${trackWidthState}`);
    
    trimStartX.value = clampedStartPx;
    trimEndX.value = clampedEndPx;
  }, [trackWidthState, trimStart, trimEnd, duration]);

  // Recalculate width when duration changes (new video uploaded)
  useEffect(() => {
    if (duration > 0) {
      // Use exact duration but ensure trim doesn't exceed last marker
      const newWidth = duration * pxPerSecond;
      const lastMarkerPos = Math.floor(duration) * pxPerSecond;
      
      setTrackWidthState(newWidth);
      trackWidth.value = newWidth;
      
      console.log(`📏 Track width: duration=${duration}, exactWidth=${newWidth}px, lastMarker=${lastMarkerPos}px`);
    }
  }, [duration]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const viewportW = e.nativeEvent.layout.width;
    // Use exact duration for track width
    const contentW = Math.max(viewportW, Math.max(1, duration) * pxPerSecond);
    setTrackWidthState(contentW);
    trackWidth.value = contentW;
  };

  // Gesture start positions
  const trimStartStartX = useSharedValue(0);
  const trimEndStartX = useSharedValue(0);

  const trimStartGesture = Gesture.Pan()
    .activeCursor('grab')
    .minDistance(0)
    .onStart(() => {
      trimStartStartX.value = trimStartX.value;
    })
    .onUpdate((event) => {
      const next = Math.min(
        Math.max(0, trimStartStartX.value + event.translationX),
        trimEndX.value - minGapPx
      );
      trimStartX.value = next;
    })
    .onEnd(() => {
      'worklet';
      const positionPx = trimStartX.value;
      const trackW = trackWidth.value;
      const dur = duration;
      
      // Calculate time on UI thread safely
      if (trackW === 0 || dur === 0) {
        runOnJS(onTrimStart)(0);
        return;
      }
      
      const clamped = Math.max(0, Math.min(trackW, positionPx));
      const time = (clamped / trackW) * dur;
      
      if (typeof time === 'number' && !isNaN(time) && isFinite(time)) {
        runOnJS(onTrimStart)(time);
      }
    });

  const trimEndGesture = Gesture.Pan()
    .activeCursor('grab')
    .minDistance(0)
    .onStart(() => {
      trimEndStartX.value = trimEndX.value;
    })
    .onUpdate((event) => {
      const next = Math.max(
        Math.min(trackWidth.value, trimEndStartX.value + event.translationX),
        trimStartX.value + minGapPx
      );
      trimEndX.value = next;
    })
    .onEnd(() => {
      'worklet';
      const positionPx = trimEndX.value;
      const trackW = trackWidth.value;
      const dur = duration;
      
      // Calculate time on UI thread safely
      if (trackW === 0 || dur === 0) {
        runOnJS(onTrimEnd)(dur);
        return;
      }
      
      const clamped = Math.max(0, Math.min(trackW, positionPx));
      const time = (clamped / trackW) * dur;
      
      if (typeof time === 'number' && !isNaN(time) && isFinite(time)) {
        runOnJS(onTrimEnd)(time);
      }
    });

  // Animated styles
  const trimStartHandleStyle = useAnimatedStyle(() => ({
    left: trimStartX.value,
  }));

  const trimEndHandleStyle = useAnimatedStyle(() => {
    'worklet';
    // Always show at actual position since we're working with trimmed duration
    return {
      left: trimEndX.value,
    };
  });

  const trimAreaStyle = useAnimatedStyle(() => {
    'worklet';
    // Always show actual area since we're working with trimmed duration
    return {
      left: trimStartX.value,
      width: Math.max(0, trimEndX.value - trimStartX.value),
    };
  });


  // Generate time markers for each second with better spacing
  const generateTimeMarkers = () => {
    const markers = [];
    // Only show markers for complete seconds within video duration
    const totalSeconds = Math.floor(duration);
    
    // Always show 0s-based markers (relative time from trim start)
    for (let i = 0; i <= totalSeconds; i += 1) {
      const positionPx = i * pxPerSecond;
      
      markers.push(
        <View key={i} style={[styles.timeMarker, { left: positionPx }]}>
          <View style={styles.markerLine} />
          <Text style={styles.markerText}>{i}s</Text>
        </View>
      );
    }
    
    return markers;
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.timelineContainer}>
        {/* Time markers for each second (scrollable) */}
        <ScrollView
          key={`markers-${duration}`}
          ref={markersScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ width: trackWidthState }}
          scrollEventThrottle={16}
          onScroll={(event) => {
            if (isThumbnailsScrolling.current || isOverlayScrolling.current) return;
            isMarkersScrolling.current = true;
            const offsetX = event.nativeEvent.contentOffset.x;
            if (thumbnailsScrollRef.current) {
              thumbnailsScrollRef.current.scrollTo({ x: offsetX, animated: false });
            }
            if (overlayScrollRef.current) {
              overlayScrollRef.current.scrollTo({ x: offsetX, animated: false });
            }
            setTimeout(() => { isMarkersScrolling.current = false; }, 50);
          }}
        >
          <View style={[styles.timeMarkersContainer, { width: trackWidthState }]}>
            {generateTimeMarkers()}
          </View>
        </ScrollView>

        {/* Timeline track (tap to toggle trim UI) */}
        <ScrollView
          key={`thumbnails-${duration}`}
          ref={thumbnailsScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={onTrackLayout}
          contentContainerStyle={{ width: trackWidthState }}
          scrollEventThrottle={16}
          onScroll={(event) => {
            if (isMarkersScrolling.current || isOverlayScrolling.current) return;
            isThumbnailsScrolling.current = true;
            const offsetX = event.nativeEvent.contentOffset.x;
            if (markersScrollRef.current) {
              markersScrollRef.current.scrollTo({ x: offsetX, animated: false });
            }
            if (overlayScrollRef.current) {
              overlayScrollRef.current.scrollTo({ x: offsetX, animated: false });
            }
            setTimeout(() => { isThumbnailsScrolling.current = false; }, 50);
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.timelineTrack, { width: trackWidthState }]}
            onPress={() => {
              setShowTrimUI((v) => !v);
            }}
          >
          {/* Background track - limited to last complete second */}
          <View style={[
            styles.backgroundTrack,
            { width: Math.floor(duration) * pxPerSecond }
          ]} />
          
          {/* Video frame thumbnails: one per second */}
          {!isLoading && (
            <View style={[styles.framesContainer, { width: trackWidthState }] }>
              {Array.from({ length: Math.max(1, Math.floor(duration)) }).map((_, i) => {
                // For trimmed videos, position thumbnails relative to the trimmed timeline
                // For normal videos, use the original positioning logic
                const timeInSeconds = i; // Time in seconds for this thumbnail
                const gapSize = 2; // Small 2px gap between frames
                const leftPx = trimStart > 0 ? (i * pxPerSecond) : getPositionFromTime(timeInSeconds);
                const widthPx = pxPerSecond - gapSize; // Subtract gap for visual separation
                
                // For trimmed video, use direct frame mapping since frames are already for the trimmed portion
                const frameIndex = videoFrames.length > 0
                  ? Math.min(videoFrames.length - 1, i) // Direct mapping for trimmed frames
                  : -1;
                const uri = frameIndex >= 0 ? videoFrames[frameIndex] : undefined;
                
                console.log(`Thumbnail ${i}: timeInSeconds=${timeInSeconds}, leftPx=${leftPx}, frameIndex=${frameIndex}, uri=${uri ? 'exists' : 'missing'}, duration=${duration}, trimStart=${trimStart}, trimEnd=${trimEnd}`);
                
                // For trimmed videos, always show thumbnails since they're already trimmed
                // The frames array contains only the trimmed portion
                const shouldShowThumbnail = true; // Always show for trimmed videos
                
                return (
                  <View
                    key={`sec-${i}`}
                    style={[
                      styles.perSecondFrame, 
                      { 
                        left: leftPx, 
                        width: widthPx,
                        opacity: shouldShowThumbnail ? 1 : 0.3
                      }
                    ]}
                  >
                    {uri && shouldShowThumbnail ? (
                      <Image source={{ uri }} style={styles.frameThumbnail} resizeMode="cover" />
                    ) : (
                      <View style={styles.framePlaceholder} />
                    )}
                  </View>
                );
              })}
              
              {/* Video Segments - Show parts created by splits (only active ones) */}
              {videoSegments.length > 0 && videoSegments.filter(seg => !seg.isDeleted).map((segment, index) => {
                const startPx = (segment.startTime / duration) * trackWidthState;
                const widthPx = ((segment.endTime - segment.startTime) / duration) * trackWidthState;
                
                console.log(`📦 Segment ${index}:`, {
                  id: segment.id,
                  startTime: segment.startTime,
                  endTime: segment.endTime,
                  startPx,
                  widthPx,
                  isDeleted: segment.isDeleted
                });
                
                return (
                  <TouchableOpacity
                    key={segment.id}
                    style={[
                      styles.videoSegment,
                      {
                        left: startPx,
                        width: Math.max(widthPx, moderateScale(60)), // Minimum width for clickability
                        backgroundColor: segment.isDeleted 
                          ? 'rgba(255, 59, 48, 0.5)' 
                          : 'rgba(37, 155, 154, 0.6)',
                        borderColor: segment.isDeleted 
                          ? '#FF3B30' 
                          : '#259B9A',
                      }
                    ]}
                    onPress={() => {
                      console.log('🖱️ Segment pressed:', segment.id, 'isDeleted:', segment.isDeleted);
                      if (!segment.isDeleted && onSegmentDelete) {
                        console.log('✅ Calling onSegmentDelete for:', segment.id);
                        onSegmentDelete(segment.id);
                      } else {
                        console.log('⚠️ Cannot delete - either already deleted or no handler');
                      }
                    }}
                    activeOpacity={segment.isDeleted ? 1 : 0.7}
                  >
                    <Text style={styles.segmentLabel}>
                      {segment.isDeleted ? '🗑️ Deleted' : `Part ${index + 1}: ${formatTime(segment.endTime - segment.startTime)}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              
              {/* Split Point Markers with Gaps */}
              {splitPoints.map((split) => {
                const splitPx = (split.time / duration) * trackWidthState;
                const gapWidth = moderateScale(20); // Increased gap width for visibility
                
                return (
                  <View
                    key={split.id}
                    style={[
                      styles.splitMarker,
                      {
                        left: splitPx - gapWidth / 2,
                        width: gapWidth,
                      }
                    ]}
                  >
                    {/* Vertical line for split */}
                    <View style={styles.splitLine} />
                    
                    {/* Touchable Transition icon - positioned above timeline */}
                    <TouchableOpacity
                      style={[styles.splitIcon, {
                        top: -moderateScale(25), // Position above the timeline
                      }]}
                      onPress={() => {
                        console.log('Split icon clicked:', split.id, 'at time:', split.time);
                        onSplitPointClick?.(split.id, split.time);
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons 
                        name={split.transitionType && split.transitionType !== 'none' ? "star" : "bolt"} 
                        size={moderateScale(20)} 
                        color={split.transitionType && split.transitionType !== 'none' ? "#00FF00" : "#FFD700"} 
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
          
          {/* Loading indicator for frames */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Generating frames...</Text>
            </View>
          )}
          
           {/* Second interval markers on track - every second */}
           {Array.from({ length: Math.floor(duration) + 1 }, (_, i) => {
             const timeInSeconds = i;
             // For trimmed videos, position markers relative to the trimmed timeline
             // For normal videos, use the original positioning logic
             const leftPx = trimStart > 0 ? (i * pxPerSecond) : getPositionFromTime(timeInSeconds);
             return (
               <View
                 key={`track-marker-${i}`}
                 style={[styles.trackMarker, { left: leftPx }]}
               />
             );
           })}
          
          {/* Trim UI - Hide if video has splits or segments */}
          {showTrimUI && (!splitPoints || splitPoints.length === 0) && (!videoSegments || videoSegments.length === 0) && (
            <>
              <Animated.View 
                style={[
                  styles.trimArea,
                  trimAreaStyle,
                ]}
              />
              <GestureDetector gesture={trimStartGesture}>
                <Animated.View
                  style={[
                    styles.trimHandle,
                    styles.trimStartHandle,
                    trimStartHandleStyle,
                  ]}
                >
                  <MaterialIcons name="drag-handle" size={20} color="white" />
                </Animated.View>
              </GestureDetector>
              <GestureDetector gesture={trimEndGesture}>
                <Animated.View
                  style={[
                    styles.trimHandle,
                    styles.trimEndHandle,
                    trimEndHandleStyle,
                  ]}
                >
                  <MaterialIcons name="drag-handle" size={20} color="white" />
                </Animated.View>
              </GestureDetector>
            </>
          )}


          {/* Playhead */}
          <View 
            style={[
              styles.playhead,
              { 
                left: (() => {
                  // For trimmed videos, currentTime is already relative to the trimmed timeline
                  // So we can use it directly without subtracting trimStart
                  const playheadPosition = trimStart > 0 
                    ? Math.max(0, Math.min(trackWidthState, currentTime * pxPerSecond))
                    : getPositionFromTime(currentTime);
                  
                  console.log(`🎯 Playhead positioning: currentTime=${currentTime}, trimStart=${trimStart}, playheadPosition=${playheadPosition}, trackWidthState=${trackWidthState}`);
                  
                  return playheadPosition;
                })()
              }
            ]}
          >
            <View style={styles.playheadLine} />
            <View style={styles.playheadHandle}>
              <MaterialIcons name="play-arrow" size={12} color="white" />
            </View>
          </View>

          </TouchableOpacity>
        </ScrollView>

        {/* Current time display */}
        <View style={styles.currentTimeContainer}>
          <Text style={styles.currentTimeText}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        </View>

        {/* Trim info - Hide if video has splits */}
        {showTrimUI && (!splitPoints || splitPoints.length === 0) && (
          <View style={styles.trimInfo}>
            <Text style={styles.trimInfoText}>
              Trim: {formatTime(trimStart)} - {formatTime(trimEnd)} 
              ({formatTime(trimEnd - trimStart)} selected)
            </Text>
          </View>
        )}
        
        {/* Split info and Segment List - Show when splits are present */}
        {videoSegments && videoSegments.length > 0 && (
          <>
            <View style={styles.splitInfo}>
              <MaterialIcons name="content-cut" size={moderateScale(16)} color="#FFD700" />
              <Text style={styles.splitInfoText}>
                {videoSegments.filter(s => !s.isDeleted).length} of {videoSegments.length} segments • Tap segment to delete
              </Text>
            </View>
            
            {/* Segments List - Easy to click (only show active segments) */}
            <View style={styles.segmentsList}>
              <Text style={styles.segmentsListTitle}>Video Segments (Tap to Delete):</Text>
              {videoSegments.filter(seg => !seg.isDeleted).map((segment, index) => (
                <TouchableOpacity
                  key={segment.id}
                  style={styles.segmentListItem}
                  onPress={() => {
                    if (onSegmentDelete) {
                      onSegmentDelete(segment.id);
                    }
                  }}
                >
                  <Text style={styles.segmentListItemText}>
                    📹 Part {index + 1}: {formatTime(segment.startTime)} - {formatTime(segment.endTime)} ({formatTime(segment.endTime - segment.startTime)})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Overlay Timeline Track - Below main timeline */}
        <View style={styles.overlayTimelineContainer}>
          <Text style={styles.overlayTimelineLabel}>
            Audio, Text, Images & Stickers: {overlays.length > 0 ? `(${overlays.length})` : '(Empty)'}
          </Text>
          {overlays.length > 0 ? (
            <ScrollView
              ref={overlayScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ width: trackWidthState }}
              scrollEventThrottle={16}
              onScroll={(event) => {
                if (isOverlayScrolling.current || isMarkersScrolling.current || isThumbnailsScrolling.current) return;
                isOverlayScrolling.current = true;
                const offsetX = event.nativeEvent.contentOffset.x;
                // Sync with markers and thumbnails
                if (markersScrollRef.current) {
                  markersScrollRef.current.scrollTo({ x: offsetX, animated: false });
                }
                if (thumbnailsScrollRef.current) {
                  thumbnailsScrollRef.current.scrollTo({ x: offsetX, animated: false });
                }
                setTimeout(() => { isOverlayScrolling.current = false; }, 50);
              }}
            >
              <View style={[styles.overlayTrack, { 
                width: trackWidthState,
                height: Math.max(moderateScale(40), overlays.length * moderateScale(34))
              }]}>
                {overlays.map((overlay, index) => (
                  <OverlayBarItem
                    key={overlay.id}
                    overlay={overlay}
                    index={index}
                    duration={duration}
                    trackWidthState={trackWidthState}
                    onOverlayTimeChange={onOverlayTimeChange}
                  />
                ))}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.emptyOverlayTrack}>
              <Text style={styles.emptyOverlayText}>
                No overlays added yet. Add audio, text, images or stickers!
              </Text>
            </View>
          )}
        </View>

      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: moderateScale(15),
    paddingHorizontal: moderateScale(20),
  },
  timelineContainer: {
    width: '100%',
  },
  timeMarkersContainer: {
    position: 'relative',
    height: moderateScale(25),
    marginBottom: moderateScale(5),
    overflow: 'visible',
  },
  timeMarker: {
    position: 'absolute',
    alignItems: 'center',
    top: 0,
    minWidth: moderateScale(20),
    transform: [{ translateX: -10 }], // Center the marker
  },
  markerLine: {
    width: 1,
    height: moderateScale(8),
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  markerText: {
    color: 'white',
    fontSize: moderateScale(9),
    marginTop: moderateScale(2),
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: moderateScale(2),
    borderRadius: moderateScale(2),
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: moderateScale(8),
  },
  timeLabel: {
    color: 'white',
    fontSize: moderateScale(12),
    opacity: 0.7,
  },
  timelineTrack: {
    height: moderateScale(40),
    position: 'relative',
    marginVertical: moderateScale(10),
    overflow: 'visible',
    paddingBottom: moderateScale(60), // Space for segments below
  },
  backgroundTrack: {
    position: 'absolute',
    top: moderateScale(15),
    left: 0,
    // width set dynamically to match last marker position
    height: moderateScale(4),
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: moderateScale(2),
  },
  trackMarker: {
    position: 'absolute',
    top: moderateScale(13),
    width: 1,
    height: moderateScale(8),
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginLeft: -0.5,
  },
  // Frame thumbnails styles
  framesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  perSecondFrame: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    paddingHorizontal: 0, // No padding between frames
    marginHorizontal: 0, // No margin between frames
  },
  frameThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 0, // No rounded corners for seamless look
    borderWidth: 0, // No border for flush thumbnails
  },
  framePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 0, // No rounded corners
    borderWidth: 0, // No border
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  loadingText: {
    color: 'white',
    fontSize: moderateScale(12),
    fontWeight: '500',
  },
  trimArea: {
    position: 'absolute',
    top: moderateScale(15),
    height: moderateScale(4),
    backgroundColor: '#007AFF',
    borderRadius: moderateScale(2),
    zIndex: 15, // Above frames but below handles
  },
  trimHandle: {
    position: 'absolute',
    top: moderateScale(5),
    width: moderateScale(28),
    height: moderateScale(28),
    backgroundColor: '#007AFF',
    borderRadius: moderateScale(14),
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: moderateScale(-14),
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 20, // Higher than split icons
  },
  trimStartHandle: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  trimEndHandle: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: moderateScale(2),
    marginLeft: moderateScale(-1),
  },
  playheadLine: {
    width: moderateScale(2),
    height: '100%',
    backgroundColor: '#FF3B30',
  },
  playheadHandle: {
    position: 'absolute',
    top: moderateScale(-6),
    left: moderateScale(-8),
    width: moderateScale(18),
    height: moderateScale(18),
    backgroundColor: '#FF3B30',
    borderRadius: moderateScale(9),
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentTimeContainer: {
    alignItems: 'center',
    marginTop: moderateScale(10),
  },
  currentTimeText: {
    color: 'white',
    fontSize: moderateScale(14),
    fontWeight: '600',
  },
  trimInfo: {
    alignItems: 'center',
    marginTop: moderateScale(8),
  },
  trimInfoText: {
    color: '#007AFF',
    fontSize: moderateScale(12),
    opacity: 0.8,
  },
  splitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: moderateScale(8),
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(6),
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderRadius: moderateScale(6),
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  splitInfoText: {
    color: '#FFD700',
    fontSize: moderateScale(12),
    fontWeight: '600',
    marginLeft: moderateScale(6),
  },
  overlayBar: {
    position: 'absolute',
    height: moderateScale(6),
    borderRadius: moderateScale(3),
    opacity: 0.8,
    justifyContent: 'center',
    paddingHorizontal: moderateScale(4),
    zIndex: 10,
  },
  overlayLabel: {
    color: 'white',
    fontSize: moderateScale(9),
    fontWeight: '600',
  },
  overlayTimelineContainer: {
    marginTop: moderateScale(15),
    paddingTop: moderateScale(10),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  overlayTimelineLabel: {
    color: 'white',
    fontSize: moderateScale(11),
    fontWeight: '600',
    marginBottom: moderateScale(8),
    opacity: 0.8,
  },
  overlayTrack: {
    position: 'relative',
    minHeight: moderateScale(40),
    paddingVertical: moderateScale(5),
  },
  overlayBarLarge: {
    position: 'absolute',
    height: moderateScale(28),
    borderRadius: moderateScale(6),
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  overlayBarContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: moderateScale(4),
  },
  overlayHandle: {
    width: moderateScale(20),
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  overlayEdgeHandle: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  overlayLabelLarge: {
    flex: 1,
    color: 'white',
    fontSize: moderateScale(10),
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: moderateScale(4),
  },
  overlayDuration: {
    color: 'white',
    fontSize: moderateScale(9),
    fontWeight: '600',
    marginHorizontal: moderateScale(4),
    opacity: 0.9,
  },
  emptyOverlayTrack: {
    minHeight: moderateScale(50),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: moderateScale(8),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
    paddingVertical: moderateScale(15),
  },
  emptyOverlayText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: moderateScale(11),
    textAlign: 'center',
  },
  splitMarker: {
    position: 'absolute',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  splitLine: {
    width: 3,
    height: '100%',
    backgroundColor: '#FFD700',
    position: 'absolute',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 5,
  },
  splitIcon: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderRadius: moderateScale(18),
    padding: moderateScale(6),
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 8,
    alignSelf: 'center',
  },
  videoSegment: {
    position: 'absolute',
    height: moderateScale(40),
    bottom: moderateScale(-50),
    borderRadius: moderateScale(6),
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
    elevation: 10,
  },
  segmentLabel: {
    color: '#FFFFFF',
    fontSize: moderateScale(10),
    fontWeight: '600',
  },
  segmentsList: {
    marginTop: moderateScale(10),
    padding: moderateScale(10),
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: moderateScale(8),
  },
  segmentsListTitle: {
    color: '#FFD700',
    fontSize: moderateScale(13),
    fontWeight: '700',
    marginBottom: moderateScale(8),
  },
  segmentListItem: {
    backgroundColor: 'rgba(37, 155, 154, 0.3)',
    padding: moderateScale(12),
    borderRadius: moderateScale(6),
    marginBottom: moderateScale(6),
    borderWidth: 2,
    borderColor: '#259B9A',
  },
  segmentListItemDeleted: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderColor: '#FF3B30',
    opacity: 0.6,
  },
  segmentListItemText: {
    color: '#FFFFFF',
    fontSize: moderateScale(12),
    fontWeight: '600',
  },
  segmentListItemTextDeleted: {
    textDecorationLine: 'line-through',
    color: 'rgba(255, 255, 255, 0.5)',
  },
});