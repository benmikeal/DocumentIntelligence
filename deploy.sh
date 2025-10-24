#!/bin/bash

# Quick deployment script for Google Cloud Run
# Usage: ./deploy.sh

set -e  # Exit on error

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-kenya-gov-docs}"
SERVICE_NAME="kenya-doc-intelligence"
REGION="africa-south1"  # Johannesburg (closest to Kenya)

echo "🚀 Deploying Kenya Document Intelligence to Google Cloud Run"
echo "=================================================="
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI not found"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker not found"
    echo "Install from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Confirm project
echo "📋 Checking Google Cloud project..."
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo "⚠️  Current project: $CURRENT_PROJECT"
    echo "Setting project to: $PROJECT_ID"
    gcloud config set project $PROJECT_ID
fi

# Build Docker image
echo ""
echo "🔨 Building Docker image..."
docker build -t gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest .

# Push to Google Container Registry
echo ""
echo "📤 Pushing to Google Container Registry..."
docker push gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest

# Deploy to Cloud Run
echo ""
echo "🌐 Deploying to Cloud Run..."
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

# Get service URL
echo ""
echo "✅ Deployment complete!"
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
echo ""
echo "🌍 Your app is live at:"
echo "$SERVICE_URL"
echo ""
echo "📊 View logs:"
echo "gcloud run services logs read ${SERVICE_NAME} --region ${REGION} --limit 50"
echo ""
echo "💰 View costs:"
echo "https://console.cloud.google.com/billing"
