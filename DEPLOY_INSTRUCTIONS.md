# Complete Deployment Instructions for Google Cloud Run

Follow these instructions exactly to deploy the Kenya Government Document Intelligence System to Google Cloud Run.

## Prerequisites Check

Before starting, verify you have:
- A Google account (Gmail)
- A credit/debit card for Google Cloud (required even for free tier)
- Terminal/command line access
- Docker Desktop installed

---

## Step 1: Install Google Cloud CLI

### macOS
```bash
brew install google-cloud-sdk
```

### Linux
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

### Windows
Download from: https://cloud.google.com/sdk/docs/install

### Verify Installation
```bash
gcloud --version
```
Expected output: `Google Cloud SDK XXX.X.X`

---

## Step 2: Install Docker Desktop

### macOS
```bash
brew install --cask docker
```
Or download from: https://www.docker.com/products/docker-desktop

### Linux
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### Windows
Download from: https://www.docker.com/products/docker-desktop

### Verify Docker
```bash
docker --version
```
Expected output: `Docker version XX.X.X`

**IMPORTANT:** Open Docker Desktop application and ensure it's running (you'll see the Docker icon in your system tray)

---

## Step 3: Authenticate with Google Cloud

```bash
gcloud auth login
```

This will:
1. Open a browser window
2. Ask you to select your Google account
3. Request permission to access Google Cloud
4. Click "Allow"
5. Return to terminal when complete

---

## Step 4: Create Google Cloud Project

```bash
# Create project (choose a unique ID)
gcloud projects create kenya-gov-docs-2025 --name="Kenya Document Intelligence"

# Set as active project
gcloud config set project kenya-gov-docs-2025

# Enable billing (REQUIRED - will use free tier credits)
# You'll need to do this manually in the browser:
```

**Manual Step:**
1. Visit: https://console.cloud.google.com/billing
2. Click "Link a Billing Account"
3. Add your credit card
4. Link to `kenya-gov-docs-2025` project

**Note:** You get $300 free credit for 90 days. This app costs ~$3-5/month after that.

---

## Step 5: Enable Required Google Cloud APIs

```bash
# Enable Cloud Run
gcloud services enable run.googleapis.com

# Enable Container Registry
gcloud services enable containerregistry.googleapis.com

# Enable Cloud Build
gcloud services enable cloudbuild.googleapis.com
```

Each command will take 30-60 seconds. Wait for "Operation finished successfully" message.

---

## Step 6: Configure Docker for Google Cloud

```bash
gcloud auth configure-docker
```

When prompted with "Do you want to continue (Y/n)?", type `Y` and press Enter.

---

## Step 7: Set Environment Variables

```bash
# Set your project ID (use the same ID from Step 4)
export PROJECT_ID=kenya-gov-docs-2025

# Set service name
export SERVICE_NAME=kenya-doc-intelligence

# Set region (Johannesburg - closest to Kenya)
export REGION=africa-south1
```

**IMPORTANT:** These variables are temporary. If you close your terminal, you'll need to run these export commands again.

---

## Step 8: Navigate to Project Directory

```bash
# Replace with your actual path
cd /Users/bm/Downloads/workspace-f1f2da0f-b26b-4a8a-8d67-0996bc3182e4
```

Verify you're in the right directory:
```bash
ls -la
```

You should see:
- `Dockerfile`
- `deploy.sh`
- `package.json`
- `server.ts`
- `data/kenya_gov_corpus.json`

---

## Step 9: Build Docker Image

```bash
docker build -t gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest .
```

**Expected behavior:**
- This will take 5-10 minutes
- You'll see many lines of output
- Final line should say: `Successfully tagged gcr.io/kenya-gov-docs-2025/kenya-doc-intelligence:latest`

**If you see errors:**
- Make sure Docker Desktop is running
- Check that you're in the project directory
- Verify Dockerfile exists

---

## Step 10: Push Image to Google Container Registry

```bash
docker push gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest
```

**Expected behavior:**
- Takes 3-5 minutes
- Shows upload progress
- Final line: `latest: digest: sha256:xxxxx`

---

## Step 11: Deploy to Cloud Run

```bash
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
```

**Expected prompts:**

1. **"Allow unauthenticated invocations?"** → Type `Y` and press Enter
   (This makes your app publicly accessible)

2. Deployment will take 2-3 minutes

3. **Success message:**
   ```
   Service [kenya-doc-intelligence] revision [kenya-doc-intelligence-00001-xxx] has been deployed
   and is serving 100 percent of traffic.
   Service URL: https://kenya-doc-intelligence-xxxxx-ew.a.run.app
   ```

**SAVE THIS URL** - this is your live application!

---

## Step 12: Test Your Deployment

```bash
# Get your service URL
gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --format 'value(status.url)'
```

Copy the URL and paste it in your browser. You should see your app running!

Test a search:
1. Click "Search" tab
2. Type: "What are the investment incentives in Kenya?"
3. First search takes 5-10 seconds (model loading)
4. Subsequent searches are instant

---

## Step 13: Verify Everything Works

### Check Logs
```bash
gcloud run services logs read ${SERVICE_NAME} \
  --region ${REGION} \
  --limit 50
```

Look for:
- `> Ready on http://127.0.0.1:3000`
- `[VectorSearch] Successfully loaded 1374 chunks`
- No error messages

### Check Service Status
```bash
gcloud run services describe ${SERVICE_NAME} --region ${REGION}
```

Look for:
- `status: True` under "Ready"
- `latestReadyRevisionName` populated
- `url:` showing your live URL

---

## Cost Monitoring

### View Current Costs
```bash
# Open billing dashboard
open "https://console.cloud.google.com/billing"
```

### Set Budget Alert
```bash
# Open budget creation
open "https://console.cloud.google.com/billing/budgets"
```

Recommended settings:
- Budget amount: $10/month
- Alert threshold: 50%, 90%, 100%

---

## Updating Your Deployment

When you make code changes:

```bash
# 1. Set environment variables (if new terminal session)
export PROJECT_ID=kenya-gov-docs-2025
export SERVICE_NAME=kenya-doc-intelligence
export REGION=africa-south1

# 2. Navigate to project
cd /Users/bm/Downloads/workspace-f1f2da0f-b26b-4a8a-8d67-0996bc3182e4

# 3. Rebuild image
docker build -t gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest .

# 4. Push updated image
docker push gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest

# 5. Deploy update
gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest \
  --region ${REGION}
```

Updates take 1-2 minutes and don't cause downtime.

---

## Quick Deploy Script Alternative

Instead of Steps 9-11, you can use the automated script:

```bash
# Make script executable (first time only)
chmod +x deploy.sh

# Set environment variable
export GOOGLE_CLOUD_PROJECT=kenya-gov-docs-2025

# Run deployment
./deploy.sh
```

This does Steps 9-11 automatically.

---

## Troubleshooting

### Error: "Docker daemon not running"
**Solution:** Open Docker Desktop application

### Error: "Permission denied"
**Solution:** Run `gcloud auth login` again

### Error: "Project not found"
**Solution:**
```bash
gcloud projects list
gcloud config set project YOUR-ACTUAL-PROJECT-ID
```

### Error: "Billing account required"
**Solution:** Visit https://console.cloud.google.com/billing and link a card

### Error: "Build failed"
**Solution:**
```bash
# Check you're in project directory
pwd
# Should output: /Users/bm/Downloads/workspace-f1f2da0f-b26b-4a8a-8d67-0996bc3182e4

# Verify Dockerfile exists
ls -la Dockerfile
```

### Container crashes on startup
**Solution:**
```bash
# View detailed logs
gcloud run services logs read ${SERVICE_NAME} \
  --region ${REGION} \
  --limit 100

# Common fix: increase memory
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --memory 2Gi
```

### Slow first search (5-10 seconds)
**This is expected.** The embedding model loads on first search.

To eliminate cold starts (costs ~$10/month extra):
```bash
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --min-instances 1
```

---

## Advanced Configuration

### Add Custom Domain

1. **Verify domain ownership:**
   ```bash
   gcloud domains verify docs.yourdomain.ke
   ```

2. **Map domain:**
   ```bash
   gcloud run domain-mappings create \
     --service ${SERVICE_NAME} \
     --domain docs.yourdomain.ke \
     --region ${REGION}
   ```

3. **Add DNS records** (shown in output from step 2)

### Enable Authentication

Make app private (require login):
```bash
gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest \
  --region ${REGION} \
  --no-allow-unauthenticated

# Grant access to specific users
gcloud run services add-iam-policy-binding ${SERVICE_NAME} \
  --region=${REGION} \
  --member="user:email@example.com" \
  --role="roles/run.invoker"
```

### Add Environment Variables

```bash
gcloud run services update ${SERVICE_NAME} \
  --region ${REGION} \
  --set-env-vars "API_KEY=your-secret,DATABASE_URL=your-db"
```

---

## Deleting Everything (Clean Up)

If you want to remove everything and stop all charges:

```bash
# Delete Cloud Run service
gcloud run services delete ${SERVICE_NAME} --region ${REGION}

# Delete container images
gcloud container images delete gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest

# Delete entire project (CAREFUL - irreversible!)
gcloud projects delete ${PROJECT_ID}
```

---

## Summary - Quick Reference

**Initial deployment (Steps 1-12):**
```bash
# 1. Install tools
brew install google-cloud-sdk
brew install --cask docker

# 2. Setup Google Cloud
gcloud auth login
gcloud projects create kenya-gov-docs-2025
gcloud config set project kenya-gov-docs-2025
gcloud services enable run.googleapis.com containerregistry.googleapis.com cloudbuild.googleapis.com
gcloud auth configure-docker

# 3. Set variables
export PROJECT_ID=kenya-gov-docs-2025
export SERVICE_NAME=kenya-doc-intelligence
export REGION=africa-south1

# 4. Deploy
cd /Users/bm/Downloads/workspace-f1f2da0f-b26b-4a8a-8d67-0996bc3182e4
docker build -t gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest .
docker push gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest
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
```

**Future updates:**
```bash
export PROJECT_ID=kenya-gov-docs-2025
export SERVICE_NAME=kenya-doc-intelligence
export REGION=africa-south1
cd /Users/bm/Downloads/workspace-f1f2da0f-b26b-4a8a-8d67-0996bc3182e4
docker build -t gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest .
docker push gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest
gcloud run deploy ${SERVICE_NAME} --image gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest --region ${REGION}
```

---

## Expected Costs

**With $300 free credit (first 90 days):** $0

**After free tier:**
- Light usage (100 searches/day): $3-5/month
- Medium usage (1000 searches/day): $15-30/month
- With min-instances=1 (no cold starts): +$10/month

---

## Support Resources

- **Google Cloud Console:** https://console.cloud.google.com
- **Cloud Run Documentation:** https://cloud.google.com/run/docs
- **View your deployed app:** Check output from Step 11
- **View costs:** https://console.cloud.google.com/billing
- **View logs:** Use command from Step 12

---

**Your app will be live at:** `https://kenya-doc-intelligence-xxxxx-ew.a.run.app`

Replace `xxxxx-ew` with the actual ID shown after deployment completes.
