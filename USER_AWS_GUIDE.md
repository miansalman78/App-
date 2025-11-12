# 📱 User AWS Configuration Guide

## For Play Store Users

This app allows each user to upload videos to **their own AWS S3 bucket**. You don't need to use the developer's AWS account - you can use your own!

---

## 🎯 Two Ways to Upload

### Option 1: Using Your Backend (Recommended ⭐)
**More Secure** - AWS credentials stay on your server

1. Set up a backend server with your AWS credentials
2. Enter your backend URL in the app
3. App requests presigned URLs from your backend
4. Upload happens securely

### Option 2: Direct AWS Credentials
**Quick Setup** - But credentials stored on phone

1. Enter AWS credentials directly in app
2. App generates presigned URLs on device
3. Upload directly to your S3 bucket

---

## 🚀 Step-by-Step Setup

### **Step 1: Open AWS Settings**

1. Open the app
2. Go to any video
3. Click **"Configure AWS Settings"** button (blue button)

### **Step 2: Choose Upload Method**

#### **Using Backend (Recommended)**
1. Toggle **"Use Backend Server"** ON
2. Enter your backend URL: `http://YOUR_IP:3000`
3. Click **"Test Connection"** to verify
4. Click **"Save Settings"**

#### **Direct Credentials**
1. Toggle **"Use Backend Server"** OFF
2. Enter your AWS details:
   - Access Key ID
   - Secret Access Key
   - Region (e.g., `us-east-1`)
   - Bucket Name
3. Click **"Save Settings"**

### **Step 3: Upload Videos**

1. Record or select a video
2. Enable **"Flag for AWS Upload"** toggle
3. Click **"Upload to AWS"** button
4. Video uploads to YOUR AWS bucket! ✅

---

## 🔧 Backend Setup (For Option 1)

### **Quick Start**

```bash
# 1. Create a folder for backend
mkdir teleprompter-backend
cd teleprompter-backend

# 2. Download server.js from:
# https://github.com/your-repo/backend/server.js

# 3. Install dependencies
npm install express cors @aws-sdk/client-s3 @aws-sdk/s3-request-presigner dotenv

# 4. Create .env file
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your-bucket-name
PORT=3000

# 5. Start server
node server.js
```

### **Find Your Computer IP**

**Windows:**
```bash
ipconfig
# Look for "IPv4 Address"
```

**Mac/Linux:**
```bash
ifconfig
# Look for "inet"
```

**Example:** If your IP is `192.168.1.100`, use:
```
http://192.168.1.100:3000
```

---

## 🌐 AWS Setup Guide

### **1. Create S3 Bucket**

1. Go to [AWS S3 Console](https://s3.console.aws.amazon.com/)
2. Click **"Create bucket"**
3. Enter bucket name (e.g., `my-video-uploads`)
4. Select region (e.g., `us-east-1`)
5. **Block all public access** (keep enabled for security)
6. Click **"Create bucket"**

### **2. Configure CORS (Required)**

1. Open your bucket
2. Go to **Permissions** tab
3. Scroll to **CORS configuration**
4. Click **Edit** and paste:

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

5. Click **"Save changes"**

### **3. Create IAM User**

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Click **Users** → **Create user**
3. Username: `teleprompter-app`
4. Click **Next**
5. **Attach policies directly**
6. Select: `AmazonS3FullAccess` (or custom policy below)
7. Click **Next** → **Create user**

### **4. Create Access Key**

1. Click on your new user
2. Go to **Security credentials** tab
3. Click **Create access key**
4. Choose: **"Application running outside AWS"**
5. Click **Next** → **Create access key**
6. **Copy** Access Key ID and Secret Access Key
7. Enter them in the app!

### **5. Custom IAM Policy (More Secure)**

Instead of full S3 access, use this minimal policy:

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
            "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
        }
    ]
}
```

Replace `YOUR-BUCKET-NAME` with your actual bucket name.

---

## 📱 App Usage

### **First Time Setup**

1. Open app
2. Go to video preview
3. Click **"Configure AWS Settings"**
4. Choose method and enter details
5. Click **"Save Settings"**

### **Uploading Videos**

1. Record/select video
2. Toggle **"Flag for AWS Upload"** ON
3. Click **"Upload to AWS"**
4. Wait for upload to complete
5. Video is now in YOUR S3 bucket! 🎉

### **Changing Settings**

- Click **"Configure AWS Settings"** anytime
- Update credentials or backend URL
- Click **"Save Settings"**

---

## 🔒 Security Best Practices

### ✅ **DO:**
- Use backend server (more secure)
- Rotate AWS access keys regularly
- Use minimal IAM permissions
- Keep credentials private
- Use HTTPS for backend in production

### ❌ **DON'T:**
- Share your AWS credentials
- Use root AWS account keys
- Grant unnecessary S3 permissions
- Hardcode credentials in code
- Commit `.env` file to git

---

## 🐛 Troubleshooting

### **Backend Connection Failed**

**Problem:** Can't connect to backend

**Solutions:**
1. Make sure backend server is running
2. Check backend URL is correct
3. Phone must be on same WiFi as computer
4. Try computer's IP instead of `localhost`
5. Check firewall isn't blocking port 3000

### **Upload Failed (403 Error)**

**Problem:** AWS returns "Forbidden"

**Solutions:**
1. Check AWS credentials are correct
2. Verify IAM user has S3 PutObject permission
3. Ensure bucket name is correct
4. Check CORS configuration on bucket
5. Verify bucket region matches settings

### **Upload Failed (Network Error)**

**Problem:** Can't reach AWS S3

**Solutions:**
1. Check internet connection
2. Verify bucket exists
3. Check bucket region
4. Try different network (disable VPN)

### **Settings Not Saving**

**Problem:** Credentials disappear

**Solutions:**
1. Grant app storage permissions
2. Don't clear app data/cache
3. Re-enter and save again

---

## 💡 Tips

1. **Test First**: Use "Test Connection" before uploading
2. **Backend Recommended**: More secure than direct credentials
3. **Same WiFi**: Backend and phone must be on same network
4. **Bucket Region**: Must match in all places
5. **Video Expiration**: Videos auto-delete after 7 days (configurable)

---

## 📞 Support

For issues:
1. Check logs in app
2. Verify AWS credentials
3. Test backend connection
4. Check S3 bucket permissions
5. Review this guide

---

## 🎓 Example Scenario

**User: Ahmed wants to use his own AWS**

1. Ahmed has AWS account
2. He creates bucket: `ahmed-videos`
3. He creates IAM user: `teleprompter`
4. He gets Access Key: `AKIA...`
5. He runs backend on his laptop
6. His laptop IP: `192.168.1.105`
7. In app, he enters: `http://192.168.1.105:3000`
8. He tests connection → ✅ Success
9. He saves settings
10. He uploads video → ✅ Goes to his bucket!

---

## ✅ Quick Checklist

Before uploading:

- [ ] AWS account created
- [ ] S3 bucket created
- [ ] CORS configured on bucket
- [ ] IAM user created
- [ ] Access keys generated
- [ ] Backend running (if using)
- [ ] Settings saved in app
- [ ] Test connection successful
- [ ] Phone on same WiFi (for backend)

---

**Ready to upload to YOUR AWS! 🚀**
