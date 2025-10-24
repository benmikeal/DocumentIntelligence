# Google Cloud Run Deployment Guide

## 📋 Prerequisites

1. **Google Cloud Account**
   - Sign up at https://cloud.google.com
   - Free tier: $300 credit for 90 days
   - After free tier: Pay-as-you-go

2. **Install Google Cloud CLI**
   ```bash
   # macOS
   brew install google-cloud-sdk

   # Or download from: https://cloud.google.com/sdk/docs/install
   ```

3. **Docker Desktop** (for local testing)
   - Download from https://www.docker.com/products/docker-desktop

## 🚀 Deployment Steps

### Step 1: Setup Google Cloud Project

```bash
# Login to Google Cloud
gcloud auth login

# Create a new project (or use existing)
gcloud projects create kenya-gov-docs --name="Kenya Document Intelligence"

# Set as active project
gcloud config set project kenya-gov-docs

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### Step 2: Configure Docker for Google Cloud

```bash
# Configure Docker to use gcloud as credential helper
gcloud auth configure-docker
```

### Step 3: Build and Push Docker Image

```bash
# Set your project ID
export PROJECT_ID=kenya-gov-docs
export SERVICE_NAME=kenya-doc-intelligence
export REGION=africa-south1  # Johannesburg (closest to Kenya)

# Build the Docker image
docker build -t gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest .

# Push to Google Container Registry
docker push gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest
```

### Step 4: Deploy to Cloud Run

```bash
# Deploy with optimized settings for your app
gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --min-instances 0 \
  --port 3000 \
  --set-env-vars NODE_ENV=production

# Your app will be live at: https://kenya-doc-intelligence-<random-id>.a.run.app
```

## 🔧 Configuration Explained

| Setting | Value | Why |
|---------|-------|-----|
| **Memory** | 1Gi | Embeddings (~200MB) + Next.js (~100MB) + headroom |
| **CPU** | 1 | Sufficient for cosine similarity calculations |
| **Timeout** | 300s | First search loads model (5-10s), subsequent searches are fast |
| **Max Instances** | 10 | Handle traffic spikes (scales automatically) |
| **Min Instances** | 0 | Save money when idle (cold start ~10s first time) |
| **Region** | africa-south1 | Closest to Kenya for low latency |

## 💰 Cost Estimate (Light Traffic)

**Assumptions:**
- 100 searches/day
- Average search: 50ms after first load
- Monthly uptime: ~1 hour/day

**Breakdown:**
- **Requests:** 3,000/month × $0.40/million = ~$0.001
- **CPU:** 1 vCPU × 1 hour × 30 days × $0.00002400/vCPU-second = ~$2.59
- **Memory:** 1GB × 1 hour × 30 days × $0.00000250/GB-second = ~$0.27
- **Network:** ~5GB/month = ~$0.60

**Total:** ~$3-5/month

**Heavy Traffic (1,000 searches/day):**
- Scales to multiple instances
- Estimate: $15-30/month

## 🔄 Update Deployment

```bash
# After code changes, rebuild and redeploy
docker build -t gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest .
docker push gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest

gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest \
  --region ${REGION}
```

## ⚡ Performance Optimization

### Keep Instance Warm (Reduce Cold Starts)

```bash
# Set minimum instances to 1 (costs ~$10/month but eliminates cold starts)
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --min-instances 1
```

### Use Cloud Scheduler for Warming

```bash
# Enable scheduler API
gcloud services enable cloudscheduler.googleapis.com

# Create a job to ping your service every 5 minutes
gcloud scheduler jobs create http warm-kenya-docs \
  --schedule="*/5 * * * *" \
  --uri="https://kenya-doc-intelligence-<your-id>.a.run.app/api/corpus/stats" \
  --http-method=GET \
  --location=${REGION}
```

## 🌐 Custom Domain Setup

```bash
# Map custom domain
gcloud run domain-mappings create \
  --service ${SERVICE_NAME} \
  --domain docs.yourdomain.ke \
  --region ${REGION}

# Follow DNS instructions to point your domain
```

## 📊 Monitoring

```bash
# View logs
gcloud run services logs read ${SERVICE_NAME} --region ${REGION} --limit 50

# View metrics in Cloud Console
open "https://console.cloud.google.com/run/detail/${REGION}/${SERVICE_NAME}/metrics"
```

## 🔒 Security Best Practices

### Add Authentication (For Premium Tier)

```bash
# Deploy with authentication required
gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest \
  --region ${REGION} \
  --no-allow-unauthenticated

# Add IAM policy for specific users
gcloud run services add-iam-policy-binding ${SERVICE_NAME} \
  --region=${REGION} \
  --member="user:government.user@example.com" \
  --role="roles/run.invoker"
```

## 🧪 Local Docker Testing

```bash
# Build locally
docker build -t kenya-docs:local .

# Run locally
docker run -p 3000:3000 -e NODE_ENV=production kenya-docs:local

# Test at http://localhost:3000
```

## 🛠️ Troubleshooting

### Issue: Container fails to start

```bash
# Check build logs
docker build -t test . --progress=plain

# Check Cloud Run logs
gcloud run services logs read ${SERVICE_NAME} --region ${REGION}
```

### Issue: Out of memory

```bash
# Increase memory to 2Gi
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --memory 2Gi
```

### Issue: Slow first search

**Expected:** First search takes 5-10 seconds (model loading)
**Solution:** Use min-instances=1 or Cloud Scheduler warming

## 📝 Environment Variables

```bash
# Add environment variables
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --set-env-vars "API_KEY=your-secret-key,DATABASE_URL=your-db-url"
```

## 🎯 Production Checklist

- [ ] Custom domain configured
- [ ] SSL certificate active (automatic with Cloud Run)
- [ ] Monitoring and alerts setup
- [ ] Backups configured for SQLite database
- [ ] Authentication enabled for premium features
- [ ] Cost alerts configured
- [ ] Documentation updated

## 🚨 Quick Rollback

```bash
# List revisions
gcloud run revisions list --service ${SERVICE_NAME} --region ${REGION}

# Rollback to previous revision
gcloud run services update-traffic ${SERVICE_NAME} \
  --region ${REGION} \
  --to-revisions REVISION-NAME=100
```

---

## 🇰🇪 Kenya-Specific Recommendations

**Region:** Use `africa-south1` (Johannesburg)
- Latency to Nairobi: ~25-40ms
- vs. `europe-west1`: ~150-200ms

**Compliance:**
- Data stays in Africa region
- Meets Kenya Data Protection Act requirements
- Google Cloud ISO 27001 certified

**Cost Optimization:**
- Start with min-instances=0 (cheapest)
- Scale to min-instances=1 when demonstrating to government
- Use committed use discounts for production

---

**Questions?** Check Cloud Run docs: https://cloud.google.com/run/docs
