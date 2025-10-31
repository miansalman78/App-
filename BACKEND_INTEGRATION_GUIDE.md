# 🚀 Backend Integration Guide

Complete guide for integrating the backend with your Teleprompter app.

## ✅ What Was Added

### Backend Server (`/backend` folder):
- ✅ Express.js server for generating presigned URLs
- ✅ AWS S3 integration
- ✅ Secure credential management
- ✅ CORS support for mobile app
- ✅ Health check and test endpoints
- ✅ Complete error handling

### Updated App Files:
- ✅ `utils/awsS3Service.ts` - Enhanced with backend integration
- ✅ Added timeout handling
- ✅ Better error messages
- ✅ Backend URL configuration

## 📦 Quick Setup (5 Minutes)

### Step 1: Install Backend Dependencies

```bash
cd backend
npm install
```

**Packages installed:**
- `express` - Web server
- `@aws-sdk/client-s3` - AWS S3 client
- `@aws-sdk/s3-request-presigner` - Generate presigned URLs
- `cors` - Allow mobile app requests
- `dotenv` - Environment variables

### Step 2: Configure AWS Credentials

```bash
# Copy example file
cp .env.example .env
```

Edit `.env` file with your AWS credentials:

```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=abc123...
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your-bucket-name
PORT=3000
```

### Step 3: Start Backend

```bash
npm start
```

You should see:

```
========================================
🚀 Teleprompter Backend Server
========================================
✅ Server running on port 3000
🔗 Health check: http://localhost:3000/health
🔗 Presigned URL endpoint: http://localhost:3000/api/get-presigned-url

⚙️  Configuration:
   AWS Region: us-east-1
   S3 Bucket: your-bucket-name
   Credentials: ✅ Configured
========================================
```

### Step 4: Test Backend

```bash
# In a new terminal
cd backend
node test-api.js
```

Expected output:

```
✅ Health Check: PASSED
✅ AWS Connection: PASSED
✅ Presigned URL Generation: PASSED
✅ Error Handling: PASSED
```

### Step 5: Update App Configuration

Find your computer's IP address:

**Windows:**
```bash
ipconfig
# Look for "IPv4 Address"
# Example: 192.168.1.100
```

**Mac/Linux:**
```bash
ifconfig | grep "inet "
# Example: 192.168.1.100
```

Edit `utils/awsS3Service.ts` line 429:

```typescript
const BACKEND_URL = config?.backendUrl || 'http://YOUR_IP:3000';
//                                             ^^^^^^^^
//                                        Replace with your IP
```

Example:
```typescript
const BACKEND_URL = config?.backendUrl || 'http://192.168.1.100:3000';
```

### Step 6: Test from App

1. Rebuild app if needed:
   ```bash
   npm start
   ```

2. Record a video
3. Tap AWS upload icon
4. Video should upload successfully! ✅

## 🔧 AWS Setup (If Not Done)

### 1. Create S3 Bucket

1. Go to: https://s3.console.aws.amazon.com/
2. Click **"Create bucket"**
3. **Bucket name:** `your-unique-bucket-name`
4. **Region:** `us-east-1` (or your preferred)
5. **Block all public access:** Keep **ENABLED** (recommended)
6. Click **"Create bucket"**

### 2. Configure CORS

1. Open your bucket
2. **Permissions** tab
3. Scroll to **Cross-origin resource sharing (CORS)**
4. Click **Edit**
5. Paste:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag", "x-amz-request-id"],
        "MaxAgeSeconds": 3000
    }
]
```

6. Click **"Save changes"**

### 3. Create IAM User

1. Go to: https://console.aws.amazon.com/iam/
2. **Users** → **Create user**
3. Username: `teleprompter-backend`
4. **Next**
5. **Attach policies directly**
6. Search: `AmazonS3FullAccess` and select it
7. **Next** → **Create user**
8. Click on user → **Security credentials**
9. **Create access key**
10. Select: **"Application running outside AWS"**
11. Copy **Access Key ID** and **Secret Access Key**
12. Add to backend `.env` file

#### Secure IAM Policy (Recommended):

Instead of full S3 access, use minimal permissions:

1. IAM → Policies → Create policy
2. JSON tab:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject"
            ],
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        }
    ]
}
```

3. Name: `TeleprompterS3Access`
4. Attach to user

## 📱 How It Works

```
┌─────────────┐
│   Mobile    │  1. Request presigned URL
│     App     │─────────────────────────────┐
└─────────────┘                             │
       │                                    │
       │ 3. Upload video                    ▼
       │    using URL              ┌──────────────┐
       │                           │   Backend    │
       └──────────────┐            │   Server     │
                      │            └──────────────┘
                      │                    │
                      │                    │ 2. Generate
                      │                    │    presigned URL
                      ▼                    │
              ┌──────────────┐             │
              │   AWS S3     │◄────────────┘
              │   Bucket     │
              └──────────────┘
```

**Process:**
1. App requests presigned URL from backend
2. Backend generates secure, temporary URL
3. App uploads video directly to S3 using that URL
4. No AWS credentials in the app!

## 🎯 Features

### Backend Features:
- ✅ **Secure:** AWS credentials never exposed to app
- ✅ **Fast:** Direct uploads to S3
- ✅ **Validated:** Server-side request validation
- ✅ **Expiring:** URLs expire after 5 minutes
- ✅ **Tested:** Comprehensive test suite
- ✅ **Logged:** Detailed logging for debugging

### App Integration:
- ✅ **Automatic:** Works with existing upload flow
- ✅ **Error Handling:** Clear error messages
- ✅ **Timeout Protection:** 10-second request timeout
- ✅ **Progress Tracking:** Real-time upload progress
- ✅ **Configurable:** Backend URL can be changed

## 🌐 Deployment (Production)

### Option 1: Vercel (Recommended)

```bash
cd backend
npm install -g vercel
vercel
```

Follow prompts, then:

1. Add environment variables in Vercel dashboard:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION`
   - `AWS_BUCKET_NAME`

2. Update app with Vercel URL:
   ```typescript
   const BACKEND_URL = 'https://your-app.vercel.app';
   ```

### Option 2: Railway

1. Go to: https://railway.app
2. **New Project** → **Deploy from GitHub**
3. Select your repository
4. Add environment variables
5. Copy deployment URL
6. Update in app

### Option 3: Heroku

```bash
cd backend
heroku create teleprompter-api
git push heroku main
heroku config:set AWS_ACCESS_KEY_ID=...
heroku config:set AWS_SECRET_ACCESS_KEY=...
heroku config:set AWS_BUCKET_NAME=...
heroku config:set AWS_REGION=us-east-1
```

## 🧪 Testing

### Test Backend Locally:

```bash
cd backend

# Health check
curl http://localhost:3000/health

# Get presigned URL
curl -X POST http://localhost:3000/api/get-presigned-url \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.mp4","contentType":"video/mp4"}'

# Run automated tests
node test-api.js
```

### Test from Mobile App:

1. **Enable Debug Logs:**
   - Shake device → Enable Remote Debugging
   - Check console logs

2. **Try Upload:**
   - Record video
   - Tap AWS icon
   - Tap "Upload to AWS"
   - Check logs for errors

3. **Verify in S3:**
   - Go to S3 Console
   - Open your bucket
   - Look in `videos/` folder
   - Your video should be there!

## 🐛 Troubleshooting

### Backend Not Starting:

**Error:** Port 3000 in use

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :3000
kill -9 <PID>
```

**Error:** AWS credentials not found

- Check `.env` file exists in `backend/` folder
- Verify credentials are correct
- Restart server after updating `.env`

### App Can't Connect:

**Error:** Network request failed

1. **Check backend is running:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Use correct IP:**
   - Not `localhost` from mobile device
   - Use computer's network IP (192.168.x.x)
   - Phone and computer must be on same WiFi

3. **Check firewall:**
   - Allow port 3000 through firewall
   - Windows: Settings → Firewall → Allow app

**Error:** Request timeout

- Backend might be slow or not responding
- Check backend terminal for errors
- Increase timeout in `awsS3Service.ts` if needed

### Upload Fails:

**Error:** 403 Forbidden

- CORS not configured on S3 bucket
- Add CORS configuration (see AWS Setup above)

**Error:** No presigned URL

- Backend can't generate URL
- Check AWS credentials in `.env`
- Run `node test-api.js` to diagnose

**Error:** Invalid bucket

- Check `AWS_BUCKET_NAME` in `.env`
- Verify bucket exists in AWS Console
- Ensure region matches

## 📊 API Reference

### Endpoints:

#### GET /health
Health check endpoint

**Response:**
```json
{
  "status": "OK",
  "message": "Teleprompter backend server is running",
  "timestamp": "2025-10-31T...",
  "config": {
    "region": "us-east-1",
    "bucket": "your-bucket",
    "hasCredentials": true
  }
}
```

#### POST /api/get-presigned-url
Generate presigned URL for video upload

**Request:**
```json
{
  "fileName": "my-video.mp4",
  "contentType": "video/mp4"
}
```

**Response:**
```json
{
  "success": true,
  "presignedUrl": "https://bucket.s3.region.amazonaws.com/...",
  "key": "videos/1234567890-my-video.mp4",
  "expiresIn": 300,
  "bucket": "your-bucket",
  "region": "us-east-1"
}
```

#### GET /api/test-connection
Test AWS connection

**Response:**
```json
{
  "success": true,
  "message": "AWS connection successful",
  "config": {
    "region": "us-east-1",
    "bucket": "your-bucket"
  }
}
```

## 📝 Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | Yes | AWS access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS secret | `wJalrXUtnFEMI/K7MDENG/...` |
| `AWS_REGION` | Yes | S3 region | `us-east-1` |
| `AWS_BUCKET_NAME` | Yes | S3 bucket | `my-videos-bucket` |
| `PORT` | No | Server port | `3000` (default) |
| `NODE_ENV` | No | Environment | `development` or `production` |

## 🔒 Security Best Practices

### ✅ DO:
- Keep AWS credentials in backend `.env` file
- Use minimal IAM permissions (PutObject only)
- Set presigned URL expiration (5 minutes)
- Keep public access blocked on S3 bucket
- Use HTTPS for production backend
- Rotate AWS keys regularly

### ❌ DON'T:
- Never commit `.env` file to git
- Don't hardcode credentials in app
- Don't give IAM user more permissions than needed
- Don't make S3 bucket public
- Don't use `localhost` from mobile device

## 📞 Support

### Check These First:

1. **Backend running?**
   ```bash
   curl http://localhost:3000/health
   ```

2. **AWS configured?**
   ```bash
   cd backend && node test-api.js
   ```

3. **App has correct IP?**
   - Check `awsS3Service.ts` line 429
   - Use computer's network IP

4. **CORS configured?**
   - Check S3 bucket permissions
   - Add CORS configuration

### Still Having Issues?

1. Check backend terminal for error logs
2. Enable app debug logs
3. Test with `curl` directly
4. Verify AWS credentials work
5. Check firewall/network settings

## 🎉 Success Checklist

- [ ] Backend installed (`npm install`)
- [ ] `.env` file created with AWS credentials
- [ ] Backend starts without errors
- [ ] Test script passes all tests
- [ ] S3 bucket created and CORS configured
- [ ] IAM user has correct permissions
- [ ] App updated with correct backend IP
- [ ] Video uploads successfully from app
- [ ] Video appears in S3 bucket

## 🚀 Next Steps

After setup is complete:

1. **Deploy Backend:** Use Vercel/Railway for production
2. **Update App:** Change backend URL to production URL
3. **Test:** Try uploading from different devices
4. **Monitor:** Check S3 bucket for uploaded videos
5. **Optimize:** Adjust video quality/size as needed

---

**Congratulations! Your backend is now integrated with the app!** 🎉

For more help, see:
- `backend/README.md` - Backend documentation
- `backend/test-api.js` - Testing script
- `utils/awsS3Service.ts` - App integration code
