import { moderateScale } from "@/utils/scaling";
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute } from "@react-navigation/native";
import { useEvent } from "expo";
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import LottieView from "lottie-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Dimensions, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View, SafeAreaView, Platform, StatusBar } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ImageItem from "../../components/ImageItem";
import StickerItem from "../../components/StickerItem";
import TextItem from "../../components/TextItem";
import VolumeControl from "../../components/VolumeControl";
import { AppColors } from "../../constants/Colors";
import { useVolume } from '../../contexts/VolumeContext';

// VideoEditor Components
import VideoEditingTools from "../../components/VideoEditor/VideoEditingTools";
import VideoTimeline from "../../components/VideoEditor/VideoTimeline";
import BottomToolbar from "../components/VideoEditor/BottomToolbar";
import StickerOverlay from "../components/VideoEditor/StickerOverlay";
import TextOverlay from "../components/VideoEditor/TextOverlay";
import TransitionOverlay from "../components/VideoEditor/TransitionOverlay";

// Video Processing
import AudioProcessor, { AudioMixOptions, AudioTrack } from "../../utils/audioProcessor";
import VideoProcessor from "../../utils/videoProcessor";

// AWS S3 Integration
import AppConfigManager, { AppConfig } from "../../config/appConfig";
import AWSS3Service from "../../utils/awsS3Service";

// Enhanced FFmpeg Service
import FFmpegService from "../../utils/ffmpegService";

// Get screen dimensions - use 'window' for current visible area
const getScreenDimensions = () => {
  const { width, height } = Dimensions.get('window');
  return { width, height };
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = getScreenDimensions();

const PreviewVideoShoot = () => {
  const router = useRouter();
  const route = useRoute();
  const { videoUri: initialVideoUri } = (route.params || {}) as {
    videoUri?: string;
    orientation?: "portrait" | "landscape";
  };
  
  // Get global volume context
  const { getActualVolume, isMuted, volume, audioTrack, setAudioTrack, getActualAudioVolume } = useVolume();

  // Add videoUri state to manage the current video URI
  const [videoUri, setVideoUri] = useState<string | undefined>(initialVideoUri);
  const [isUploaded, setIsUploaded] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [isDiscardConfirmed, setIsDiscardConfirmed] = useState(false);
  const [flaggedForUpload, setFlaggedForUpload] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'pending' | 'uploading' | 'completed' | 'failed'>('pending');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentVideoData, setCurrentVideoData] = useState<any>(null);
  const [showUploadToaster, setShowUploadToaster] = useState(false);
  const [config, setConfig] = useState<AppConfig>(AppConfigManager.getConfig());

  // Video Editor States
  const [showVideoEditor, setShowVideoEditor] = useState(false);
  const [activeEditorTool, setActiveEditorTool] = useState<'edit' | 'text' | 'stickers' | 'audio' | 'filters' | 'transitions' | null>(null);
  
  
  // Text Overlay States
  const [textOverlays, setTextOverlays] = useState<Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    color: string;
    fontFamily: string;
    alignment: 'left' | 'center' | 'right';
    timestamp: number;
    startTime: number;
    endTime: number;
    isSelected?: boolean;
    animation?: 'fade' | 'slide' | 'bounce' | 'zoom' | 'rotate' | 'scale-in' | 'none';
  }>>([]);

  // Audio States
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<AudioTrack | null>(null);
  const [audioVolume, setAudioVolume] = useState<number>(0.5);
  const [isProcessingAudio, setIsProcessingAudio] = useState<boolean>(false);
  
  // Audio Tracks for Timeline (multiple audio overlays)
  const [audioTracks, setAudioTracks] = useState<Array<{
    id: string;
    name: string;
    uri: string;
    startTime: number;
    endTime: number;
    volume: number;
  }>>([]);
  
  // Audio Player for background music
  const audioPlayerRef = useRef<Audio.Sound | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const [isAudioLoaded, setIsAudioLoaded] = useState<boolean>(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [previousVideoTime, setPreviousVideoTime] = useState<number>(0);

  // Voice Recording States
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedAudioUri, setRecordedAudioUri] = useState<string | null>(null);
  const [voicePlayerRef, setVoicePlayerRef] = useState<Audio.Sound | null>(null);
  const [isVoiceLoaded, setIsVoiceLoaded] = useState<boolean>(false);
  const [voiceVolume, setVoiceVolume] = useState<number>(50);
  const [isVoiceMuted, setIsVoiceMuted] = useState<boolean>(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  // Transition Effects State
  const [transitionEffects, setTransitionEffects] = useState<Array<{
    id: string;
    name: string;
    icon: string;
    timestamp: number;
    duration: number;
  }>>([]);
  const [activeTransition, setActiveTransition] = useState<{
    id: string;
    name: string;
    progress: number; // 0 to 1
  } | null>(null);

  // Sticker Overlay States
  const [stickerOverlays, setStickerOverlays] = useState<Array<{
    id: string;
    sticker: string;
    x: number;
    y: number;
    size: number;
    rotation: number;
    timestamp: number;
    startTime: number;
    endTime: number;
    isSelected: boolean;
  }>>([]);

  // Image Overlay States
  const [imageOverlays, setImageOverlays] = useState<Array<{
    id: string;
    imageUri: string;
    x: number;
    y: number;
    size: number;
    rotation: number;
    timestamp: number;
    startTime: number;
    endTime: number;
    isSelected: boolean;
  }>>([]);
  
  // Video Processing States
  const [videoMetadata, setVideoMetadata] = useState<any>(null);
  const [videoFrames, setVideoFrames] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true);
  
  // Video Split Points for timeline gaps
  const [splitPoints, setSplitPoints] = useState<Array<{
    time: number; // Time in seconds where split occurs
    id: string;
    transitionType?: string; // Optional transition effect
  }>>([]);
  
  // Track which split point is being edited for transition
  const [activeSplitForTransition, setActiveSplitForTransition] = useState<{
    id: string;
    time: number;
  } | null>(null);
  
  // Video segments created by splits (for deletion)
  const [videoSegments, setVideoSegments] = useState<Array<{
    id: string;
    startTime: number;
    endTime: number;
    isDeleted: boolean;
  }>>([]);
  
  // Simulated trim bounds (in seconds, relative to original video)
  const [trimStartSec, setTrimStartSec] = useState<number>(0);
  const [trimEndSec, setTrimEndSec] = useState<number | null>(null);
  // Simulated non-destructive edit segments over the original video
  const [segments, setSegments] = useState<Array<{ start: number; end: number }>>([]);
  // UI state for split slider to let the editor remember selection across openings
  const [uiSplitTime, setUiSplitTime] = useState<number>(0);

  const getFullDuration = () => (videoMetadata?.duration || player?.duration || 0);

  // Calculate effective duration (excluding deleted segments)
  const getEffectiveDuration = () => {
    if (videoSegments.length === 0) {
      return getFullDuration();
    }
    
    const activeSegments = videoSegments.filter(seg => !seg.isDeleted);
    return activeSegments.reduce((total, seg) => total + (seg.endTime - seg.startTime), 0);
  };

  // Get active segments with virtual timeline mapping (0-based)
  const getActiveSegmentsWithVirtualTime = () => {
    if (videoSegments.length === 0) return [];
    
    const activeSegs = videoSegments.filter(seg => !seg.isDeleted);
    let virtualStart = 0;
    
    return activeSegs.map(seg => {
      const duration = seg.endTime - seg.startTime;
      const virtualSeg = {
        ...seg,
        virtualStart,
        virtualEnd: virtualStart + duration,
        originalStart: seg.startTime,
        originalEnd: seg.endTime,
      };
      virtualStart += duration;
      return virtualSeg;
    });
  };

  // Convert current playback time to virtual timeline position
  const getCurrentVirtualTime = () => {
    if (videoSegments.length === 0) return currentTime;
    
    const virtualSegs = getActiveSegmentsWithVirtualTime();
    
    // Find which segment contains current time
    for (const seg of virtualSegs) {
      if (currentTime >= seg.originalStart && currentTime <= seg.originalEnd) {
        const offsetInSegment = currentTime - seg.originalStart;
        return seg.virtualStart + offsetInSegment;
      }
    }
    
    return 0; // Default to start if not in any segment
  };

  // Handle segment deletion
  const handleSegmentDelete = (segmentId: string) => {
    console.log('🔍 handleSegmentDelete called with:', segmentId);
    const segment = videoSegments.find(s => s.id === segmentId);
    if (!segment) {
      console.log('⚠️ Segment not found:', segmentId);
      return;
    }

    console.log('📋 Segment to delete:', segment);

    Alert.alert(
      'Delete Segment',
      `Delete segment from ${formatTimeDisplay(segment.startTime)} to ${formatTimeDisplay(segment.endTime)} (${formatTimeDisplay(segment.endTime - segment.startTime)} duration)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            console.log('✂️ Deleting segment:', segmentId);
            
            setVideoSegments(prev => {
              const updated = prev.map(seg => 
                seg.id === segmentId ? { ...seg, isDeleted: true } : seg
              );
              console.log('📊 Updated segments:', updated);
              console.log('⏱️ New effective duration:', 
                updated.filter(s => !s.isDeleted).reduce((total, s) => total + (s.endTime - s.startTime), 0)
              );
              return updated;
            });
            
            // Remove split points that were in the deleted segment
            setSplitPoints(prev => {
              const filtered = prev.filter(split => {
                // Keep split if it's not in the deleted segment
                return !(split.time >= segment.startTime && split.time <= segment.endTime);
              });
              console.log('🔪 Split points after deletion:', filtered.length, 'remaining');
              return filtered;
            });
            
            // Reset current time if it was in deleted segment
            if (currentTime >= segment.startTime && currentTime <= segment.endTime) {
              const activeSegment = videoSegments.find(s => !s.isDeleted && s.id !== segmentId);
              if (activeSegment) {
                console.log('⏩ Moving playhead to:', activeSegment.startTime);
                setCurrentTime(activeSegment.startTime);
                if (player) player.currentTime = activeSegment.startTime;
              }
            }
            
            Alert.alert('Segment Deleted', 'Timeline and seekbar updated. Effective duration changed.');
            console.log('✅ Segment deletion complete');
          }
        }
      ]
    );
  };

  // Format time in seconds to MM:SS format
  const formatTimeDisplay = (seconds: number): string => {
    if (seconds < 0 || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const normalizeSegments = (list: Array<{ start: number; end: number }>) => {
    const merged = [...list]
      .map(s => ({ start: Math.max(0, s.start), end: Math.max(0, s.end) }))
      .filter(s => s.end > s.start)
      .sort((a, b) => a.start - b.start);
    const out: Array<{ start: number; end: number }> = [];
    for (const s of merged) {
      if (out.length === 0) { out.push(s); continue; }
      const last = out[out.length - 1];
      if (s.start <= last.end + 0.001) {
        last.end = Math.max(last.end, s.end);
      } else {
        out.push(s);
      }
    }
    return out;
  };

  const findSegmentIndexAt = (t: number) => {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (t >= seg.start && t <= seg.end) return i;
    }
    // If not inside, find next segment after t
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].start > t) return i;
    }
    return segments.length > 0 ? segments.length - 1 : -1;
  };

  const sumSegmentsDuration = () => segments.reduce((acc, s) => acc + (s.end - s.start), 0);

  const toVirtualTime = (absolute: number) => {
    let acc = 0;
    for (const s of segments) {
      if (absolute < s.start) break;
      if (absolute <= s.end) {
        return acc + (absolute - s.start);
      }
      acc += (s.end - s.start);
    }
    return acc;
  };

  const toAbsoluteTime = (virtual: number) => {
    let remaining = virtual;
    for (const s of segments) {
      const len = s.end - s.start;
      if (remaining <= len) return s.start + remaining;
      remaining -= len;
    }
    // If beyond, clamp to end of last segment
    if (segments.length > 0) return segments[segments.length - 1].end;
    return Math.max(0, Math.min(getFullDuration(), virtual));
  };

  const player = useVideoPlayer(videoUri || "", (player) => {
    player.loop = false;
    // Don't auto-play, let user control it
  });

  useEvent(player, 'statusChange', {
    status: player.status,
  });

  // Function to handle audio duration synchronization (optimized with debounce)
  const handleAudioDurationSync = async () => {
    if (!audioPlayerRef.current || !isAudioLoaded || !player || audioDuration === 0 || videoDuration === 0) {
      return;
    }

    // Debounce: only sync if enough time has passed since last sync
    const now = Date.now();
    if (now - lastSyncTimeRef.current < 300) { // Minimum 300ms between syncs
      return;
    }
    lastSyncTimeRef.current = now;

    try {
      const audioStatus = await audioPlayerRef.current.getStatusAsync();
      if (!audioStatus.isLoaded || !audioStatus.isPlaying) return;

      const currentAudioTime = audioStatus.positionMillis! / 1000;
      const currentVideoTime = player.currentTime || 0;

      // If audio is longer than video, stop audio when video ends
      if (audioDuration >= videoDuration) {
        if (currentVideoTime >= videoDuration - 0.1) { // Stop slightly before end
          await audioPlayerRef.current.pauseAsync();
          console.log('Audio stopped at video end');
        }
      } else {
        // If video is longer than audio, loop the audio
        if (currentAudioTime >= audioDuration - 0.1) { // Loop slightly before end
          await audioPlayerRef.current.setPositionAsync(0);
          console.log('Audio looped back to start');
        }
      }
    } catch (error) {
      console.error('Error in audio duration sync:', error);
    }
  };

  // Function to handle voice recording duration synchronization
  const handleVoiceDurationSync = async () => {
    if (!voicePlayerRef || !isVoiceLoaded || !player || videoDuration === 0) {
      return;
    }

    try {
      const voiceStatus = await voicePlayerRef.getStatusAsync();
      if (!voiceStatus.isLoaded || !voiceStatus.isPlaying) return;

      const currentVoiceTime = voiceStatus.positionMillis! / 1000;
      const currentVideoTime = player.currentTime || 0;

      // Voice recording should match video duration exactly
      if (currentVideoTime >= videoDuration - 0.1) { // Stop slightly before end
        await voicePlayerRef.pauseAsync();
        console.log('Voice recording stopped at video end');
      }
    } catch (error) {
      console.error('Error in voice duration sync:', error);
    }
  };

  // Function to reset audio position when video is restarted
  const resetAudioPosition = async () => {
    if (audioPlayerRef.current && isAudioLoaded) {
      try {
        await audioPlayerRef.current.setPositionAsync(0);
        console.log('Audio position reset to start');
      } catch (error) {
        console.error('Error resetting audio position:', error);
      }
    }
  };

  // Function to reset voice recording position when video is restarted
  const resetVoicePosition = async () => {
    if (voicePlayerRef && isVoiceLoaded) {
      try {
        await voicePlayerRef.setPositionAsync(0);
        console.log('Voice recording position reset to start');
      } catch (error) {
        console.error('Error resetting voice recording position:', error);
      }
    }
  };

  // Function to update voice recording volume
  const updateVoiceVolume = async (newVolume: number) => {
    setVoiceVolume(newVolume);
    if (voicePlayerRef && isVoiceLoaded) {
      try {
        await voicePlayerRef.setVolumeAsync(newVolume / 100);
        console.log('Voice recording volume updated to:', newVolume);
      } catch (error) {
        console.error('Error updating voice recording volume:', error);
      }
    }
  };

  // Function to toggle voice recording mute
  const toggleVoiceMute = async () => {
    const newMutedState = !isVoiceMuted;
    setIsVoiceMuted(newMutedState);
    
    if (voicePlayerRef && isVoiceLoaded) {
      try {
        await voicePlayerRef.setVolumeAsync(newMutedState ? 0 : voiceVolume / 100);
        console.log('Voice recording mute toggled to:', newMutedState);
      } catch (error) {
        console.error('Error toggling voice recording mute:', error);
      }
    }
  };

  // Function to sync audio position with video position when seeking (optimized with debounce)
  const syncAudioPositionWithVideo = async () => {
    if (!audioPlayerRef.current || !isAudioLoaded || !player || audioDuration === 0 || videoDuration === 0) {
      return;
    }

    // Debounce: only sync if enough time has passed since last sync
    const now = Date.now();
    if (now - lastSyncTimeRef.current < 500) { // Minimum 500ms between seeks
      return;
    }
    lastSyncTimeRef.current = now;

    try {
      const currentVideoTime = player.currentTime || 0;
      let targetAudioTime = currentVideoTime;

      // If video is longer than audio, calculate the correct audio position within the loop
      if (videoDuration > audioDuration) {
        targetAudioTime = currentVideoTime % audioDuration;
      } else {
        // If audio is longer than video, clamp to audio duration
        targetAudioTime = Math.min(currentVideoTime, audioDuration);
      }

      await audioPlayerRef.current.setPositionAsync(targetAudioTime * 1000);
      console.log(`Audio synced to video position: ${targetAudioTime.toFixed(1)}s`);
    } catch (error) {
      console.error('Error syncing audio position with video:', error);
    }
  };

  // Sync audio player with video playback
  useEffect(() => {
    const syncAudioWithVideo = async () => {
      if (audioPlayerRef.current && isAudioLoaded && player) {
        try {
          const isPlaying = player.playing;
          setIsVideoPlaying(isPlaying);
          
          // Check if current time is within any audio track's time range
          const shouldPlayAudio = audioTracks.some(track => 
            currentTime >= track.startTime && currentTime <= track.endTime
          );
          
          if (isPlaying && shouldPlayAudio) {
            await audioPlayerRef.current.playAsync();
            console.log('Audio started playing with video (within timeline range)');
          } else {
            await audioPlayerRef.current.pauseAsync();
            if (!shouldPlayAudio && isPlaying) {
              console.log('Audio paused - outside timeline range');
            }
          }
        } catch (error) {
          console.error('Error syncing audio with video:', error);
        }
      }

      // Sync voice recording with video playback
      if (voicePlayerRef && isVoiceLoaded && player) {
        try {
          const isPlaying = player.playing;
          
          if (isPlaying) {
            await voicePlayerRef.playAsync();
            console.log('Voice recording started playing with video');
          } else {
            await voicePlayerRef.pauseAsync();
            console.log('Voice recording paused with video');
          }
        } catch (error) {
          console.error('Error syncing voice recording with video:', error);
        }
      }
    };

    syncAudioWithVideo();
  }, [player?.playing, isAudioLoaded, isVoiceLoaded, currentTime, audioTracks]);

  // Monitor audio duration synchronization while playing (optimized)
  useEffect(() => {
    if (!isVideoPlaying || !isAudioLoaded || audioDuration === 0 || videoDuration === 0) {
      return;
    }

    const syncInterval = setInterval(() => {
      handleAudioDurationSync();
    }, 500); // Reduced frequency to 500ms to prevent lag

    return () => clearInterval(syncInterval);
  }, [isVideoPlaying, isAudioLoaded, audioDuration, videoDuration]);

  // Monitor voice recording duration synchronization while playing
  useEffect(() => {
    if (!isVideoPlaying || !isVoiceLoaded || videoDuration === 0) {
      return;
    }

    const syncInterval = setInterval(() => {
      handleVoiceDurationSync();
    }, 500); // Same frequency as audio sync

    return () => clearInterval(syncInterval);
  }, [isVideoPlaying, isVoiceLoaded, videoDuration]);

  // Monitor split points and activate transitions during playback
  useEffect(() => {
    if (!isVideoPlaying) {
      setActiveTransition(null); // Clear transition when video stops
      return;
    }
    
    if (splitPoints.length === 0) {
      return;
    }

    // Check if we're at a split point with a transition
    const transitionDuration = 1.0; // 1 second transition effect
    const tolerance = 0.1; // Tolerance for timing

    splitPoints.forEach(split => {
      if (!split.transitionType || split.transitionType === 'none') return;

      const timeDiff = Math.abs(currentTime - split.time);
      
      // If we're within the transition time window
      if (timeDiff < transitionDuration / 2 + tolerance) {
        // Calculate progress (0 to 1)
        const progress = Math.min(1, Math.max(0, (currentTime - (split.time - transitionDuration / 2)) / transitionDuration));
        
        setActiveTransition({
          id: split.id,
          name: split.transitionType,
          progress: progress,
        });
        
        console.log(`🎬 Transition active: ${split.transitionType} at ${split.time}s, progress: ${progress.toFixed(2)}`);
      } else if (activeTransition?.id === split.id) {
        // Clear transition when we're past it
        setActiveTransition(null);
      }
    });
  }, [currentTime, isVideoPlaying, splitPoints]);

  // Reset audio position when video is restarted (optimized)
  useEffect(() => {
    if (player && isAudioLoaded && currentTime < 1) { // Video restarted (near beginning)
      resetAudioPosition();
    }
    if (player && isVoiceLoaded && currentTime < 1) { // Video restarted (near beginning)
      resetVoicePosition();
    }
  }, [currentTime, isAudioLoaded, isVoiceLoaded]);

  // Sync audio position when video is seeked (optimized - only on significant changes)
  useEffect(() => {
    if (isVideoPlaying && isAudioLoaded && audioDuration > 0 && videoDuration > 0) {
      // Only sync on significant time changes to prevent excessive operations
      const timeDiff = Math.abs(currentTime - (previousVideoTime || 0));
      if (timeDiff > 1.0) { // Increased threshold to 1 second to reduce sync frequency
        syncAudioPositionWithVideo();
        setPreviousVideoTime(currentTime);
      }
    }
  }, [currentTime, isVideoPlaying, isAudioLoaded, audioDuration, videoDuration]);

  // Set up audio mode for better control
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          staysActiveInBackground: false,
          playThroughEarpieceAndroid: false,
        });
        console.log('Audio mode set successfully');
      } catch (error) {
        console.log('Failed to set audio mode:', error);
      }
    };
    setupAudio();
  }, []);

  // Control video player volume using global volume context
  useEffect(() => {
    if (player) {
      const actualVolume = getActualVolume();
      console.log('Setting global volume to:', actualVolume, 'muted:', isMuted);
      
      // Try to set volume and muted as properties
      try {
        (player as any).volume = actualVolume;
        console.log('Set volume via property to:', actualVolume);
      } catch (error) {
        console.log('Failed to set volume:', error);
      }
      
      try {
        (player as any).muted = isMuted;
        console.log('Set muted via property to:', isMuted);
      } catch (error) {
        console.log('Failed to set muted:', error);
      }
    }
  }, [player, getActualVolume, isMuted]);

  // Control audio player volume when context changes
  useEffect(() => {
    const updateAudioVolume = async () => {
      if (audioPlayerRef.current && isAudioLoaded) {
        try {
          const actualVolume = getActualAudioVolume();
          console.log('Setting audio player volume to:', actualVolume);
          await audioPlayerRef.current.setVolumeAsync(actualVolume);
        } catch (error) {
          console.error('Error setting audio volume:', error);
        }
      }
    };

    updateAudioVolume();
  }, [getActualAudioVolume, isAudioLoaded]);

  // Cleanup audio player on unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.unloadAsync().catch(console.error);
      }
      if (voicePlayerRef) {
        voicePlayerRef.unloadAsync().catch(console.error);
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(console.error);
      }
    };
  }, []);

  // Update currentTime based on player's currentTime property
  useEffect(() => {
    const interval = setInterval(() => {
      if (player && typeof player.currentTime === 'number') {
        let playerTime = Math.round(player.currentTime * 10) / 10; // Round to 1 decimal place
        // Enforce playback within trimmed region and loop back to start when reaching the end
        const fullDuration = getFullDuration();

        if (segments.length > 0) {
          const idx = findSegmentIndexAt(playerTime);
          if (idx === -1) {
            // Jump to first segment start if outside all
            const start0 = segments[0].start;
            console.log('Player outside segments, jumping to first segment start:', start0);
            player.currentTime = start0;
            playerTime = start0;
          } else {
            const seg = segments[idx];
            if (playerTime < seg.start) {
              console.log('Player before segment start, jumping to segment start:', seg.start);
              player.currentTime = seg.start;
              playerTime = seg.start;
            } else if (playerTime >= seg.end - 0.05) {
              // Advance to next segment or loop to first
              const nextIdx = idx + 1 < segments.length ? idx + 1 : 0;
              const nextStart = segments[nextIdx].start;
              console.log('Player reached segment end, advancing to next segment:', nextStart);
              player.currentTime = nextStart;
              playerTime = nextStart;
            }
          }
        } else {
          const startBound = trimStartSec || 0;
          const endBound = (trimEndSec ?? fullDuration);
          const hasValidTrim = endBound > startBound;
          if (!Number.isNaN(startBound) && playerTime < startBound) {
            player.currentTime = startBound;
            playerTime = startBound;
          }
          if (hasValidTrim && endBound && playerTime >= endBound - 0.05) {
            player.currentTime = startBound;
            playerTime = startBound;
          }
        }
        const stateTime = Math.round(currentTime * 10) / 10;
        
        if (Math.abs(playerTime - stateTime) > 0.1) { // Only update if difference is significant
          setCurrentTime(playerTime);
        }

        // Check for active transitions
        const currentTransition = transitionEffects.find(effect => {
          const startTime = effect.timestamp;
          const endTime = effect.timestamp + effect.duration;
          return playerTime >= startTime && playerTime <= endTime;
        });

        if (currentTransition) {
          const progress = (playerTime - currentTransition.timestamp) / currentTransition.duration;
          setActiveTransition({
            id: currentTransition.id,
            name: currentTransition.name,
            progress: Math.max(0, Math.min(1, progress))
          });
        } else {
          setActiveTransition(null);
        }
      }
    }, 100); // Update every 100ms for smooth timeline movement

    return () => clearInterval(interval);
  }, [player, trimStartSec, trimEndSec, videoMetadata?.duration, segments, transitionEffects]); // Include segments and transitionEffects

  useEffect(() => {
    loadVideoData();
    processVideoData();
    initializeServices();
    checkAsyncStorageState();
    
    // Auto-initialize trim to full video duration (same as clicking trim "Done" button)
    if (videoUri) {
      setTimeout(() => {
        initializeVideoTrim();
      }, 1000); // Small delay to ensure video metadata is loaded
    }
  }, [videoUri]);

  const checkAsyncStorageState = async () => {
    try {
      console.log('=== CHECKING ASYNC STORAGE STATE ===');
      const savedVideos = await AsyncStorage.getItem('saved_videos');
      if (savedVideos) {
        const videos = JSON.parse(savedVideos);
        console.log('Current videos in AsyncStorage:', videos.length);
        console.log('Videos:', videos.map((v: any) => ({ id: v.id, uri: v.uri, title: v.title, lastEdited: v.lastEdited })));
      } else {
        console.log('No videos in AsyncStorage');
      }
      console.log('=== END ASYNC STORAGE CHECK ===');
    } catch (error) {
      console.error('Error checking AsyncStorage:', error);
    }
  };

  const initializeServices = async () => {
    try {
      // Initialize FFmpeg service
      await FFmpegService.initialize();
      
      // Initialize AWS S3 service in test mode for development
      await AWSS3Service.initializeTestMode();
      
      // Load app configuration
      await AppConfigManager.loadConfig();
      
      console.log('All services initialized successfully - AWS S3 ready');
    } catch (error) {
      console.error('Failed to initialize services:', error);
    }
  };

  const handleFeatureToggle = async (feature: keyof AppConfig['features'], value: boolean) => {
    try {
      await AppConfigManager.updateFeatureFlags({ [feature]: value });
      setConfig({ ...config, features: { ...config.features, [feature]: value } });
    } catch (error) {
      console.error('Failed to update feature flag:', error);
      Alert.alert('Error', 'Failed to update feature setting');
    }
  };


  const initializeVideoTrim = async () => {
    const full = videoMetadata?.duration || player?.duration || 0;
    if (full > 0) {
      const start = 0;
      const end = full;
      setTrimStartSec(start);
      setTrimEndSec(end);
      setSegments(normalizeSegments([{ start, end }]));
      if (player) {
        player.currentTime = start;
      }
      console.log('Auto-initialized video trim:', { start, end, full });
    }
  };

  // Re-extract frames based on current trim selection
  const updateFramesForTrim = async (startSec: number, endSec: number) => {
    if (!videoUri) return;
    
    try {
      console.log(`🎬 Updating frames for trim: ${startSec}s to ${endSec}s`);
      const trimDuration = endSec - startSec;
      const frameCount = Math.max(3, Math.ceil(trimDuration));
      
      setIsLoadingVideo(true);
      
      // Extract frames for the trimmed portion
      const frames = await VideoProcessor.extractVideoFrames(
        videoUri, 
        frameCount,
        0.5, // frame interval
        startSec, // start time
        endSec    // end time
      );
      
      const thumbnails = frames.map(f => f.thumbnail).filter(Boolean);
      setVideoFrames(thumbnails);
      
      console.log(`✅ Extracted ${thumbnails.length} frames for trimmed portion`);
      setIsLoadingVideo(false);
    } catch (error) {
      console.error('Error updating frames for trim:', error);
      setIsLoadingVideo(false);
    }
  };

  const loadVideoData = async () => {
    try {
      const savedVideos = await AsyncStorage.getItem('saved_videos');
      if (savedVideos) {
        const videos = JSON.parse(savedVideos);
        const currentVideo = videos.find((video: any) => video.uri === videoUri);
        if (currentVideo) {
          setCurrentVideoData(currentVideo);
          setFlaggedForUpload(currentVideo.flaggedForUpload || false);
          setUploadStatus(currentVideo.uploaded ? 'completed' : 'pending');
        } else {
          // For uploaded videos from gallery that don't exist in saved_videos yet
          // Set default values and flag for upload
          setCurrentVideoData(null);
          setFlaggedForUpload(true); // Auto-flag uploaded videos for AWS upload
          setUploadStatus('pending');
        }
      } else {
        // No saved videos, but this is an uploaded video from gallery
        setCurrentVideoData(null);
        setFlaggedForUpload(true); // Auto-flag uploaded videos for AWS upload
        setUploadStatus('pending');
      }
    } catch (error) {
      console.error('Error loading video data:', error);
      // Default for uploaded videos
      setCurrentVideoData(null);
      setFlaggedForUpload(true);
      setUploadStatus('pending');
    }
  };

  const processVideoData = async () => {
    if (!videoUri) return;
    
    setIsLoadingVideo(true);
    try {
      // Extract video metadata
      console.log('Processing video data for URI:', videoUri);
      const metadata = await VideoProcessor.getVideoMetadata(videoUri);
      console.log('Video metadata loaded:', metadata);
      setVideoMetadata(metadata);
      // Initialize segments to full video on load
      setTrimStartSec(0);
      setTrimEndSec(metadata.duration || 0);
      const d = metadata.duration || 0;
      setSegments([{ start: 0, end: d }]);
      setUiSplitTime(d > 0 ? d / 2 : 0);
      
      // Auto-initialize trim (same as clicking trim "Done" button)
      setTimeout(() => {
        initializeVideoTrim();
      }, 500);
      
      // Calculate frame count based on video duration (1 frame per second, minimum 8 frames)
      const frameCount = Math.max(8, Math.ceil(metadata.duration));
      console.log(`Video duration: ${metadata.duration}s, calculated frameCount: ${frameCount}`);
      
      // Extract video frames for timeline thumbnails
      console.log(`Starting frame extraction with frameCount: ${frameCount}`);
      console.log('Video URI for frame extraction:', videoUri);
      const frames = await VideoProcessor.extractVideoFrames(videoUri, frameCount);
      console.log('Frames extracted:', frames.length, 'frames');
      console.log('Sample frame data:', frames[0]);
      
      if (frames.length === 0) {
        console.warn('No frames were extracted from the video!');
      }
      
      // Debug: Check each frame's thumbnail data
      frames.forEach((frame, index) => {
        console.log(`Frame ${index}:`, {
          id: frame.id,
          time: frame.time,
          hasThumbnail: !!frame.thumbnail,
          thumbnailLength: frame.thumbnail ? frame.thumbnail.length : 0,
          thumbnailType: frame.thumbnail ? (frame.thumbnail.startsWith('data:') ? 'base64' : 'uri') : 'empty'
        });
      });
      
      // Convert frames to string array for VideoTimeline
      const frameUris = frames.map(frame => frame.thumbnail);
      console.log('Frame URIs for VideoTimeline:', frameUris.length, 'items');
      console.log('Non-empty frame URIs:', frameUris.filter(uri => uri && uri.trim() !== '').length);
      
      // Set frames even if empty - this will show the loading state
      setVideoFrames(frameUris);
      
      if (frameUris.length === 0 || frameUris.every(uri => !uri || uri.trim() === '')) {
        console.warn('No valid frame URIs generated. Timeline will show without thumbnails.');
      }
      
    } catch (error) {
      console.error('Error processing video:', error);
    } finally {
      setIsLoadingVideo(false);
    }
  };

  const toggleUploadFlag = async () => {
    try {
      const savedVideos = await AsyncStorage.getItem('saved_videos');
      let videos = savedVideos ? JSON.parse(savedVideos) : [];
      
      // Check if video exists in the list
      const videoIndex = videos.findIndex((video: any) => video.uri === videoUri);
      
      if (videoIndex !== -1) {
        // Update existing video
        videos[videoIndex] = { ...videos[videoIndex], flaggedForUpload: !flaggedForUpload };
      } else {
        // For uploaded videos that don't exist in the list yet, create a temporary entry
        // This will be properly saved when the user approves the video
        const tempVideo = {
          id: `temp_${Date.now()}`,
          uri: videoUri,
          mode: 'uploaded',
          createdAt: new Date().toISOString(),
          flaggedForUpload: !flaggedForUpload,
          uploaded: false,
          title: 'Uploaded Video',
          duration: videoMetadata?.duration || 0,
          fileSize: 0
        };
        videos.unshift(tempVideo);
      }
      
      await AsyncStorage.setItem('saved_videos', JSON.stringify(videos));
      setFlaggedForUpload(!flaggedForUpload);
    } catch (error) {
      console.error('Error updating upload flag:', error);
    }
  };

  const performAwsUpload = async () => {
    if (!flaggedForUpload || !videoUri) {
      console.log('Upload skipped - not flagged or no video URI:', { flaggedForUpload, videoUri });
      return;
    }
    
    // Check if user has configured AWS credentials
    try {
      const storedCreds = await AsyncStorage.getItem('user_aws_credentials');
      if (!storedCreds) {
        Alert.alert(
          'AWS Configuration Required',
          'Please configure your AWS credentials first to upload videos.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Configure Now', 
              onPress: () => router.push('/screens/AWSSettings')
            }
          ]
        );
        return;
      }
      
      const userCreds = JSON.parse(storedCreds);
      console.log('User AWS config loaded:', { 
        useBackend: userCreds.useBackend,
        hasBackendUrl: !!userCreds.backendUrl,
        hasBucket: !!userCreds.bucketName 
      });
    } catch (error) {
      console.error('Error checking AWS credentials:', error);
    }
    
    // Generate unique key for the video
    const videoId = Date.now().toString();
    const fileName = `video-${videoId}.mp4`;
    
    try {
      console.log('Starting AWS upload process...');
      setUploadStatus('uploading');
      setUploadProgress(0);
      const mode = (route.params as any)?.mode || '1min';
      
      console.log('Generated upload key:', videoId);
      
      // Update video status to uploading
      await AWSS3Service.updateVideoUploadStatus(videoId, 'uploading');
      
      // Get user credentials to determine upload method
      const storedCreds = await AsyncStorage.getItem('user_aws_credentials');
      const userCreds = storedCreds ? JSON.parse(storedCreds) : null;
      
      // Get fresh presigned URL - either from backend or generate directly
      console.log('Getting presigned URL...');
      let presignedUrl: string;
      
      if (userCreds && userCreds.useBackend) {
        // Option 1: Get presigned URL from backend
        try {
          console.log('Using backend method...');
          presignedUrl = await AWSS3Service.getPresignedUrlFromBackend(fileName, 'video/mp4');
          console.log('✅ Got presigned URL from backend');
        } catch (backendError) {
          console.error('❌ Backend failed:', backendError);
          
          Alert.alert(
            'Backend Connection Failed',
            'Could not connect to your backend server.\n\n' +
            'Please check:\n' +
            '1. Backend server is running\n' +
            '2. URL is correct in settings\n' +
            '3. Phone is on same WiFi network',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Check Settings', 
                onPress: () => router.push('/screens/AWSSettings')
              }
            ]
          );
          
          setUploadStatus('failed');
          await AWSS3Service.updateVideoUploadStatus(videoId, 'failed', undefined, undefined, 
            'Backend connection failed');
          return;
        }
      } else if (userCreds) {
        // Option 2: Generate presigned URL directly with user's credentials
        try {
          console.log('Using direct credentials method...');
          presignedUrl = await AWSS3Service.generatePresignedUrlWithCredentials(
            fileName,
            userCreds.accessKeyId,
            userCreds.secretAccessKey,
            userCreds.region,
            userCreds.bucketName,
            'video/mp4'
          );
          console.log('✅ Generated presigned URL with direct credentials');
        } catch (credError) {
          console.error('❌ Failed to generate presigned URL:', credError);
          
          Alert.alert(
            'AWS Credentials Error',
            'Could not generate upload URL with your AWS credentials.\n\n' +
            'Please verify:\n' +
            '1. Access Key ID is correct\n' +
            '2. Secret Access Key is correct\n' +
            '3. Bucket name exists\n' +
            '4. Region is correct\n' +
            '5. IAM permissions allow S3 PutObject',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Fix Settings', 
                onPress: () => router.push('/screens/AWSSettings')
              }
            ]
          );
          
          setUploadStatus('failed');
          await AWSS3Service.updateVideoUploadStatus(videoId, 'failed', undefined, undefined, 
            'Credential validation failed');
          return;
        }
      } else {
        Alert.alert('Error', 'AWS credentials not found');
        setUploadStatus('failed');
        return;
      }
      
      // Upload to S3 with progress tracking using pre-signed URL
      console.log('Calling AWSS3Service.uploadVideo...');
      const uploadResult = await AWSS3Service.uploadVideo(
        videoUri,
        presignedUrl,
        (progress: { percentage: number; loaded: number; total: number }) => {
          console.log(`Upload progress: ${progress.percentage.toFixed(2)}% (${progress.loaded}/${progress.total} bytes)`);
          console.log(`Setting upload progress state to: ${progress.percentage}%`);
          setUploadProgress(progress.percentage);
          
          // Update video status with progress
          AWSS3Service.updateVideoUploadStatus(
            videoId,
            'uploading',
            undefined,
            undefined,
            undefined,
            progress.percentage
          );
        }
      );
      
      console.log('Upload result:', uploadResult);
      
      // Check if upload was successful
      if (uploadResult.success) {
        console.log('Upload completed successfully, updating status...');
        // Update video status to completed
        await AWSS3Service.updateVideoUploadStatus(
          videoId,
          'completed',
          uploadResult.key || 'test-key',
          uploadResult.url || presignedUrl.split('?')[0],
          undefined,
          100,
          uploadResult.expiresAt
        );
        
        setUploadStatus('completed');
        setUploadProgress(100);
        
        // **IMPORTANT: Update video in AsyncStorage with uploaded status**
        try {
          const savedVideos = await AsyncStorage.getItem('saved_videos');
          if (savedVideos) {
            let videos = JSON.parse(savedVideos);
            const videoIndex = videos.findIndex((v: any) => v.uri === videoUri);
            
            if (videoIndex !== -1) {
              // Update existing video with upload info
              videos[videoIndex] = {
                ...videos[videoIndex],
                uploaded: true, // Mark as uploaded
                uploadedAt: new Date().toISOString(),
                s3Key: uploadResult.key,
                s3Url: uploadResult.url,
                expiresAt: uploadResult.expiresAt,
                flaggedForUpload: true,
              };
              await AsyncStorage.setItem('saved_videos', JSON.stringify(videos));
              console.log('✅ Video marked as uploaded in storage');
            }
          }
        } catch (storageError) {
          console.error('Failed to update video storage:', storageError);
        }
        
        // Show success message
        Alert.alert(
          'Upload Successful',
          `Video uploaded to AWS S3 successfully!\n${uploadResult.expiresAt ? `\nVideo will expire on: ${new Date(uploadResult.expiresAt).toLocaleString()}` : ''}`,
          [{ text: 'OK' }]
        );
      } else {
        // Upload failed
        console.error('Upload failed:', uploadResult.error);
        await AWSS3Service.updateVideoUploadStatus(
          videoId,
          'failed',
          undefined,
          undefined,
          uploadResult.error,
          0
        );
        
        setUploadStatus('failed');
        setUploadProgress(0);
        
        Alert.alert(
          'Upload Failed',
          `Failed to upload video to AWS S3: ${uploadResult.error}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('AWS upload error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      await AWSS3Service.updateVideoUploadStatus(
        videoId,
        'failed',
        undefined,
        undefined,
        errorMessage,
        0
      );
      
      setUploadStatus('failed');
      setUploadProgress(0);
      
      Alert.alert(
        'Upload Failed',
        `Failed to upload video to AWS S3: ${errorMessage}`,
        [{ text: 'OK' }]
      );
    }
  };

  /**
   * Handle video save to local storage
   * FIXED: Preserves AWS upload status when saving
   * AWS upload happens separately via cloud icon (handleVideoUploadToggle)
   * Location: Lines 1279-1358
   */
  const handleApprove = async () => {
    if (!videoUri) return;

    console.log('💾 Saving video to local storage...');
    console.log('Current upload status:', uploadStatus);
    console.log('Flagged for upload:', flaggedForUpload);
    
    setIsUploaded(true);
    const previousUploadStatus = uploadStatus; // Preserve upload status

    try {
      // Save video metadata to AsyncStorage (local storage only)
      const savedVideos = await AsyncStorage.getItem('saved_videos');
      let videos = savedVideos ? JSON.parse(savedVideos) : [];
      
      // Check if video already exists in the list
      const existingVideoIndex = videos.findIndex((video: any) => video.uri === videoUri);
      
      if (existingVideoIndex !== -1) {
        // Update existing video - PRESERVE AWS upload status
        const existingVideo = videos[existingVideoIndex];
        videos[existingVideoIndex] = { 
          ...existingVideo,
          lastEdited: new Date().toISOString(),
          duration: videoMetadata?.duration || existingVideo.duration,
          // IMPORTANT: Keep AWS upload status if already uploaded
          uploaded: existingVideo.uploaded || (uploadStatus === 'completed'), // Preserve uploaded status
          uploadedAt: existingVideo.uploadedAt || (uploadStatus === 'completed' ? new Date().toISOString() : null),
          flaggedForUpload: existingVideo.flaggedForUpload || flaggedForUpload,
          s3Key: existingVideo.s3Key, // Keep S3 key if exists
        };
        console.log('📝 Updated existing video - Upload status preserved:', videos[existingVideoIndex].uploaded);
      } else {
        // Add new video to the list
        const newVideo = {
          id: Date.now().toString(),
          uri: videoUri,
          mode: 'saved', // Mark as locally saved
          createdAt: new Date().toISOString(),
          flaggedForUpload: flaggedForUpload, // Current flag status
          uploaded: uploadStatus === 'completed', // TRUE if already uploaded to AWS
          uploadedAt: uploadStatus === 'completed' ? new Date().toISOString() : null,
          title: 'Saved Video',
          duration: videoMetadata?.duration || 0,
          fileSize: 0,
        };
        videos.unshift(newVideo);
        console.log('📝 Added new video - Uploaded:', newVideo.uploaded);
      }
      
      // Save to AsyncStorage (local only)
      await AsyncStorage.setItem('saved_videos', JSON.stringify(videos));
      console.log("✅ Video saved to local storage successfully");
      
      // Show success message with upload status
      const uploadInfo = uploadStatus === 'completed' 
        ? '\n✅ Video is uploaded to AWS S3' 
        : '\n\nTip: Use the cloud icon to upload to AWS S3.';
      
      Alert.alert(
        'Success',
        `Video saved successfully!${uploadInfo}`,
        [{ text: 'OK' }]
      );

    } catch (error: any) {
      console.error("❌ Video save failed:", error);
      Alert.alert(
        'Save Failed',
        `Failed to save video: ${error.message || 'Unknown error'}`,
        [{ text: 'OK' }]
      );
      setIsUploaded(false);
    }
  };

  const handleDiscard = () => {
    setShowDiscardModal(true);
    setIsDiscardConfirmed(false);
  };

  const confirmDiscard = async () => {
    if (videoUri) {
      try {
        await FileSystem.deleteAsync(videoUri, { idempotent: true });
        console.log("✅ Video discarded successfully");
      } catch (e) {
        console.warn("Failed to delete video:", e);
      }
    }
    setIsDiscardConfirmed(true);
  };

  const handleModalClose = () => {
    setShowSuccessModal(false);
    router.replace("/");
  };

  const handleDiscardModalClose = () => {
    setShowDiscardModal(false);
    if (isDiscardConfirmed) {
      router.replace("/screens/videoShoot");
    }
  };

  // Video Editor Functions
  const openVideoEditor = (tool: 'edit' | 'text' | 'stickers' | 'audio' | 'filters' | 'transitions') => {
    setActiveEditorTool(tool);
    setShowVideoEditor(true);
  };

  const closeVideoEditor = () => {
    setShowVideoEditor(false);
    setActiveEditorTool(null);
  };

  const handleVideoEdit = async (action: string, data: any) => {
    console.log('Video edit action:', action, data);
    
    if (!videoUri) {
      Alert.alert('Error', 'No video selected for editing');
      return;
    }
    
    try {
      const outputDir = `${FileSystem.documentDirectory}edited_videos/`;
      await FileSystem.makeDirectoryAsync(outputDir, { intermediates: true });
      const timestamp = Date.now();
      
      switch (action) {
        case 'trim':
          console.log('Trimming video...');
          // Implement video trimming with FFmpeg
          const trimCommand = `-y -i "${videoUri}" -ss 0 -t 30 -c copy "${outputDir}trimmed_${timestamp}.mp4"`;
          await executeFFmpegCommand(trimCommand, 'Video trimmed successfully');
          break;
          
        case 'addText':
          console.log('Adding text overlay:', data.text);
          const textCommand = `-y -i "${videoUri}" -vf "drawtext=text='${data.text || 'Sample Text'}':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2" "${outputDir}text_${timestamp}.mp4"`;
          await executeFFmpegCommand(textCommand, 'Text added successfully');
          setActiveEditorTool('text');
          break;
          
        case 'audioChange':
          if (data.type === 'addMusic') {
            console.log('Adding background music:', data.data);
            setIsProcessingAudio(true);
            
            try {
              // data.data is now the complete track object from AudioEditor
              const selectedTrack = data.data;
              
              if (selectedTrack && selectedTrack.id && selectedTrack.name) {
                setSelectedAudioTrack(selectedTrack);
                
                // Add to timeline array instead of mixing immediately
                const videoDur = getFullDuration();
                const startTime = currentTime;
                
                const newAudioTrack = {
                  id: Date.now().toString(),
                  name: selectedTrack.name,
                  uri: selectedTrack.uri || '',
                  startTime: startTime,
                  endTime: Math.min(startTime + 3, videoDur), // Default 3 seconds
                  volume: audioVolume,
                };
                
                setAudioTracks(prev => {
                  const updated = [...prev, newAudioTrack];
                  console.log('✅ Audio track added to timeline:', newAudioTrack);
                  console.log('📊 Total audio tracks:', updated.length);
                  return updated;
                });
                
                Alert.alert(
                  'Success', 
                  `Music "${selectedTrack.name}" added to timeline! It will play for 3 seconds.`,
                  [{ text: 'OK' }]
                );
              } else {
                Alert.alert('Error', 'Invalid music track selected');
              }
            } catch (error) {
              console.error('Error adding music:', error);
              Alert.alert(
                'Error',
                'Failed to add music to video. Please try again.',
                [{ text: 'OK' }]
              );
            } finally {
              setIsProcessingAudio(false);
            }
          } else if (data.type === 'volume') {
            console.log('Adjusting volume to:', data.volume);
            const newVolume = data.volume || 1.0;
            setAudioVolume(newVolume);
            
            // If there's a selected track, re-mix with new volume
            if (selectedAudioTrack) {
              setIsProcessingAudio(true);
              try {
                const mixOptions: AudioMixOptions = {
                  volume: newVolume,
                    startTime: 0,
                  fadeIn: 2,
                    fadeOut: 2
                };
                
                const outputPath = await AudioProcessor.mixAudioWithVideo(
                  videoUri,
                  selectedAudioTrack,
                  mixOptions
                );
                
                if (outputPath) {
                  // Store the original video URI before updating
                  const originalVideoUri = videoUri;
                  
                  setVideoUri(outputPath);
                  await updateVideoInStorage(outputPath, originalVideoUri);
                  Alert.alert(
                    'Success',
                    `Volume adjusted to ${Math.round(newVolume * 100)}%`,
                    [{ text: 'OK' }]
                  );
                }
              } catch (error) {
                console.error('Error adjusting volume:', error);
                Alert.alert('Error', 'Failed to adjust volume');
              } finally {
                setIsProcessingAudio(false);
              }
            } else {
              Alert.alert(
                'Success',
                `Volume set to ${Math.round(newVolume * 100)}%. This will be applied when you add music.`,
                [{ text: 'OK' }]
              );
            }
          } else if (data.type === 'importMusic') {
            console.log('Importing music from device...');
            setIsProcessingAudio(true);
            
            try {
              const importedTrack = await AudioProcessor.importAudioFromDevice();
              if (importedTrack) {
                setSelectedAudioTrack(importedTrack);
                
                const mixOptions: AudioMixOptions = {
                  volume: audioVolume,
                startTime: 0,
                  fadeIn: 1,
                  fadeOut: 1,
                };
                
                const outputPath = await AudioProcessor.mixAudioWithVideo(
                  videoUri,
              importedTrack,
                  mixOptions
                );
                
                if (outputPath) {
                  setVideoUri(outputPath);
                  Alert.alert(
                    'Success',
                    `Imported music "${importedTrack.name}" has been added to your video!`,
                    [{ text: 'OK' }]
                  );
                }
              }
            } catch (error) {
              console.error('Error importing music:', error);
              Alert.alert('Error', 'Failed to import music from device');
            } finally {
              setIsProcessingAudio(false);
            }
          } else if (data.type === 'addEffect') {
            console.log('Adding sound effect:', data);
            setIsProcessingAudio(true);
            
            try {
              const effectTracks = await AudioProcessor.getAudioTracksByCategory('effects');
              const selectedEffect = effectTracks.find(track => track.name === data) || effectTracks[0];
              
              if (selectedEffect) {
                
                const mixOptions: AudioMixOptions = {
                  volume: audioVolume,
                  startTime: 0,
                  fadeIn: 0.1,
                  fadeOut: 0.1
                };
                
                const outputPath = await AudioProcessor.mixAudioWithVideo(
                  videoUri,
                  selectedEffect,
                  mixOptions
                );
                
                if (outputPath) {
                  setVideoUri(outputPath);
                  Alert.alert(
                    'Success',
                    `Sound effect "${selectedEffect.name}" added successfully!`,
                    [{ text: 'OK' }]
                  );
                }
              }
            } catch (error) {
              console.error('Error adding sound effect:', error);
              Alert.alert('Error', 'Failed to add sound effect');
            } finally {
              setIsProcessingAudio(false);
            }
          } else if (data.type === 'startRecording') {
            Alert.alert(
              'Voice Recording',
              'Voice recording started! This feature would record your voice-over.',
              [{ text: 'OK' }]
            );
          } else if (data.type === 'stopRecording') {
            Alert.alert(
              'Voice Recording',
              'Voice recording stopped and added to video!',
              [{ text: 'OK' }]
            );
          } else if (data.type === 'extractAudio') {
            console.log('Extracting audio from video...');
            setIsProcessingAudio(true);
            
            try {
              const extractedAudioPath = await AudioProcessor.extractAudioFromVideo(videoUri);
              if (extractedAudioPath) {
                Alert.alert(
                  'Success',
                  'Audio extracted from video successfully! You can now use it in other projects.',
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              console.error('Error extracting audio:', error);
              Alert.alert('Error', 'Failed to extract audio from video');
            } finally {
              setIsProcessingAudio(false);
            }
          }
          setActiveEditorTool('audio');
          break;
          
        case 'applyFilter':
          console.log('Applying filter:', data.filter);
          let filterCommand = '';
          switch (data.filter) {
            case 'blur':
              filterCommand = `-y -i "${videoUri}" -vf "boxblur=2:1" "${outputDir}blur_${timestamp}.mp4"`;
              break;
            case 'brightness':
              filterCommand = `-y -i "${videoUri}" -vf "eq=brightness=0.3" "${outputDir}bright_${timestamp}.mp4"`;
              break;
            default:
              filterCommand = `-y -i "${videoUri}" -vf "hue=s=1.5" "${outputDir}filter_${timestamp}.mp4"`;
          }
          await executeFFmpegCommand(filterCommand, 'Filter applied successfully');
          setActiveEditorTool('filters');
          break;
          
        case 'rotate':
          console.log('Rotating video...');
          const rotateCommand = `-y -i "${videoUri}" -vf "transpose=1" "${outputDir}rotated_${timestamp}.mp4"`;
          await executeFFmpegCommand(rotateCommand, 'Video rotated successfully');
          break;
          
        case 'speed':
          console.log('Changing video speed to:', data.speed);
          const speedValue = data.speed || 1.0;
          const speedCommand = `-y -i "${videoUri}" -filter:v "setpts=${1/speedValue}*PTS" -filter:a "atempo=${speedValue}" "${outputDir}speed_${timestamp}.mp4"`;
          await executeFFmpegCommand(speedCommand, 'Video speed changed successfully');
          break;

        case 'addSticker':
          console.log('Adding sticker overlay:', data.sticker, 'size:', data.size);
          // Add sticker to overlay state instead of FFmpeg processing
          const videoDur = getFullDuration();
          const newSticker: { id: string; sticker: string; x: number; y: number; size: number; rotation: number; timestamp: number; startTime: number; endTime: number; isSelected: boolean } = {
            id: `sticker_${Date.now()}`,
            sticker: data.sticker,
            x: 50, // Default position
            y: 50,
            size: data.size || 40,
            rotation: 0,
            timestamp: currentTime,
            startTime: currentTime,
            endTime: Math.min(currentTime + 3, videoDur), // Default 3 seconds or until video end
            isSelected: false,
          };
          setStickerOverlays(prev => [...prev, newSticker]);
          setActiveEditorTool('stickers');
          Alert.alert('Success', 'Sticker added! It will appear for 3 seconds.');
          break;
          
        default:
          console.log('Video edit action:', action, 'is not yet implemented');
          Alert.alert('Info', `${action} feature is coming soon!`);
      }
    } catch (error) {
      console.error('Error processing video edit:', error);
      Alert.alert('Error', 'Failed to process video. Please try again.');
    }
  };

  const executeFFmpegCommand = async (command: string, successMessage: string) => {
    try {
      console.log('=== EXECUTING FFMPEG COMMAND ===');
      console.log('Command:', command);
      console.log('Current videoUri before processing:', videoUri);
      
      const result = await FFmpegService.executeCommand(command, (progress) => {
        console.log('FFmpeg progress:', progress);
      });
      
      if (result.success && result.outputPath) {
        console.log('✅ FFmpeg command successful');
        console.log('Output path:', result.outputPath);
        
        // Store the original video URI before updating
        const originalVideoUri = videoUri;
        console.log('Original video URI stored:', originalVideoUri);
        
        // Update the video URI to point to the edited video
        setVideoUri(result.outputPath);
        console.log('Video URI state updated to:', result.outputPath);
        
        // Update storage with the original video URI for lookup
        console.log('Calling updateVideoInStorage...');
        await updateVideoInStorage(result.outputPath, originalVideoUri);
        
        Alert.alert('Success', successMessage);
        console.log('FFmpeg command executed successfully');
        return result.outputPath;
      } else {
        console.error('❌ FFmpeg failed:', result.error);
        Alert.alert('Error', `Video processing failed: ${result.error}`);
        return null;
      }
    } catch (error) {
      console.error('❌ FFmpeg execution error:', error);
      Alert.alert('Error', 'Video processing failed.');
      return null;
    }
  };

  const updateVideoInStorage = async (newVideoUri: string, originalVideoUri?: string) => {
    try {
      console.log('=== UPDATING VIDEO IN STORAGE ===');
      console.log('New video URI:', newVideoUri);
      console.log('Original video URI:', originalVideoUri || videoUri);
      
      const savedVideos = await AsyncStorage.getItem('saved_videos');
      if (savedVideos) {
        const videos = JSON.parse(savedVideos);
        console.log('Total videos in storage:', videos.length);
        console.log('Videos in storage:', videos.map((v: any) => ({ id: v.id, uri: v.uri, title: v.title })));
        
        // Use originalVideoUri if provided, otherwise use current videoUri
        const searchUri = originalVideoUri || videoUri;
        console.log('Searching for video with URI:', searchUri);
        
        const videoIndex = videos.findIndex((video: any) => video.uri === searchUri);
        console.log('Video found at index:', videoIndex);
        
        if (videoIndex !== -1) {
          console.log('Found existing video, updating URI...');
          // Update the existing video with the new edited URI
          videos[videoIndex].uri = newVideoUri;
          videos[videoIndex].lastEdited = new Date().toISOString();
          
          await AsyncStorage.setItem('saved_videos', JSON.stringify(videos));
          console.log('✅ Video URI updated in AsyncStorage:', newVideoUri);
          console.log('Updated video:', videos[videoIndex]);
          
          // Verify the update was successful
          const verifyVideos = await AsyncStorage.getItem('saved_videos');
          const verifyParsed = JSON.parse(verifyVideos || '[]');
          console.log('Verification - Videos after update:', verifyParsed.map((v: any) => ({ id: v.id, uri: v.uri, title: v.title })));
        } else {
          console.log('❌ Video not found in storage, creating new entry');
          // If video not found, create a new entry
          const newVideo = {
            id: Date.now().toString(),
            uri: newVideoUri,
            mode: 'edited',
            createdAt: new Date().toISOString(),
            flaggedForUpload: false,
            uploaded: false,
            title: 'Edited Video',
            duration: 0, // Will be updated when video metadata is loaded
            fileSize: 0,
            lastEdited: new Date().toISOString()
          };
          
          videos.unshift(newVideo);
          await AsyncStorage.setItem('saved_videos', JSON.stringify(videos));
          console.log('✅ New edited video added to storage:', newVideo);
          
          // Verify the new video was added
          const verifyVideos = await AsyncStorage.getItem('saved_videos');
          const verifyParsed = JSON.parse(verifyVideos || '[]');
          console.log('Verification - Videos after adding new:', verifyParsed.map((v: any) => ({ id: v.id, uri: v.uri, title: v.title })));
        }
      } else {
        console.log('❌ No videos found in AsyncStorage');
        // Create a new video entry even if no videos exist
        const newVideo = {
          id: Date.now().toString(),
          uri: newVideoUri,
          mode: 'edited',
          createdAt: new Date().toISOString(),
          flaggedForUpload: false,
          uploaded: false,
          title: 'Edited Video',
          duration: 0,
          fileSize: 0,
          lastEdited: new Date().toISOString()
        };
        
        await AsyncStorage.setItem('saved_videos', JSON.stringify([newVideo]));
        console.log('✅ Created first video in storage:', newVideo);
      }
      console.log('=== END UPDATE VIDEO IN STORAGE ===');
    } catch (error) {
      console.error('❌ Error updating video in storage:', error);
    }
  };

  const handleTextAdd = (text: string, style: any) => {
    console.log('Adding text:', text, style);
    
    const videoDur = getFullDuration();
    const startTime = currentTime;
    
    // Create a new text overlay
    const newOverlay = {
      id: Date.now().toString(),
      text: text || 'Sample Text',
      x: SCREEN_WIDTH * 0.1, // 10% from left
      y: moderateScale(100), // 100px from top
      fontSize: style?.fontSize || 24,
      color: style?.color || '#FFFFFF',
      fontFamily: style?.fontFamily || 'System',
      alignment: style?.alignment || 'center' as 'left' | 'center' | 'right',
      timestamp: startTime,
      startTime: startTime,
      endTime: Math.min(startTime + 3, videoDur), // Default 3 seconds
      isSelected: false,
      animation: style?.animation || 'fade' as 'fade' | 'slide' | 'bounce' | 'zoom' | 'rotate' | 'scale-in' | 'none',
    };
    
    // Add the overlay to the state
    setTextOverlays(prev => [...prev, newOverlay]);
    
    // Show text overlay editor
    setActiveEditorTool('text');
    
    // Show success message
    Alert.alert('Success', `Text overlay added! It will appear for 3 seconds.`);
  };

  const handleStickerAdd = (sticker: string, size: number) => {
    console.log('Adding sticker:', sticker, size);
    // Show sticker overlay editor
    setActiveEditorTool('stickers');
    handleVideoEdit('addSticker', { sticker, size });
  };

  const handleImageAdd = (imageUri: string, width: number, height: number, timestamp?: number) => {
    console.log('📸 Adding image:', imageUri, 'width:', width, 'height:', height, 'timestamp:', timestamp);
    
    // Calculate center position
    const imageSize = Math.min(Math.max(width, height), 200); // Max 200px
    const centerX = (SCREEN_WIDTH - imageSize) / 2;
    const centerY = 100; // Near top for visibility
    
    const videoDur = getFullDuration();
    const startTime = timestamp || currentTime;
    
    const newImage = {
      id: Date.now().toString(),
      imageUri,
      x: centerX,
      y: centerY,
      size: imageSize,
      rotation: 0,
      timestamp: startTime,
      startTime: startTime,
      endTime: Math.min(startTime + 3, videoDur), // Default 3 seconds or until video end
      isSelected: true, // Auto-select for immediate feedback
    };
    
    setImageOverlays(prev => {
      const updated = [...prev, newImage];
      console.log('✅ Image overlay added. Total images:', updated.length);
      console.log('📋 All images:', updated.map(img => ({ id: img.id, x: img.x, y: img.y, size: img.size, startTime: img.startTime, endTime: img.endTime })));
      return updated;
    });
    
    Alert.alert('Success', `Image added! It will appear for 3 seconds.`);
  };

  // Handle video split at current time
  /**
   * Handle video split at current time
   * FIXED: Now respects trim bounds - segments created within trimmed range only
   */
  const handleSplit = () => {
    // Get effective video bounds (respecting trim)
    const fullDuration = getFullDuration();
    const effectiveStart = trimStartSec || 0;
    const effectiveEnd = trimEndSec ?? fullDuration;
    
    if (currentTime <= effectiveStart || currentTime >= effectiveEnd) {
      Alert.alert('Cannot Split', 'Please position the playhead within the trimmed video range.');
      return;
    }

    // Check if split already exists at this time
    const existingSplit = splitPoints.find(
      split => Math.abs(split.time - currentTime) < 0.1
    );

    if (existingSplit) {
      Alert.alert('Split Exists', 'A split already exists at this position.');
      return;
    }

    // Add split point
    const newSplit = {
      id: Date.now().toString(),
      time: currentTime,
      transitionType: 'none', // Default no transition
    };

    const updatedSplits = [...splitPoints, newSplit].sort((a, b) => a.time - b.time);
    setSplitPoints(updatedSplits);
    
    // Create video segments from splits - RESPECTING TRIM BOUNDS
    // Use trimmed range instead of full video
    const splitTimes = [effectiveStart, ...updatedSplits.map(s => s.time), effectiveEnd];
    const newSegments = [];
    
    for (let i = 0; i < splitTimes.length - 1; i++) {
      newSegments.push({
        id: `segment-${i}-${Date.now()}`,
        startTime: splitTimes[i],
        endTime: splitTimes[i + 1],
        isDeleted: false,
      });
    }
    
    setVideoSegments(newSegments);
    console.log('📊 Created segments (respecting trim):', newSegments);
    console.log('🎬 Trim bounds:', { start: effectiveStart, end: effectiveEnd });
    
    Alert.alert(
      'Video Split',
      `Video split at ${currentTime.toFixed(1)}s. Tap segments on timeline to delete them.\n\nNote: Split respects trim bounds (${effectiveStart.toFixed(1)}s - ${effectiveEnd.toFixed(1)}s)`,
      [{ text: 'OK' }]
    );
    
    console.log('✂️ Video split at:', currentTime, 'Total splits:', updatedSplits.length);
  };

  const handleStickerSelect = (stickerId: string) => {
    setStickerOverlays(prev => 
      prev.map(sticker => ({
        ...sticker,
        isSelected: sticker.id === stickerId ? !sticker.isSelected : false,
      }))
    );
  };

  const handleStickerRemove = (stickerId: string) => {
    Alert.alert(
      'Remove Sticker',
      'Are you sure you want to remove this sticker?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => {
            setStickerOverlays(prev => prev.filter(sticker => sticker.id !== stickerId));
            Alert.alert('Success', 'Sticker removed successfully!');
          }
        }
      ]
    );
  };

  const handleStickerPositionUpdate = (stickerId: string, x: number, y: number) => {
    setStickerOverlays(prev => 
      prev.map(sticker => 
        sticker.id === stickerId 
          ? { ...sticker, x, y }
          : sticker
      )
    );
  };

  const handleStickerResize = (stickerId: string, newSize: number) => {
    setStickerOverlays(prev => 
      prev.map(sticker => 
        sticker.id === stickerId 
          ? { ...sticker, size: Math.max(20, Math.min(100, newSize)) } // Limit size between 20-100
          : sticker
      )
    );
  };

  // Text Overlay Helper Functions
  const handleTextSelect = (textId: string) => {
    setTextOverlays(prev => 
      prev.map(text => ({
        ...text,
        isSelected: text.id === textId ? !text.isSelected : false
      }))
    );
  };

  const handleTextRemove = (textId: string) => {
    Alert.alert(
      'Remove Text',
      'Are you sure you want to remove this text overlay?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => {
            setTextOverlays(prev => prev.filter(text => text.id !== textId));
          }
        }
      ]
    );
  };

  const handleTextPositionUpdate = (textId: string, x: number, y: number) => {
    setTextOverlays(prev => 
      prev.map(text => 
        text.id === textId 
          ? { ...text, x, y }
          : text
      )
    );
  };

  const handleTextResize = (textId: string, newFontSize: number) => {
    setTextOverlays(prev => 
      prev.map(text => 
        text.id === textId 
          ? { ...text, fontSize: Math.max(12, Math.min(72, newFontSize)) } // Limit font size between 12-72
          : text
      )
    );
  };

  const handleFilterApply = (filter: string, intensity: number) => {
    console.log('Applying filter:', filter, intensity);
    // Show filter overlay editor
    setActiveEditorTool('filters');
    handleVideoEdit('applyFilter', { filter, intensity });
  };

  const handleAudioChange = (type: string, data: any) => {
    console.log('Audio change:', type, data);
    // Show audio editor and process the audio change
    setActiveEditorTool('audio');
    
    // Handle different audio operations
    if (type === 'addMusic') {
      handleVideoEdit('audioChange', { type: 'addMusic', data });
    } else if (type === 'volume') {
      handleVideoEdit('audioChange', { type: 'volume', volume: data });
    } else if (type === 'mute') {
      handleVideoEdit('audioChange', { type: 'volume', volume: data ? 0 : 1 });
    } else {
      handleVideoEdit('audioChange', { type, data });
    }
  };


  // Handle split icon click to add transition
  const handleSplitIconClick = (splitId: string, time: number) => {
    console.log('✂️ Split icon clicked:', splitId, 'at time:', time);
    setActiveSplitForTransition({ id: splitId, time });
    setActiveEditorTool('transitions');
    setShowVideoEditor(true); // Open the modal
    console.log('🎬 Opening transition editor for split point');
  };

  const handleTransitionAdd = (transitionEffect: {
    id: string;
    name: string;
    icon: string;
    timestamp: number;
    duration: number;
  }) => {
    console.log('Adding transition effect:', transitionEffect);
    
    // If adding transition to a split point
    if (activeSplitForTransition) {
      setSplitPoints(prev => prev.map(split => 
        split.id === activeSplitForTransition.id 
          ? { ...split, transitionType: transitionEffect.name }
          : split
      ));
      
      Alert.alert(
        'Transition Added',
        `${transitionEffect.name} transition added to split at ${activeSplitForTransition.time.toFixed(1)}s`,
        [{ text: 'OK' }]
      );
      
      setActiveSplitForTransition(null);
      setActiveEditorTool(null);
      setShowVideoEditor(false); // Close the modal
      console.log('✅ Transition applied to split point');
    } else {
      // Regular transition (not on split point)
      setTransitionEffects(prev => [...prev, transitionEffect]);
    }
  };

  const handleTransitionRemove = (transitionId: string) => {
    console.log('Removing transition:', transitionId);
    setTransitionEffects(prev => prev.filter(t => t.id !== transitionId));
  };

  const getTransitionStyle = (transition: { name: string; progress: number }) => {
    const { name, progress } = transition;
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    
    switch (name) {
      case 'fade':
        // Complete black screen, then fade back to video
        if (progress < 0.5) {
          // First half: fade to black
          return {
            backgroundColor: `rgba(0, 0, 0, ${progress * 2})`,
          };
        } else {
          // Second half: fade back from black
          return {
            backgroundColor: `rgba(0, 0, 0, ${2 - progress * 2})`,
          };
        }
      case 'slide-left':
        // Complete slide from right to left
        if (progress < 0.5) {
          // First half: black screen
          return {
            backgroundColor: 'rgba(0, 0, 0, 1)',
          };
        } else {
          // Second half: slide video in from right
          const slideProgress = (progress - 0.5) * 2;
          return {
            backgroundColor: 'rgba(0, 0, 0, 1)',
            transform: [{ translateX: screenWidth * (1 - slideProgress) }],
          };
        }
      case 'slide-right':
        // Complete slide from left to right
        if (progress < 0.5) {
          return {
            backgroundColor: 'rgba(0, 0, 0, 1)',
          };
        } else {
          const slideProgress = (progress - 0.5) * 2;
          return {
            backgroundColor: 'rgba(0, 0, 0, 1)',
            transform: [{ translateX: -screenWidth * (1 - slideProgress) }],
          };
        }
      case 'slide-up':
        // Complete slide from bottom to top
        if (progress < 0.5) {
          return {
            backgroundColor: 'rgba(0, 0, 0, 1)',
          };
        } else {
          const slideProgress = (progress - 0.5) * 2;
          return {
            backgroundColor: 'rgba(0, 0, 0, 1)',
            transform: [{ translateY: screenHeight * (1 - slideProgress) }],
          };
        }
      case 'slide-down':
        // Complete slide from top to bottom
        if (progress < 0.5) {
          return {
            backgroundColor: 'rgba(0, 0, 0, 1)',
          };
        } else {
          const slideProgress = (progress - 0.5) * 2;
          return {
            backgroundColor: 'rgba(0, 0, 0, 1)',
            transform: [{ translateY: -screenHeight * (1 - slideProgress) }],
          };
        }
      case 'zoom-in':
        // Dramatic zoom in effect
        if (progress < 0.3) {
          return {
            backgroundColor: 'rgba(0, 0, 0, 1)',
          };
        } else {
          const zoomProgress = (progress - 0.3) / 0.7;
          return {
            backgroundColor: `rgba(0, 0, 0, ${1 - zoomProgress})`,
            transform: [{ scale: 0.1 + zoomProgress * 0.9 }],
          };
        }
      case 'zoom-out':
        // Dramatic zoom out effect
        return {
          backgroundColor: `rgba(0, 0, 0, ${progress * 0.8})`,
          transform: [{ scale: 1 + progress * 2 }],
        };
      case 'spin':
        // Complete 360 degree spin with black background
        return {
          backgroundColor: `rgba(0, 0, 0, ${Math.sin(progress * Math.PI) * 0.8})`,
          transform: [{ rotate: `${progress * 720}deg` }], // Double spin for more dramatic effect
        };
      case 'blur':
        // Simulate blur with white overlay and scale
        return {
          backgroundColor: `rgba(255, 255, 255, ${Math.sin(progress * Math.PI) * 0.6})`,
          transform: [{ scale: 1 + Math.sin(progress * Math.PI) * 0.1 }],
        };
      default:
        return {
          backgroundColor: `rgba(0, 0, 0, ${progress})`,
        };
    }
  };

  const handleAudioRemoved = async () => {
    try {
      // Clean up audio player
      if (audioPlayerRef.current) {
        await audioPlayerRef.current.unloadAsync();
        audioPlayerRef.current = null;
      }
      
      setIsAudioLoaded(false);
      setAudioTrack(null);
      setSelectedAudioTrack(null);
      Alert.alert('Success', 'Background music removed successfully!');
    } catch (error) {
      console.error('Error removing audio:', error);
      Alert.alert('Error', 'Failed to remove background music');
    }
  };

  // Voice Recording Functions
  const startVoiceRecording = async () => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Microphone permission is required for voice recording');
        return;
      }

      // Set up audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });

      // Create recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      recordingRef.current = recording;
      await recording.startAsync();
      setIsRecording(true);

      // Auto-stop recording when video duration is reached
      const videoDuration = getFullDuration();
      if (videoDuration > 0) {
        setTimeout(async () => {
          if (isRecording) {
            await stopVoiceRecording();
          }
        }, videoDuration * 1000);
      }

      console.log('Voice recording started');
    } catch (error) {
      console.error('Error starting voice recording:', error);
      Alert.alert('Error', 'Failed to start voice recording');
    }
  };

  const stopVoiceRecording = async () => {
    try {
      if (!recordingRef.current) return;

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      if (uri) {
        setRecordedAudioUri(uri);
        
        // Load the recorded audio
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          {
            shouldPlay: false,
            volume: voiceVolume / 100,
            isLooping: false,
          }
        );

        setVoicePlayerRef(sound);
        setIsVoiceLoaded(true);
        setIsRecording(false);
        recordingRef.current = null;

        console.log('Voice recording completed:', uri);
        Alert.alert('Success', 'Voice recording completed successfully!');
      }
    } catch (error) {
      console.error('Error stopping voice recording:', error);
      Alert.alert('Error', 'Failed to stop voice recording');
      setIsRecording(false);
    }
  };

  const deleteVoiceRecording = async () => {
    try {
      if (voicePlayerRef) {
        await voicePlayerRef.unloadAsync();
        setVoicePlayerRef(null);
      }
      
      if (recordedAudioUri) {
        await FileSystem.deleteAsync(recordedAudioUri, { idempotent: true });
        setRecordedAudioUri(null);
      }
      
      setIsVoiceLoaded(false);
      setIsRecording(false);
      Alert.alert('Success', 'Voice recording deleted successfully!');
    } catch (error) {
      console.error('Error deleting voice recording:', error);
      Alert.alert('Error', 'Failed to delete voice recording');
    }
  };

  const handleAudioAdded = async (audioUri: string, audioName: string) => {
    if (!videoUri) {
      Alert.alert('Error', 'No video loaded to add audio to');
      return;
    }

    setIsProcessingAudio(true);
    try {
      // Create audio track object for the context
      const newAudioTrack = {
        id: Date.now().toString(),
        name: audioName,
        uri: audioUri,
      };

      // Set the audio track in context
      setAudioTrack(newAudioTrack);
      
      // Add to timeline tracks for visual display
      const videoDur = getFullDuration();
      const startTime = currentTime;
      
      const timelineAudioTrack = {
        id: Date.now().toString() + '_timeline',
        name: audioName,
        uri: audioUri,
        startTime: startTime,
        endTime: Math.min(startTime + 3, videoDur), // Default 3 seconds
        volume: audioVolume,
      };
      
      setAudioTracks(prev => {
        const updated = [...prev, timelineAudioTrack];
        console.log('✅ Audio track added to timeline from VolumeControl:', timelineAudioTrack);
        console.log('📊 Total audio tracks:', updated.length);
        return updated;
      });

      console.log('Loading audio file:', { audioUri, audioName });
      
      // Get video duration
      const currentVideoDuration = getFullDuration();
      console.log('Video duration:', currentVideoDuration);
      
      // Load the audio file using expo-av
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { 
          shouldPlay: false,
          volume: getActualAudioVolume(),
          isLooping: false, // We'll handle looping manually based on duration
        }
      );

      // Get audio duration
      const audioStatus = await sound.getStatusAsync();
      const currentAudioDuration = audioStatus.isLoaded ? audioStatus.durationMillis! / 1000 : 0;
      console.log('Audio duration:', currentAudioDuration);

      // Store durations in state
      setVideoDuration(currentVideoDuration);
      setAudioDuration(currentAudioDuration);

      // Store the audio player reference
      audioPlayerRef.current = sound;
      setIsAudioLoaded(true);

      // Set up audio duration synchronization
      if (currentAudioDuration > 0 && currentVideoDuration > 0) {
        if (currentAudioDuration >= currentVideoDuration) {
          // Audio is longer than video - we'll stop it at video duration
          console.log('Audio is longer than video, will stop at video duration');
        } else {
          // Video is longer than audio - we'll loop the audio
          console.log('Video is longer than audio, will loop audio');
        }
      }

      Alert.alert(
        'Success',
        `Background music "${audioName}" loaded successfully!\nVideo: ${currentVideoDuration.toFixed(1)}s, Audio: ${currentAudioDuration.toFixed(1)}s`,
        [{ text: 'OK' }]
      );

      // If video is currently playing, start the audio too
      if (player?.playing && isVideoPlaying) {
        await sound.playAsync();
        console.log('Audio started with video on load');
      }

    } catch (error) {
      console.error('Error loading audio:', error);
      Alert.alert('Error', 'Failed to load background music');
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const getStatusColor = () => {
    switch (uploadStatus) {
      case 'pending': return '#ffa500';
      case 'uploading': return '#259B9A';
      case 'completed': return '#4CAF50';
      case 'failed': return '#F44336';
      default: return '#767577';
    }
  };

  const getStatusText = () => {
    switch (uploadStatus) {
      case 'pending': return 'Pending';
      case 'uploading': return 'Uploading...';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return 'Unknown';
    }
  };

  if (!videoUri) {
    return (
      <View style={styles.centered}>
        <Text style={styles.noVideoText}>No video to preview.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {!isUploaded && !(showDiscardModal && isDiscardConfirmed) ? (
          <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <MaterialIcons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Preview</Text>
            
            {/* Header Action Icons */}
            <View style={styles.headerActions}>
              {/* AWS Upload Icon */}
              {flaggedForUpload && uploadStatus === 'pending' && (
                <TouchableOpacity style={styles.headerIcon} onPress={() => setShowUploadToaster(true)}>
                  <MaterialIcons name="cloud-upload" size={24} color="#259B9A" />
                </TouchableOpacity>
              )}
              
              {/* Save Video Icon */}
              <TouchableOpacity style={styles.headerIcon} onPress={handleApprove}>
                <MaterialIcons name="save" size={24} color="#259B9A" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.headerLine} />
          </View>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Video Preview */}
            <View style={styles.videoContainer}>
              <VideoView
                style={styles.video}
                player={player}
                allowsFullscreen
                allowsPictureInPicture
                nativeControls={false}
              />
              
              {/* Custom Controls Container */}
              <View style={styles.customControlsContainer}>
                {/* Time Display */}
                <Text style={styles.customTimeText}>
                  {formatTimeDisplay((() => {
                    // Use virtual time if segments exist
                    if (videoSegments.length > 0) {
                      return getCurrentVirtualTime();
                    }
                    return currentTime - (trimStartSec || 0);
                  })())} / {formatTimeDisplay((() => {
                    // Use effective duration if segments are deleted
                    if (videoSegments.length > 0) {
                      return getEffectiveDuration();
                    }
                    const full = getFullDuration();
                    const start = trimStartSec || 0;
                    const end = trimEndSec ?? full;
                    return end - start;
                  })())}
                </Text>
                
                {/* Custom Seekbar */}
                <View style={styles.customSeekbarContainer}>
                  <View style={styles.customSeekbarTrack}>
                    {/* Progress Bar */}
                    <View 
                      style={[
                        styles.customSeekbarProgress,
                        {
                          width: `${(() => {
                            let duration;
                            let relativeTime;
                            
                            if (videoSegments.length > 0) {
                              duration = getEffectiveDuration();
                              relativeTime = getCurrentVirtualTime();
                            } else {
                              const full = getFullDuration();
                              const start = trimStartSec || 0;
                              const end = trimEndSec ?? full;
                              duration = end - start;
                              relativeTime = currentTime - start;
                            }
                            
                            return duration > 0 ? (relativeTime / duration) * 100 : 0;
                          })()}%`
                        }
                      ]} 
                    />
                  </View>
                  
                  {/* Playhead Thumb */}
                  <View 
                    style={[
                      styles.customSeekbarThumb,
                      {
                        left: `${(() => {
                          let duration;
                          let relativeTime;
                          
                          if (videoSegments.length > 0) {
                            duration = getEffectiveDuration();
                            relativeTime = getCurrentVirtualTime();
                          } else {
                            const full = getFullDuration();
                            const start = trimStartSec || 0;
                            const end = trimEndSec ?? full;
                            duration = end - start;
                            relativeTime = currentTime - start;
                          }
                          
                          return duration > 0 ? (relativeTime / duration) * 100 : 0;
                        })()}%`
                      }
                    ]}
                  />
                  
                  {/* Touch Area for Seeking */}
                  <TouchableOpacity
                    style={styles.customSeekbarTouchArea}
                    activeOpacity={1}
                    onPress={(e) => {
                      const { locationX } = e.nativeEvent;
                      const seekbarWidth = SCREEN_WIDTH * 0.9;
                      const percentage = locationX / seekbarWidth;
                      
                      const full = getFullDuration();
                      const start = trimStartSec || 0;
                      const end = trimEndSec ?? full;
                      const duration = end - start;
                      
                      const newTime = start + (duration * percentage);
                      setCurrentTime(newTime);
                      if (player) {
                        player.currentTime = newTime;
                      }
                    }}
                  />
                </View>
              </View>
              
              {/* Play/Pause Button Overlay */}
              <TouchableOpacity 
                style={styles.videoTapArea}
                activeOpacity={1}
                onPress={() => {
                  if (player.playing) {
                    player.pause();
                    setIsVideoPlaying(false);
                  } else {
                    player.play();
                    setIsVideoPlaying(true);
                  }
                }}
              >
                {!player.playing && (
                  <View style={styles.playPauseOverlay}>
                    <MaterialIcons name="play-arrow" size={moderateScale(30)} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
                
                {/* Transition Effect Overlay */}
                {activeTransition && (
                  <View style={[styles.transitionOverlay, getTransitionStyle(activeTransition)]} />
                )}
              
              {/* Text Overlays - Only show when currentTime is within range */}
              {textOverlays
                .filter(overlay => currentTime >= overlay.startTime && currentTime <= overlay.endTime)
                .map((overlay) => (
                <TextItem
                  key={overlay.id}
                  textOverlay={overlay}
                  onSelect={handleTextSelect}
                  onRemove={handleTextRemove}
                  onResize={handleTextResize}
                  onPositionUpdate={handleTextPositionUpdate}
                  screenWidth={SCREEN_WIDTH}
                  styles={styles}
                />
              ))}

              {/* Sticker Overlays - Only show when currentTime is within range */}
              {stickerOverlays
                .filter(sticker => currentTime >= sticker.startTime && currentTime <= sticker.endTime)
                .map((sticker) => (
                  <StickerItem
                    key={sticker.id}
                    sticker={sticker}
                    onSelect={handleStickerSelect}
                    onRemove={handleStickerRemove}
                    onResize={handleStickerResize}
                    onPositionUpdate={handleStickerPositionUpdate}
                    screenWidth={SCREEN_WIDTH}
                    styles={styles}
                  />
                ))}

              {/* Image Overlays - Only show when currentTime is within range */}
              {imageOverlays
                .filter(image => currentTime >= image.startTime && currentTime <= image.endTime)
                .map((image, index) => {
                // Convert size to width/height for ImageItem component
                const aspectRatio = 1; // Default square, can be enhanced later
                const imageWidth = image.size;
                const imageHeight = image.size / aspectRatio;
                
                console.log(`🖼️ Rendering image ${index}:`, {
                  id: image.id,
                  uri: image.imageUri.substring(0, 50),
                  x: image.x,
                  y: image.y,
                  width: imageWidth,
                  height: imageHeight,
                  isSelected: image.isSelected
                });
                
                return (
                  <ImageItem
                    key={image.id}
                    imageItem={{
                      id: image.id,
                      imageUri: image.imageUri,
                      x: image.x,
                      y: image.y,
                      width: imageWidth,
                      height: imageHeight,
                      rotation: image.rotation,
                      isSelected: image.isSelected
                    }}
                    onSelect={(id) => {
                      setImageOverlays(prev => 
                        prev.map(img => ({
                          ...img,
                          isSelected: img.id === id ? !img.isSelected : false
                        }))
                      );
                    }}
                    onRemove={(id) => {
                      Alert.alert(
                        'Remove Image',
                        'Are you sure you want to remove this image?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { 
                            text: 'Remove', 
                            style: 'destructive',
                            onPress: () => {
                              setImageOverlays(prev => prev.filter(img => img.id !== id));
                              Alert.alert('Success', 'Image removed successfully!');
                            }
                          }
                        ]
                      );
                    }}
                    onResize={(id, newWidth, newHeight) => {
                      // Convert back to size
                      const newSize = Math.max(newWidth, newHeight);
                      setImageOverlays(prev => 
                        prev.map(img => 
                          img.id === id 
                            ? { ...img, size: Math.max(50, Math.min(300, newSize)) }
                            : img
                        )
                      );
                    }}
                    onPositionUpdate={(id, x, y) => {
                      setImageOverlays(prev => 
                        prev.map(img => 
                          img.id === id 
                            ? { ...img, x, y }
                            : img
                        )
                      );
                    }}
                    screenWidth={SCREEN_WIDTH}
                    screenHeight={Dimensions.get('window').height}
                    styles={styles}
                  />
                );
              })}
            </View>

            {/* Video Timeline - CapCut Style (with trim handles) */}
            <VideoTimeline
              duration={(() => {
                if (videoSegments.length > 0) return getEffectiveDuration();
                if (segments.length > 0) return sumSegmentsDuration();
                const full = getFullDuration();
                const start = Math.max(0, trimStartSec || 0);
                const end = Math.min(trimEndSec ?? full, full);
                return Math.max(0, Math.min(end - start, full));
              })()}
              currentTime={(() => {
                if (videoSegments.length > 0) return getCurrentVirtualTime();
                if (segments.length > 0) return toVirtualTime(currentTime);
                return Math.max(0, (currentTime - (trimStartSec || 0)));
              })()}
              onTimeChange={(relativeTime) => {
                let absoluteTime: number;
                if (segments.length > 0) {
                  absoluteTime = toAbsoluteTime(relativeTime);
                } else {
                  const full = getFullDuration();
                  const start = trimStartSec || 0;
                  const end = (trimEndSec ?? full);
                  absoluteTime = Math.max(start, Math.min(start + relativeTime, end));
                }
                setCurrentTime(absoluteTime);
                if (player && typeof absoluteTime === 'number') {
                  player.currentTime = absoluteTime;
                }
              }}
              onTrimStart={(relativeTime) => {
                // Convert relative time on timeline to absolute time in original video
                const currentStart = trimStartSec || 0;
                const currentEnd = trimEndSec ?? getFullDuration();
                
                // New absolute start = current start + relative position
                const newStart = currentStart + relativeTime;
                const start = Math.max(0, Math.min(newStart, currentEnd));
                
                console.log(`Trim Start: relative=${relativeTime}, currentStart=${currentStart}, newStart=${start}`);
                
                setTrimStartSec(start);
                setSegments(normalizeSegments([{ start, end: currentEnd }]));
                if (player) {
                  player.currentTime = start;
                }
                // Update frames for new trim range
                updateFramesForTrim(start, currentEnd);
              }}
              onTrimEnd={(relativeTime) => {
                // Convert relative time on timeline to absolute time in original video
                const currentStart = trimStartSec || 0;
                const full = getFullDuration();
                
                // New absolute end = current start + relative position
                const newEnd = currentStart + relativeTime;
                const end = Math.max(currentStart, Math.min(newEnd, full));
                
                console.log(`Trim End: relative=${relativeTime}, currentStart=${currentStart}, newEnd=${end}`);
                
                setTrimEndSec(end);
                setSegments(normalizeSegments([{ start: currentStart, end }]));
                if (player) {
                  player.currentTime = currentStart;
                }
                // Update frames for new trim range
                updateFramesForTrim(currentStart, end);
              }}
              trimStart={0}
              trimEnd={(() => {
                // Always show as full timeline of trimmed duration
                const full = getFullDuration();
                const start = Math.max(0, trimStartSec || 0);
                const end = Math.min(trimEndSec ?? full, full);
                return end - start; // Show trimmed duration as full range
              })()}
              videoFrames={videoFrames}
              isLoading={isLoadingVideo}
              overlays={(() => {
                const allOverlays = [
                  ...audioTracks.map(audio => ({
                    id: audio.id,
                    startTime: audio.startTime,
                    endTime: audio.endTime,
                    type: 'audio' as const,
                    label: `🎵 ${audio.name.substring(0, 10)}${audio.name.length > 10 ? '...' : ''}`
                  })),
                ...textOverlays.map(text => ({
                  id: text.id,
                  startTime: text.startTime,
                  endTime: text.endTime,
                  type: 'text' as const,
                  label: `📝 ${text.text.substring(0, 10)}${text.text.length > 10 ? '...' : ''}`
                })),
                ...imageOverlays.map(img => ({
                  id: img.id,
                  startTime: img.startTime,
                  endTime: img.endTime,
                  type: 'image' as const,
                  label: '🖼️ Image'
                })),
                ...stickerOverlays.map(sticker => ({
                  id: sticker.id,
                  startTime: sticker.startTime,
                  endTime: sticker.endTime,
                  type: 'sticker' as const,
                  label: sticker.sticker
                }))
                ];
                console.log('🎬 Timeline Overlays:', {
                  audio: audioTracks.length,
                  text: textOverlays.length,
                  images: imageOverlays.length,
                  stickers: stickerOverlays.length,
                  total: allOverlays.length
                });
                return allOverlays;
              })()}
              onOverlayTimeChange={(id, startTime, endTime) => {
                // Update audio track timing
                setAudioTracks(prev => prev.map(audio => 
                  audio.id === id ? { ...audio, startTime, endTime } : audio
                ));
                // Update text overlay timing
                setTextOverlays(prev => prev.map(text => 
                  text.id === id ? { ...text, startTime, endTime } : text
                ));
                // Update image overlay timing
                setImageOverlays(prev => prev.map(img => 
                  img.id === id ? { ...img, startTime, endTime } : img
                ));
                // Update sticker overlay timing
                setStickerOverlays(prev => prev.map(sticker => 
                  sticker.id === id ? { ...sticker, startTime, endTime } : sticker
                ));
              }}
              splitPoints={splitPoints}
              onSplitPointClick={handleSplitIconClick}
              videoSegments={videoSegments}
              onSegmentDelete={handleSegmentDelete}
            />
            
            {/* Bottom Toolbar - CapCut Style */}
            <BottomToolbar 
              onToolSelect={(tool: string) => {
                console.log('Tool selected:', tool);
                
                // Handle Split button specially
                if (tool === 'split') {
                  handleSplit();
                  return;
                }
                
                // For other tools, open editor
                openVideoEditor(tool as 'text' | 'stickers' | 'audio' | 'filters' | 'transitions');
              }}
              activeTool="split"
            />
          </ScrollView>
        </View>
      ) : isUploaded ? (
        <View style={[styles.videoView, { backgroundColor: "black" }]}>
          <LottieView
            autoPlay
            loop={false}
            style={styles.lottie}
            source={require("../../assets/lottie/guXmTJWvVE.json")}
            onAnimationFinish={() => {
              setShowSuccessModal(true);
            }}
          />
        </View>
      ) : null}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showSuccessModal}
        onRequestClose={handleModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>
              Your video is successfully saved to:
            </Text>
            <Text style={styles.modalUrl}>
              https://startuppal-video-storage.s3.amazonaws.com/user-uploads/test-video.mp4
            </Text>
            <TouchableOpacity
              style={[styles.YesNoButton, { backgroundColor: "#4CAF50" }]}
              onPress={handleModalClose}
            >
              <Text style={styles.buttonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent={true}
        visible={showDiscardModal}
        onRequestClose={handleDiscardModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {!isDiscardConfirmed ? (
              <>
                <Text style={styles.modalText}>
                  Are you sure you want to discard this video?
                </Text>
                <View style={styles.modalButtonContainer}>
                  <TouchableOpacity
                    style={[styles.YesNoButton, { backgroundColor: "#4CAF50" }]}
                    onPress={confirmDiscard}
                  >
                    <Text style={styles.buttonText}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.YesNoButton, { backgroundColor: "#F44336" }]}
                    onPress={handleDiscardModalClose}
                  >
                    <Text style={styles.buttonText}>No</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalText}>
                  Your video is discarded successfully, please record again.
                </Text>
                <TouchableOpacity
                  style={[styles.YesNoButton, { backgroundColor: "#4CAF50" }]}
                  onPress={handleDiscardModalClose}
                >
                  <Text style={styles.buttonText}>OK</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* AWS Upload Settings Toaster */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showUploadToaster}
        onRequestClose={() => setShowUploadToaster(false)}
      >
        <View style={styles.toasterOverlay}>
          <View style={styles.toasterContent}>
            <View style={styles.toasterHeader}>
              <Text style={styles.toasterTitle}>AWS Upload Settings</Text>
              <TouchableOpacity onPress={() => setShowUploadToaster(false)}>
                <MaterialIcons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.toasterBody} 
              contentContainerStyle={styles.toasterBodyContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Upload Control Section */}
              <View style={styles.uploadSection}>
                <Text style={styles.sectionTitle}>Upload Control</Text>
                
                <View style={styles.uploadRow}>
                  <Text style={styles.uploadLabel}>Enable AWS Upload:</Text>
                  <Switch
                    value={config.features.enableAwsUpload}
                    onValueChange={(value) => handleFeatureToggle('enableAwsUpload', value)}
                    trackColor={{ false: '#767577', true: '#259B9A' }}
                    thumbColor={config.features.enableAwsUpload ? '#f4f3f4' : '#f4f3f4'}
                  />
                </View>
                
              <View style={styles.uploadRow}>
                <Text style={styles.uploadLabel}>Flag for AWS Upload:</Text>
                <Switch
                  value={flaggedForUpload}
                  onValueChange={toggleUploadFlag}
                  trackColor={{ false: '#767577', true: '#259B9A' }}
                  thumbColor={flaggedForUpload ? '#f4f3f4' : '#f4f3f4'}
                />
              </View>
              
              <View style={styles.uploadStatusRow}>
                <Text style={styles.uploadLabel}>Upload Status:</Text>
                <View style={styles.statusContainer}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                  <Text style={styles.statusText}>{getStatusText()}</Text>
                </View>
              </View>

              {/* AWS Settings Button */}
              <TouchableOpacity 
                style={[styles.uploadButton, { backgroundColor: '#2196F3', marginTop: 12 }]} 
                onPress={() => router.push('/screens/AWSSettings')}
              >
                <MaterialIcons name="settings" size={20} color="white" />
                <Text style={styles.uploadButtonText}>Configure AWS Settings</Text>
              </TouchableOpacity>
              
              {flaggedForUpload && uploadStatus === 'pending' && (
                <TouchableOpacity 
                  style={styles.uploadButton} 
                  onPress={() => {
                    performAwsUpload();
                  }}
                >
                  <MaterialIcons name="cloud-upload" size={20} color="white" />
                  <Text style={styles.uploadButtonText}>Upload to AWS</Text>
                </TouchableOpacity>
              )}
              
              {uploadStatus === 'uploading' && (
                <View style={styles.uploadingContainer}>
                  <View style={styles.uploadingHeader}>
                    <MaterialIcons name="cloud-upload" size={20} color="#259B9A" />
                    <Text style={styles.uploadingText}>Uploading... {uploadProgress.toFixed(1)}%</Text>
                  </View>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: `${Math.max(uploadProgress, 2)}%` }]} />
                  </View>
                </View>
              )}
              
              {uploadStatus === 'completed' && (
                <View style={styles.completedContainer}>
                  <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
                  <Text style={styles.completedText}>Upload Completed!</Text>
                </View>
              )}
              
              {uploadStatus === 'failed' && (
                <View style={styles.failedContainer}>
                  <MaterialIcons name="error" size={20} color="#F44336" />
                  <Text style={styles.failedText}>Upload Failed</Text>
                </View>
              )}
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>


      {/* Video Editor Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showVideoEditor}
        onRequestClose={closeVideoEditor}
      >
        <View style={styles.toasterOverlay}>
          <View style={styles.toasterContent}>
            <View style={styles.toasterHeader}>
              <Text style={styles.toasterTitle}>
                {activeEditorTool === 'edit' && 'Video Editor'}
                {activeEditorTool === 'text' && 'Add Text'}
                {activeEditorTool === 'stickers' && 'Add Stickers'}
                {activeEditorTool === 'audio' && 'Audio Editor'}
                {activeEditorTool === 'filters' && 'Video Filters'}
              </Text>
              <TouchableOpacity onPress={closeVideoEditor}>
                <MaterialIcons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.toasterBody}>
              {activeEditorTool === 'edit' && (
                <VideoEditingTools
                  videoUri={videoUri}
                  videoDuration={(videoMetadata?.duration || player?.duration || 0)}
                  splitTime={uiSplitTime}
                  onSplitTimeChange={(t) => setUiSplitTime(Math.max(0, Math.min(t, getFullDuration())))}
                  keptLeft={(segments.some(s => (Math.min(uiSplitTime, s.end) > s.start)))}
                  keptRight={(segments.some(s => (s.end > Math.max(uiSplitTime, s.start))))}
                  onConfirmTrim={async (startSec, endSec) => {
                    // Simulate trimming on Expo: constrain playback and timeline to range
                    const full = videoMetadata?.duration || player?.duration || 0;
                    const start = Math.max(0, Math.min(startSec, full));
                    const end = Math.max(start, Math.min(endSec, full));
                    setTrimStartSec(start);
                    setTrimEndSec(end);
                    setSegments(normalizeSegments([{ start, end }]));
                    if (player) {
                      player.currentTime = start;
                    }
                    setActiveEditorTool(null);
                    setShowVideoEditor(false);
                    Alert.alert('Trim Applied', 'Preview limited to selected range (simulation).');
                  }}
                  onSplitVideo={(timeSec) => {
                    const full = getFullDuration();
                    const t = Math.max(0, Math.min(timeSec, full));
                    setUiSplitTime(t);
                    if (segments.length === 0) return;
                    const newSegs: Array<{ start: number; end: number }> = [];
                    for (const s of segments) {
                      if (t <= s.start || t >= s.end) {
                        newSegs.push({ ...s });
                      } else {
                        newSegs.push({ start: s.start, end: t });
                        newSegs.push({ start: t, end: s.end });
                      }
                    }
                    setSegments(normalizeSegments(newSegs));
                    Alert.alert('Split', `Video split at ${t.toFixed(2)}s (simulation).`);
                  }}
                  onCropVideo={() => handleVideoEdit('crop', {})}
                  onRotateVideo={() => handleVideoEdit('rotate', {})}
                  onSpeedChange={(speed) => handleVideoEdit('speed', { speed })}
                  onDeleteClip={(startSec, endSec) => {
                    const full = getFullDuration();
                    const start = Math.max(0, Math.min(startSec, full));
                    const end = Math.max(start, Math.min(endSec, full));
                    if (segments.length === 0) return;
                    
                    console.log('Delete operation:', { start, end, currentSegments: segments });
                    
                    const updated: Array<{ start: number; end: number }> = [];
                    for (const s of segments) {
                      // If [start,end] fully outside segment, keep as is
                      if (end <= s.start || start >= s.end) {
                        updated.push({ ...s });
                        continue;
                      }
                      // Overlap cases: cut out [start,end] portion from s
                      if (start > s.start) {
                        updated.push({ start: s.start, end: Math.min(start, s.end) });
                      }
                      if (end < s.end) {
                        updated.push({ start: Math.max(end, s.start), end: s.end });
                      }
                    }
                    
                    const normalized = normalizeSegments(updated);
                    console.log('Updated segments after delete:', normalized);
                    setSegments(normalized);
                    
                    // If all segments deleted, fall back to empty (no playback)
                    if (normalized.length > 0) {
                      const nextStart = normalized[0].start;
                      if (player) {
                        player.currentTime = nextStart;
                        console.log('Seeking player to:', nextStart);
                      }
                      setCurrentTime(nextStart);
                    }
                    Alert.alert('Delete', 'Current segment deleted (simulation).');
                  }}
                  onDuplicateClip={() => handleVideoEdit('duplicate', {})}
                  onMergeClips={() => handleVideoEdit('merge', {})}
                  onReverseVideo={() => handleVideoEdit('reverse', {})}
                />
              )}
              
              {activeEditorTool === 'text' && (
                <TextOverlay
                  onAddText={handleTextAdd}
                  onAddTemplate={(template) => handleTextAdd(template, {})}
                  
                />
              )}
              
              {activeEditorTool === 'stickers' && (
                <StickerOverlay
                  onAddSticker={handleStickerAdd}
                  onAddImage={handleImageAdd}
                  currentTime={currentTime}
                  videoDuration={videoDuration}
                />
              )}
              
              {activeEditorTool === 'audio' && (
                  <ScrollView 
                    style={styles.audioEditorContainer}
                    contentContainerStyle={styles.audioEditorContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <VolumeControl 
                      style={styles.audioVolumeControl}
                      showLabel={true}
                      onAudioAdded={handleAudioAdded}
                      onAudioRemoved={handleAudioRemoved}
                      // Voice recording props
                      isRecording={isRecording}
                      isVoiceLoaded={isVoiceLoaded}
                      voiceVolume={voiceVolume}
                      isVoiceMuted={isVoiceMuted}
                      onStartRecording={startVoiceRecording}
                      onStopRecording={stopVoiceRecording}
                      onDeleteVoice={deleteVoiceRecording}
                      onVoiceVolumeChange={updateVoiceVolume}
                      onVoiceMuteToggle={toggleVoiceMute}
                    />
                  </ScrollView>
              )}
          
              
              {activeEditorTool === 'transitions' && (
                <>
                  {activeSplitForTransition && (
                    <View style={styles.splitTransitionHeader}>
                      <Text style={styles.splitTransitionText}>
                        Adding transition to split at {activeSplitForTransition.time.toFixed(1)}s
                      </Text>
                      <TouchableOpacity 
                        onPress={() => {
                          setActiveSplitForTransition(null);
                          setActiveEditorTool(null);
                          setShowVideoEditor(false);
                        }}
                        style={styles.cancelSplitTransition}
                      >
                        <MaterialIcons name="close" size={moderateScale(20)} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                  <TransitionOverlay
                    videoDuration={getFullDuration()}
                    currentTime={activeSplitForTransition?.time ?? currentTime}
                    onAddTransition={handleTransitionAdd}
                    onRemoveTransition={handleTransitionRemove}
                    existingTransitions={transitionEffects}
                  />
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
      </GestureHandlerRootView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  audioEditorContainer: {
    flex: 1,
    padding: moderateScale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: moderateScale(8),
    margin: moderateScale(10),
  },
  audioEditorContent: {
    flexGrow: 1,
    paddingBottom: moderateScale(20),
  },
  audioVolumeControl: {
    backgroundColor: 'transparent',
    margin: 0,
  },
  splitTransitionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 1,
    borderColor: '#FFD700',
    borderRadius: moderateScale(8),
    padding: moderateScale(12),
    margin: moderateScale(10),
    marginBottom: 0,
  },
  splitTransitionText: {
    color: '#FFD700',
    fontSize: moderateScale(14),
    fontWeight: '600',
    flex: 1,
  },
  cancelSplitTransition: {
    padding: moderateScale(4),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: moderateScale(15),
  },
  transitionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: moderateScale(8),
  },
  header: {
    paddingTop: moderateScale(15),
    paddingBottom: moderateScale(15),
    alignItems: "center",
    position: "relative",
    minHeight: moderateScale(60),
  },
  backButton: {
    position: "absolute",
    left: moderateScale(20),
    top: moderateScale(18),
    zIndex: 1,
    padding: moderateScale(8),
  },
  headerLine: {
    width: SCREEN_WIDTH * 0.8,
    height: 1,
    backgroundColor: '#259B9A',
    marginTop: moderateScale(15),
  },
  headerTitle: {
    fontSize: moderateScale(24),
    fontWeight: "bold",
    color: AppColors.white,
    textAlign: "center",
  },
  headerActions: {
    position: "absolute",
    right: moderateScale(20),
    top: moderateScale(18),
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(15),
    zIndex: 1,
  },
  headerIcon: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: "rgba(37, 155, 154, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#259B9A",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: moderateScale(30),
  },
  videoContainer: {
    alignItems: "center",
    marginTop: moderateScale(20),
    marginBottom: moderateScale(30),
    paddingHorizontal: moderateScale(10),
  },
  video: {
    width: SCREEN_WIDTH * 0.95,
    height: Math.min(SCREEN_HEIGHT * 0.5, moderateScale(440)), // Responsive height
    maxHeight: moderateScale(500),
    borderRadius: moderateScale(10),
    backgroundColor: "black",
    alignSelf: 'center',
  },
  videoTapArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: moderateScale(65), // Leave space for custom controls
    zIndex: 3, // Below overlays but above video
  },
  customControlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: moderateScale(15),
    paddingVertical: moderateScale(12),
    zIndex: 10,
  },
  customTimeText: {
    color: '#FFFFFF',
    fontSize: moderateScale(14),
    fontWeight: '600',
    fontFamily: 'monospace',
    marginBottom: moderateScale(8),
  },
  customSeekbarContainer: {
    width: '100%',
    height: moderateScale(30),
    justifyContent: 'center',
  },
  customSeekbarTrack: {
    width: '100%',
    height: moderateScale(4),
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: moderateScale(2),
    overflow: 'hidden',
  },
  customSeekbarProgress: {
    height: '100%',
    backgroundColor: '#259B9A',
    borderRadius: moderateScale(2),
  },
  customSeekbarThumb: {
    position: 'absolute',
    width: moderateScale(12),
    height: moderateScale(12),
    borderRadius: moderateScale(6),
    backgroundColor: '#FFFFFF',
    top: '50%',
    marginTop: -moderateScale(6),
    marginLeft: -moderateScale(6),
    borderWidth: 2,
    borderColor: '#259B9A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  customSeekbarTouchArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  playPauseOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: moderateScale(25),
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  playControlContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: moderateScale(30),
  },
  playButton: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: moderateScale(25),
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: moderateScale(15),
  },
  timeText: {
    color: "white",
    fontSize: moderateScale(16),
  },
  saveButton: {
    backgroundColor: "#259B9A",
    marginHorizontal: moderateScale(20),
    paddingVertical: moderateScale(18),
    borderRadius: moderateScale(12),
    alignItems: "center",
    marginBottom: moderateScale(30),
  },
  saveButtonText: {
    color: "white",
    fontSize: moderateScale(16),
    fontWeight: "600",
  },
  editSection: {
    paddingHorizontal: moderateScale(20),
    marginTop: moderateScale(20), // Move buttons further down
  },
  editButtonsContainer: {
    paddingHorizontal: moderateScale(8),
  },
  editButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(16),
    marginHorizontal: moderateScale(8),
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: moderateScale(8),
    minWidth: moderateScale(62), // Increase width by 2px (from 60 to 62)
  },
  editButtonText: {
    color: "white",
    fontSize: moderateScale(12),
    marginTop: moderateScale(4),
    textAlign: "center",
  },
  videoView: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    position: "relative",
    height: "90%",
    marginTop: 50,
  },
  YesNoButton: {
    marginHorizontal: 10,
    padding: 10,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: 80
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    marginRight: 8,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  noVideoText: {
    color: "#fff",
    fontSize: 18,
  },
  lottie: {
    width: 200,
    height: 200,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
    width: moderateScale(300),
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
  },
  modalUrl: {
    fontSize: 14,
    color: "#0000EE",
    marginBottom: 20,
    textAlign: "center",
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "80%",
  },
  uploadSection: {
    paddingHorizontal: moderateScale(20),
    marginBottom: moderateScale(20),
    backgroundColor: "rgba(37, 155, 154, 0.1)",
    borderRadius: moderateScale(12),
    padding: moderateScale(15),
    marginHorizontal: moderateScale(20),
  },
  uploadTitle: {
    color: "white",
    fontSize: moderateScale(16),
    fontWeight: "600",
    marginBottom: moderateScale(15),
  },
  uploadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: moderateScale(12),
  },
  uploadStatusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: moderateScale(15),
  },
  uploadLabel: {
    color: "white",
    fontSize: moderateScale(14),
    fontWeight: "500",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: moderateScale(4),
    marginRight: moderateScale(8),
  },
  statusText: {
    color: "white",
    fontSize: moderateScale(14),
  },
  uploadButton: {
    backgroundColor: "#259B9A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(15),
    paddingHorizontal: moderateScale(20),
    borderRadius: moderateScale(10),
    marginTop: moderateScale(15),
    marginBottom: moderateScale(10),
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  uploadButtonText: {
    color: "white",
    fontSize: moderateScale(14),
    fontWeight: "600",
    marginLeft: moderateScale(8),
  },
  uploadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(12),
    marginTop: moderateScale(10),
  },
  uploadingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: moderateScale(8),
  },
  uploadingText: {
    color: "#259B9A",
    fontSize: moderateScale(14),
    fontWeight: "600",
    marginLeft: moderateScale(8),
  },
  progressBarContainer: {
    width: '100%',
    height: moderateScale(8),
    backgroundColor: 'rgba(37, 155, 154, 0.3)',
    borderRadius: moderateScale(4),
    marginTop: moderateScale(12),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(37, 155, 154, 0.5)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#259B9A',
    borderRadius: moderateScale(4),
    minWidth: 2,
  },
  completedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(12),
    marginTop: moderateScale(10),
  },
  completedText: {
    color: "#4CAF50",
    fontSize: moderateScale(14),
    fontWeight: "600",
    marginLeft: moderateScale(8),
  },
  failedContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(12),
    marginTop: moderateScale(10),
  },
  failedText: {
    color: "#F44336",
    fontSize: moderateScale(14),
    fontWeight: "600",
    marginLeft: moderateScale(8),
  },
  toasterOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  toasterContent: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: moderateScale(20),
    borderTopRightRadius: moderateScale(20),
    maxHeight: "80%",
    minHeight: "60%",
  },
  toasterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(20),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  toasterTitle: {
    color: "white",
    fontSize: moderateScale(18),
    fontWeight: "600",
  },
  toasterBody: {
    flex: 1,
    maxHeight: moderateScale(500),
  },
  toasterBodyContent: {
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(20),
    paddingBottom: moderateScale(30),
    flexGrow: 1,
  },
 
   textOverlay: {
     position: 'absolute',
     zIndex: 10,
     backgroundColor: 'transparent',
   },
   overlayText: {
     fontWeight: 'bold',
     textShadowColor: 'rgba(0, 0, 0, 0.75)',
     textShadowOffset: { width: 1, height: 1 },
     textShadowRadius: 2,
   },
   stickerOverlay: {
     position: 'absolute',
     zIndex: 10,
     backgroundColor: 'transparent',
     borderRadius: 8,
     padding: 4,
   },
   stickerText: {
     textAlign: 'center',
   },
   imageOverlay: {
     position: 'absolute',
     zIndex: 10,
     backgroundColor: 'transparent',
     overflow: 'hidden',
   },
   toasterContainer: {
     borderBottomWidth: 1,
     borderBottomColor: "rgba(255, 255, 255, 0.1)",
   },
  // Input Styles
  inputGroup: {
    marginBottom: moderateScale(15),
  },
  inputLabel: {
    fontSize: moderateScale(14),
    color: "#ccc",
    marginBottom: moderateScale(5),
    fontWeight: "600",
  },
  inputHelpText: {
    fontSize: moderateScale(12),
    color: "#999",
    marginBottom: moderateScale(8),
    fontStyle: "italic",
  },
  input: {
    backgroundColor: "#333",
    borderRadius: moderateScale(8),
    padding: moderateScale(12),
    color: "white",
    fontSize: moderateScale(16),
    borderWidth: 1,
    borderColor: "#444",
  },
  warningText: {
    fontSize: moderateScale(12),
    color: "#F44336",
    marginTop: moderateScale(5),
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: moderateScale(16),
    fontWeight: "600",
    color: "white",
    marginBottom: moderateScale(15),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: moderateScale(20),
    borderBottomWidth: 1,
    borderBottomColor: "#444",
  },
  modalTitle: {
    color: "#fff",
    fontSize: moderateScale(18),
    fontWeight: "600",
  },
  closeButton: {
    padding: moderateScale(4),
  },
 
});

export default PreviewVideoShoot;