import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  success: boolean;
  key?: string;
  url?: string;
  error?: string;
  expiresAt?: string; // ISO date string when the video will be automatically deleted
}

export interface VideoUploadStatus {
  id: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;
  key?: string;
  url?: string;
  error?: string;
  timestamp: number;
  expiresAt?: string; // ISO date string when the video will be automatically deleted
}

export interface AwsConfig {
  presignedUrl: string;
  region?: string;
  bucketName?: string;
  expirationDays?: number; // Number of days after which objects will expire
  backendUrl?: string; // Backend API URL for generating presigned URLs
}

class AWSS3Service {
  private static isInitialized = false;
  private static testMode = false;
  private static uploadStatuses: Map<string, VideoUploadStatus> = new Map();

  /**
   * Initialize the AWS S3 service in test mode
   */
  static async initializeTestMode(): Promise<void> {
    try {
      console.log('Initializing AWS S3 service in test mode...');
      this.testMode = true;
      this.isInitialized = true;
      
      // Load existing upload statuses from storage
      await this.loadUploadStatuses();
      
      console.log('AWS S3 service initialized in test mode');
    } catch (error) {
      console.error('Failed to initialize AWS S3 service:', error);
      throw error;
    }
  }

  /**
   * Load configuration from storage
   */
  static async loadConfig(): Promise<AwsConfig | null> {
    try {
      const configString = await AsyncStorage.getItem('aws_config');
      if (configString) {
        const config = JSON.parse(configString);
        console.log('AWS config loaded:', { ...config, presignedUrl: config.presignedUrl ? '***' : 'none' });
        return config;
      }
      return null;
    } catch (error) {
      console.error('Failed to load AWS config:', error);
      return null;
    }
  }

  /**
   * Save configuration to storage
   */
  static async saveConfig(config: AwsConfig): Promise<void> {
    try {
      // Set default expiration to 7 days if not specified
      if (!config.expirationDays) {
        config.expirationDays = 7;
      }
      await AsyncStorage.setItem('aws_config', JSON.stringify(config));
      console.log('AWS config saved successfully with expiration days:', config.expirationDays);
    } catch (error) {
      console.error('Failed to save AWS config:', error);
      throw error;
    }
  }

  /**
   * Upload video to S3 using pre-signed URL
   */
  static async uploadVideo(
    videoUri: string,
    presignedUrl: string,
    onProgress?: (progress: UploadProgress) => void,
    expirationDays?: number
  ): Promise<UploadResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('AWS S3 service not initialized');
      }

      if (!presignedUrl) {
        throw new Error('Pre-signed URL is required for upload');
      }

      // Get config to check expiration days
      const config = await this.loadConfig();
      const expireDays = expirationDays || config?.expirationDays || 7;
      
      console.log('Starting video upload...', { 
        videoUri, 
        presignedUrl: presignedUrl.substring(0, 50) + '...', 
        expirationDays: expireDays 
      });

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      if (!fileInfo.exists) {
        throw new Error('Video file does not exist');
      }
      
      const fileSize = fileInfo.size || 0;
      console.log('File size:', fileSize, 'bytes', 'with expiration after', expireDays, 'days');

      // Use FileSystem.uploadAsync for React Native compatibility
      console.log('Using FileSystem.uploadAsync for upload...');
      
      return new Promise(async (resolve, reject) => {
        try {
          // FileSystem.uploadAsync is better for React Native
          const uploadResult = await FileSystem.uploadAsync(presignedUrl, videoUri, {
            httpMethod: 'PUT',
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            headers: {
              'Content-Type': 'video/mp4',
            },
          });

          if (uploadResult.status >= 200 && uploadResult.status < 300) {
            console.log('Upload completed successfully');
            
            // Extract key from presigned URL
            const urlParts = presignedUrl.split('?')[0].split('/');
            const key = urlParts[urlParts.length - 1];
            
            // Calculate expiration date
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + expireDays);
            console.log(`Video will expire on: ${expirationDate.toISOString()}`);
            
            resolve({
              success: true,
              key: key,
              url: presignedUrl.split('?')[0],
              expiresAt: expirationDate.toISOString(),
            });
          } else {
            reject(new Error(`Upload failed with status ${uploadResult.status}`));
          }
        } catch (error) {
          reject(error);
        }
      });
      
    } catch (error) {
      console.error('Upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error',
      };
    }
  }

  /**
   * Update video upload status
   */
  static async updateVideoUploadStatus(
    videoId: string,
    status: VideoUploadStatus['status'],
    key?: string,
    url?: string,
    error?: string,
    progress: number = 0,
    expiresAt?: string
  ): Promise<void> {
    try {
      // If no expiration date is provided and status is completed, calculate default (7 days)
      let expiration = expiresAt;
      if (!expiration && status === 'completed') {
        const config = await this.loadConfig();
        const expireDays = config?.expirationDays || 7;
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + expireDays);
        expiration = expirationDate.toISOString();
      }
      
      const uploadStatus: VideoUploadStatus = {
        id: videoId,
        status,
        progress,
        key,
        url,
        error,
        timestamp: Date.now(),
        expiresAt: expiration,
      };

      this.uploadStatuses.set(videoId, uploadStatus);
      await this.saveUploadStatuses();
      
      console.log('Upload status updated:', { videoId, status, progress });
    } catch (error) {
      console.error('Failed to update upload status:', error);
    }
  }

  /**
   * Get video upload status
   */
  static getVideoUploadStatus(videoId: string): VideoUploadStatus | undefined {
    return this.uploadStatuses.get(videoId);
  }

  /**
   * Get all video upload statuses
   */
  static getAllUploadStatuses(): VideoUploadStatus[] {
    return Array.from(this.uploadStatuses.values());
  }

  /**
   * Save upload statuses to storage
   */
  private static async saveUploadStatuses(): Promise<void> {
    try {
      const statuses = Array.from(this.uploadStatuses.entries());
      await AsyncStorage.setItem('upload_statuses', JSON.stringify(statuses));
    } catch (error) {
      console.error('Failed to save upload statuses:', error);
    }
  }

  /**
   * Load upload statuses from storage
   */
  private static async loadUploadStatuses(): Promise<void> {
    try {
      const statusesString = await AsyncStorage.getItem('upload_statuses');
      if (statusesString) {
        const statuses = JSON.parse(statusesString);
        this.uploadStatuses = new Map(statuses);
        console.log('Loaded upload statuses:', this.uploadStatuses.size);
      }
    } catch (error) {
      console.error('Failed to load upload statuses:', error);
    }
  }

  /**
   * Clear upload statuses
   */
  static async clearUploadStatuses(): Promise<void> {
    try {
      this.uploadStatuses.clear();
      await AsyncStorage.removeItem('upload_statuses');
      console.log('Upload statuses cleared');
    } catch (error) {
      console.error('Failed to clear upload statuses:', error);
    }
  }

  /**
   * Check if service is initialized
   */
  static isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Check if in test mode
   */
  static isInTestMode(): boolean {
    return this.testMode;
  }

  /**
   * Upload video using Fetch API (alternative method)
   * This method is more compatible with some React Native environments
   */
  static async uploadVideoWithFetch(
    videoUri: string,
    presignedUrl: string,
    onProgress?: (progress: UploadProgress) => void,
    expirationDays?: number
  ): Promise<UploadResult> {
    try {
      if (!this.isInitialized) {
        throw new Error('AWS S3 service not initialized');
      }

      if (!presignedUrl) {
        throw new Error('Pre-signed URL is required for upload');
      }

      // Get config to check expiration days
      const config = await this.loadConfig();
      const expireDays = expirationDays || config?.expirationDays || 7;
      
      console.log('Starting video upload with Fetch...', { 
        videoUri, 
        presignedUrl: presignedUrl.substring(0, 50) + '...', 
        expirationDays: expireDays 
      });

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      if (!fileInfo.exists) {
        throw new Error('Video file does not exist');
      }
      
      const fileSize = fileInfo.size || 0;
      console.log('File size:', fileSize, 'bytes');

      // Use FileSystem.uploadAsync for React Native compatibility
      console.log('Using FileSystem.uploadAsync with Fetch method...');
      
      const uploadResult = await FileSystem.uploadAsync(presignedUrl, videoUri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'Content-Type': 'video/mp4',
        },
      });

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`Upload failed with status ${uploadResult.status}`);
      }

      console.log('Upload completed successfully');
      
      // Extract key from presigned URL
      const urlParts = presignedUrl.split('?')[0].split('/');
      const key = urlParts[urlParts.length - 1];
      
      // Calculate expiration date
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expireDays);
      console.log(`Video will expire on: ${expirationDate.toISOString()}`);
      
      return {
        success: true,
        key: key,
        url: presignedUrl.split('?')[0],
        expiresAt: expirationDate.toISOString(),
      };
    } catch (error) {
      console.error('Upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error',
      };
    }
  }

  /**
   * Get presigned URL from your backend API
   * 
   * IMPORTANT: Update BACKEND_URL to your actual backend URL
   * For local development: http://YOUR_COMPUTER_IP:3000
   * For production: https://your-backend-domain.com
   */
  static async getPresignedUrlFromBackend(
    fileName: string,
    contentType: string = 'video/mp4'
  ): Promise<string> {
    try {
      // Get backend URL from storage or use default
      const config = await this.loadConfig();
      const BACKEND_URL = config?.backendUrl || 'http://localhost:4000';
      
      const backendUrl = `${BACKEND_URL}/api/get-presigned-url`;
      
      console.log('Fetching presigned URL from backend:', backendUrl);
      console.log('Request:', { fileName, contentType });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName,
          contentType,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Presigned URL received from backend');
      console.log('   Key:', data.key);
      console.log('   Expires in:', data.expiresIn, 'seconds');
      
      if (!data.success || !data.presignedUrl) {
        throw new Error('Invalid response from backend: missing presignedUrl');
      }
      
      return data.presignedUrl;
    } catch (error) {
      console.error('❌ Failed to get presigned URL from backend:', error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Backend request timed out. Check if backend server is running.');
      }
      
      throw error;
    }
  }

  /**
   * Generate presigned URL directly using user's AWS credentials
   * This runs on the client-side (phone) without needing a backend
   */
  static async generatePresignedUrlWithCredentials(
    fileName: string,
    accessKeyId: string,
    secretAccessKey: string,
    region: string,
    bucketName: string,
    contentType: string = 'video/mp4'
  ): Promise<string> {
    try {
      console.log('Generating presigned URL with user credentials...');
      console.log('Region:', region, 'Bucket:', bucketName);

      // Create S3 client with user's credentials
      const s3Client = new S3Client({
        region: region,
        credentials: {
          accessKeyId: accessKeyId,
          secretAccessKey: secretAccessKey,
        },
      });

      // Generate unique key for the video
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = `user-uploads/${timestamp}-${sanitizedFileName}`;

      console.log('Generated key:', key);

      // Create PutObject command
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: contentType,
        Metadata: {
          'uploaded-by': 'teleprompter-app',
          'upload-timestamp': new Date().toISOString(),
        },
      });

      // Generate presigned URL (expires in 15 minutes)
      const presignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 900, // 15 minutes
      });

      console.log('✅ Presigned URL generated successfully');
      console.log('   Key:', key);
      console.log('   Expires in: 900 seconds (15 minutes)');

      return presignedUrl;
    } catch (error) {
      console.error('❌ Failed to generate presigned URL:', error);
      throw new Error(
        `Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate a test pre-signed URL for development
   */
  static generateTestPresignedUrl(fileName: string): string {
    // This is a mock pre-signed URL for testing
    // In a real implementation, this would be generated by your backend
    const timestamp = Date.now();
    const key = `user-uploads/${timestamp}_${fileName}`;
    
    // Mock S3 URL structure
    return `https://test-bucket.s3.amazonaws.com/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=test&X-Amz-Date=${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=test`;
  }

  /**
   * Get instructions for generating presigned URLs
   */
  static getPresignedUrlInstructions(): string {
    return `To upload videos to AWS S3, you need a presigned URL. Here's how to get one:

OPTION 1: Using Your Backend (Recommended)
1. Set up a backend API endpoint that generates presigned URLs
2. Update the backend URL in awsS3Service.ts (line ~425)
3. The app will automatically fetch presigned URLs from your backend

OPTION 2: Manual Generation (Testing Only)
1. Install AWS CLI: https://aws.amazon.com/cli/
2. Configure with: aws configure
3. Generate URL with:
   aws s3 presign s3://YOUR-BUCKET/videos/filename.mp4 --expires-in 3600

OPTION 3: Using AWS Console
1. Go to AWS S3 Console
2. Select your bucket
3. Click "Upload" > Choose file
4. Before uploading, copy the presigned URL from the upload dialog

⚠️ SECURITY WARNING:
Never hardcode AWS credentials in your app. Always use a backend to generate presigned URLs.

📚 See AWS_UPLOAD_README.md for complete setup instructions.`;
  }
}

export default AWSS3Service;
