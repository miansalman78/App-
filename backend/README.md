# Teleprompter Upload Backend

Lightweight Express server that generates AWS S3 presigned URLs for the teleprompter module. This fulfils the Stage 3 roadmap requirement for uploading videos via a backend-managed presigned URL.

## Prerequisites

- Node.js 16+
- An AWS S3 bucket (e.g. `startuppal-video-storage`)
- IAM credentials with `s3:PutObject` permission on the target bucket/prefix

## Setup

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Create an `.env` file based on `env.sample` and supply your AWS values:
   ```ini
   PORT=3000
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=startuppal-video-storage
   AWS_S3_PREFIX=user-uploads/
   AWS_ACCESS_KEY_ID=...
   AWS_SECRET_ACCESS_KEY=...
   ```

3. Start the server:
   ```bash
   npm run start
   # or
   npm run dev
   ```

The service listens on `http://localhost:3000` by default.

## Endpoints

- `GET /health`: returns status and config metadata (useful for the in-app “Test Connection” button).
- `POST /api/get-presigned-url`: accepts `{ fileName, contentType }` and returns a presigned PUT URL for uploading directly to S3.

Example response:
```json
{
  "success": true,
  "presignedUrl": "https://startuppal-video-storage.s3.amazonaws.com/user-uploads/1730981234-video.mp4?...",
  "key": "user-uploads/1730981234-video.mp4",
  "bucket": "startuppal-video-storage",
  "region": "us-east-1",
  "expiresIn": 900
}
```

## Connecting the App

Set the backend URL inside the app (`AWSSettings` screen or AsyncStorage key `aws_config.backendUrl`). The mobile client now **always** requests this endpoint to obtain upload URLs—no direct AWS credentials are required on the device.

Make sure the device/emulator can reach the machine running the backend (use your LAN IP in the settings, e.g. `http://192.168.x.x:3000`).

