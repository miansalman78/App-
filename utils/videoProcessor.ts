import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Platform } from 'react-native';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  frameRate: number;
  size: number;
}

export interface VideoFrame {
  id: number;
  time: number;
  thumbnail: string;
}

export class VideoProcessor {
  /**
   * Helper function to convert seconds to integer milliseconds
   * This ensures the value is ALWAYS an integer, never a float
   */
  private static toIntegerMilliseconds(seconds: number): number {
    // Step 1: Round the seconds value to remove floating point errors
    // Use toFixed(3) to limit to millisecond precision, then parse back
    const roundedSeconds = parseFloat(seconds.toFixed(3));
    
    // Step 2: Multiply by 1000 to get milliseconds
    const milliseconds = roundedSeconds * 1000;
    
    // Step 3: Use Math.floor to round down (guarantees integer)
    // Then convert to string and back to remove any floating point artifacts
    const integerMillis = Math.floor(milliseconds);
    
    // Step 4: Convert to string and parse as integer (removes any decimal representation)
    const stringMillis = integerMillis.toString();
    const parsedMillis = parseInt(stringMillis, 10);
    
    // Step 5: Final bitwise conversion to force 32-bit integer representation
    const finalInteger = parsedMillis | 0;
    
    // Step 6: Validate it's truly an integer
    if (!Number.isInteger(finalInteger) || finalInteger < 0) {
      console.error(`toIntegerMilliseconds failed: ${seconds}s -> ${finalInteger}ms`);
      // Fallback: use Math.floor directly
      return Math.floor(milliseconds) | 0;
    }
    
    return finalInteger;
  }

  /**
   * Get video metadata including duration, dimensions, etc.
   */
  static async getVideoMetadata(videoUri: string): Promise<VideoMetadata> {
    try {
      // Skip file info check to avoid FileSystem errors
      console.log('Skipping file info check for demo purposes');
      
      // For web platform, use HTML5 video element to get metadata
      if (Platform.OS === 'web') {
        return new Promise((resolve) => {
          const video = document.createElement('video');
          video.preload = 'metadata';
          
          video.onloadedmetadata = () => {
            console.log('Web video metadata loaded - duration:', video.duration);
            resolve({
              duration: video.duration || 0,
              width: video.videoWidth || 1920,
              height: video.videoHeight || 1080,
              frameRate: 30, // Default frame rate for web
              size: 0, // Default size for demo
            });
          };
          
          video.onerror = () => {
            console.log('Web video metadata error - using fallback');
            // Fallback metadata
            resolve({
              duration: 0,
              width: 1920,
              height: 1080,
              frameRate: 30,
              size: 0, // Default size for demo
            });
          };
          
          video.src = videoUri;
        });
      }
      
      // For native platforms, try to use expo-video-thumbnails to get metadata
      try {
        // Generate a thumbnail at time 0 to extract video metadata
        // Use helper function to ensure integer (even for 0)
        const timeZero = this.toIntegerMilliseconds(0);
        const { uri, width, height } = await VideoThumbnails.getThumbnailAsync(
          videoUri,
          {
            time: timeZero, // Guaranteed integer milliseconds
            quality: 0.1, // Low quality since we just need metadata
          }
        );
        
        // Use expo-av Audio to get duration  
        try {
          const { sound } = await Audio.Sound.createAsync(
            { uri: videoUri },
            { shouldPlay: false }
          );
          
          const status = await sound.getStatusAsync();
          
          if (status.isLoaded && status.durationMillis) {
            const durationInSeconds = status.durationMillis / 1000;
            console.log('Native video metadata loaded - duration:', durationInSeconds);
            
            // Cleanup
            await sound.unloadAsync();
            
            return {
              duration: durationInSeconds,
              width: width || 1920,
              height: height || 1080,
              frameRate: 30,
              size: 0,
            };
          }
          
          // Cleanup if failed
          await sound.unloadAsync();
        } catch (avError) {
          console.log('Expo-AV duration extraction failed, using estimate:', avError);
        }
        
        // If expo-av fails but we got thumbnail, estimate duration from file
        console.log('Using thumbnail-based metadata - width:', width, 'height:', height);
        return {
          duration: 10, // Default estimate if duration extraction fails
          width: width || 1920,
          height: height || 1080,
          frameRate: 30,
          size: 0,
        };
      } catch (thumbnailError) {
        console.log('Thumbnail metadata extraction failed:', thumbnailError);
      }
      
      // Final fallback - use a reasonable default
      console.log('Using fallback metadata with default duration');
      return {
        duration: 10, // Default 10 seconds instead of 0
        width: 1920,
        height: 1080,
        frameRate: 30,
        size: 0,
      };
    } catch (error) {
      console.error('Error getting video metadata:', error);
      // Fallback to default values
      return {
        duration: 0, // Default 0 seconds
        width: 1920,
        height: 1080,
        frameRate: 30,
        size: 0,
      };
    }
  }

  /**
   * Extract video frames at specified intervals
   */
  static async extractVideoFrames(
    videoUri: string, 
    frameCount: number, 
    frameInterval: number = 0.5,
    startTime: number = 0,
    endTime?: number
  ): Promise<VideoFrame[]> {
    try {
      const frames: VideoFrame[] = [];
      
      // Get video metadata to determine actual duration
      const metadata = await this.getVideoMetadata(videoUri);
      const videoDuration = metadata.duration;
      const actualEndTime = endTime || videoDuration;
      const trimDuration = actualEndTime - startTime;
      
      console.log('Extracting frames - video duration:', videoDuration, 'trim range:', startTime, 'to', actualEndTime, 'trim duration:', trimDuration);
      const actualFrameInterval = trimDuration / frameCount;
      console.log('Calculated frame interval for trimmed video:', actualFrameInterval);
      
      // For web platform, use HTML5 video to extract actual frame thumbnails
      if (Platform.OS === 'web') {
        return new Promise((resolve) => {
          const video = document.createElement('video');
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          video.preload = 'metadata';
          video.crossOrigin = 'anonymous';
          
          video.onloadedmetadata = async () => {
            console.log('Web video loaded for frame extraction - duration:', video.duration);
            canvas.width = 160; // Thumbnail width
            canvas.height = 90;  // Thumbnail height (16:9 aspect ratio)
            
            const extractFrame = (index: number): Promise<string> => {
              return new Promise((frameResolve) => {
                const time = startTime + (index * actualFrameInterval);
                console.log(`Extracting frame ${index} at time ${time}s (trimmed from ${startTime}s)`);
                video.currentTime = time;
                
                video.onseeked = () => {
                  if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const dataURL = canvas.toDataURL('image/jpeg', 0.7);
                    console.log(`Frame ${index} extracted successfully, dataURL length:`, dataURL.length);
                    frameResolve(dataURL);
                  } else {
                    console.warn(`Frame ${index} extraction failed - no canvas context`);
                    frameResolve('');
                  }
                };
              });
            };
            
            // Extract frames sequentially
            console.log('Starting frame extraction loop...');
            for (let i = 0; i < frameCount; i++) {
              try {
                const thumbnail = await extractFrame(i);
                frames.push({
                  id: i,
                  time: i * actualFrameInterval, // This is the relative time in the trimmed video
                  thumbnail,
                });
                console.log(`Frame ${i} added to frames array`);
              } catch (frameError) {
                console.warn(`Failed to extract frame ${i}:`, frameError);
                frames.push({
                  id: i,
                  time: i * actualFrameInterval, // This is the relative time in the trimmed video
                  thumbnail: '',
                });
              }
            }
            
            console.log('Frame extraction completed. Total frames:', frames.length);
            resolve(frames);
          };
          
          video.onerror = () => {
            console.warn('Video loading failed, using placeholder frames');
            // Fallback to placeholder frames
            for (let i = 0; i < frameCount; i++) {
              frames.push({
                id: i,
                time: i * actualFrameInterval,
                thumbnail: '',
              });
            }
            resolve(frames);
          };
          
          video.src = videoUri;
        });
      }
      
      // For native platforms, generate actual thumbnails using expo-video-thumbnails
      console.log('Native platform detected - generating actual thumbnails');
      
      for (let i = 0; i < frameCount; i++) {
        // Calculate absolute time and ensure it's a clean number
        // Round to avoid floating point precision issues
        const rawAbsoluteTime = startTime + Math.min(i * actualFrameInterval, trimDuration - 0.1);
        // Round to nearest millisecond precision (3 decimal places), then clean up any precision errors
        const absoluteTime = parseFloat((Math.round(rawAbsoluteTime * 1000) / 1000).toFixed(3));
        const rawRelativeTime = i * actualFrameInterval;
        const relativeTime = parseFloat((Math.round(rawRelativeTime * 1000) / 1000).toFixed(3));
        
        try {
          const thumbnailUri = await VideoProcessor.generateThumbnail(videoUri, absoluteTime);
          frames.push({
            id: i,
            time: relativeTime, // Use relative time for trimmed video
            thumbnail: thumbnailUri,
          });
          console.log(`Native thumbnail ${i} generated for absolute time ${absoluteTime}s (relative ${relativeTime}s): ${thumbnailUri ? 'success' : 'failed'}`);
        } catch (error) {
          console.error(`Error generating thumbnail ${i} at absolute time ${absoluteTime}s:`, error);
          // Push frame with empty thumbnail on error
          frames.push({
            id: i,
            time: relativeTime, // Use relative time for trimmed video
            thumbnail: '',
          });
        }
      }
      
      return frames;
    } catch (error) {
      console.error('Error extracting video frames:', error);
      // Return placeholder frames as fallback
      const fallbackFrames: VideoFrame[] = [];
      for (let i = 0; i < frameCount; i++) {
        fallbackFrames.push({
          id: i,
          time: i * frameInterval, // Use the function parameter frame interval
          thumbnail: '',
        });
      }
      return fallbackFrames;
    }
  }

  /**
   * Generate a thumbnail from video at specified time
   */
  static async generateThumbnail(
    videoUri: string, 
    timeInSeconds: number = 1
  ): Promise<string> {
    try {
      console.log(`generateThumbnail called with videoUri: ${videoUri}, time: ${timeInSeconds}s`);
      
      // For web platform, return empty string since we can't generate thumbnails
      if (Platform.OS === 'web') {
        console.log('Web platform: thumbnail generation not supported');
        return '';
      }
      
      // Check if expo-video-thumbnails is available
      if (!VideoThumbnails || !VideoThumbnails.getThumbnailAsync) {
        console.error('expo-video-thumbnails not available');
        return '';
      }
      
      // Get video metadata to validate time bounds
      const metadata = await this.getVideoMetadata(videoUri);
      console.log(`Video duration: ${metadata.duration}s, requested time: ${timeInSeconds}s`);
      console.log(videoUri);
      
      // Ensure requested time is within video duration
      if (timeInSeconds >= metadata.duration) {
        console.warn(`Requested time ${timeInSeconds}s exceeds video duration ${metadata.duration}s - using last valid frame`);
        timeInSeconds = Math.max(0, metadata.duration - 0.1);
      }
      
      // For native platforms, use expo-video-thumbnails
      console.log(`Generating thumbnail for ${videoUri} at time ${timeInSeconds}s`);
      
      // Convert to integer milliseconds using helper function
      // This helper guarantees the value is ALWAYS an integer
      let timeParam = this.toIntegerMilliseconds(timeInSeconds);
      
      // Final validation before passing to native module
      if (!Number.isInteger(timeParam) || timeParam < 0 || !Number.isFinite(timeParam)) {
        console.error(`Invalid timeInMillis after conversion: ${timeParam} (from ${timeInSeconds}s), returning empty`);
        return '';
      }
      
      // Additional check: ensure no decimal part (should never happen, but defensive)
      if (timeParam % 1 !== 0) {
        console.error(`timeParam has decimal part: ${timeParam}, forcing to integer`);
        // Force to integer by using floor
        const forcedInteger = Math.floor(timeParam);
        if (forcedInteger < 0) {
          return '';
        }
        console.log(`Forced integer: ${forcedInteger}`);
        timeParam = forcedInteger;
      }
      
      console.log(`Generating thumbnail at ${timeParam}ms (from ${timeInSeconds}s, verified integer: ${Number.isInteger(timeParam)})`);
      
      // Create options object with guaranteed integer value
      // Use Object.assign to ensure clean object creation
      const thumbnailOptions: { time: number; quality: number } = {
        time: timeParam, // Guaranteed integer milliseconds
        quality: 0.7, // Better performance with slightly lower quality
      };
      
      // Final verification before native call
      if (!Number.isInteger(thumbnailOptions.time)) {
        console.error(`CRITICAL: thumbnailOptions.time is not integer: ${thumbnailOptions.time} (type: ${typeof thumbnailOptions.time})`);
        // Last resort: force integer conversion
        thumbnailOptions.time = Math.floor(thumbnailOptions.time) | 0;
        console.log(`Forced to integer: ${thumbnailOptions.time}`);
      }
      
      // Log the exact value being passed
      console.log(`Calling getThumbnailAsync with time: ${thumbnailOptions.time} (type: ${typeof thumbnailOptions.time}, isInteger: ${Number.isInteger(thumbnailOptions.time)})`);
      
      const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, thumbnailOptions);
      
      console.log(`Thumbnail generated successfully at ${timeInSeconds}s: ${uri}`);
      
      // Skip file verification to avoid FileSystem errors
      console.log(`Thumbnail generated successfully: ${uri}`);
      return uri;
    } catch (error) {
      console.error(`Failed to generate thumbnail at ${timeInSeconds}s:`, error);
      // Return empty string to show placeholder camera icon
      return '';
    }
  }

  /**
   * Clean up temporary files
   */
  static async cleanupTempFiles(): Promise<void> {
    try {
      const tempDirs = [
        `${FileSystem.cacheDirectory}video_frames/`,
        `${FileSystem.cacheDirectory}thumbnails/`,
      ];
      
      for (const dir of tempDirs) {
        const dirInfo = await FileSystem.getInfoAsync(dir);
        if (dirInfo.exists) {
          await FileSystem.deleteAsync(dir, { idempotent: true });
        }
      }
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
    }
  }
}

export default VideoProcessor;