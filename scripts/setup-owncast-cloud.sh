#!/usr/bin/env bash
#
# Lepta — Cloud Owncast Setup Script
# Run this on a fresh Ubuntu 22.04+ VPS (DigitalOcean, Hetzner, Vultr, etc.)
#
# Usage:
#   ssh root@YOUR_VPS_IP 'bash -s' < scripts/setup-owncast-cloud.sh
#
# Or copy to the server and run:
#   scp scripts/setup-owncast-cloud.sh root@YOUR_VPS_IP:~/
#   ssh root@YOUR_VPS_IP 'chmod +x setup-owncast-cloud.sh && ./setup-owncast-cloud.sh'
#
# After setup:
#   - Owncast UI:    http://YOUR_VPS_IP:8080
#   - RTMP ingest:   rtmp://YOUR_VPS_IP:1935/live
#   - HLS output:    http://YOUR_VPS_IP:8080/hls/stream.m3u8
#   - Admin panel:   http://YOUR_VPS_IP:8080/admin (default password: abc123)
#
# Then in OBS:
#   Settings → Stream → Custom → rtmp://YOUR_VPS_IP:1935/live
#   Stream Key: abc123 (or whatever you set)
#
# Then configure webhook in Owncast admin:
#   Admin → Integrations → Webhooks → Add:
#   URL: https://lepta-eight.vercel.app/api/webhooks/owncast
#   Events: Stream Started, Stream Stopped, User Joined, User Parted, Chat
#

set -euo pipefail

OWNCAST_VERSION="0.2.5"
OWNCAST_PORT=8080
RTMP_PORT=1935
INSTALL_DIR="/opt/owncast"
LEPTA_WEBHOOK_URL="${LEPTA_WEBHOOK_URL:-https://lepta-eight.vercel.app/api/webhooks/owncast}"

echo "=== Lepta Cloud Owncast Setup ==="
echo "Owncast $OWNCAST_VERSION on $(hostname)"
echo ""

# Update system
echo "[1/6] Updating system..."
apt-get update -qq && apt-get upgrade -y -qq

# Install dependencies
echo "[2/6] Installing dependencies..."
apt-get install -y -qq curl unzip ffmpeg ufw

# Configure firewall
echo "[3/6] Configuring firewall..."
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (for reverse proxy later)
ufw allow 443/tcp   # HTTPS
ufw allow $OWNCAST_PORT/tcp   # Owncast web
ufw allow $RTMP_PORT/tcp      # RTMP ingest
ufw --force enable

# Download and install Owncast
echo "[4/6] Installing Owncast $OWNCAST_VERSION..."
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
    OWNCAST_ARCH="64bit"
elif [ "$ARCH" = "aarch64" ]; then
    OWNCAST_ARCH="arm64"
else
    echo "Unsupported architecture: $ARCH"
    exit 1
fi

curl -L "https://github.com/owncast/owncast/releases/download/v${OWNCAST_VERSION}/owncast-${OWNCAST_VERSION}-linux-${OWNCAST_ARCH}.zip" -o owncast.zip
unzip -o owncast.zip
rm owncast.zip
chmod +x owncast

# Create systemd service
echo "[5/6] Creating systemd service..."
cat > /etc/systemd/system/owncast.service << 'UNIT'
[Unit]
Description=Owncast Streaming Server (Lepta)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/owncast
ExecStart=/opt/owncast/owncast
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable owncast
systemctl start owncast

# Wait for Owncast to boot
echo "[6/6] Waiting for Owncast to start..."
sleep 3

# Verify
if curl -s http://localhost:$OWNCAST_PORT/api/status | grep -q "online"; then
    echo ""
    echo "=== Owncast is running ==="
else
    echo ""
    echo "=== Owncast started (may need a few more seconds) ==="
fi

PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_VPS_IP")

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Owncast UI:     http://$PUBLIC_IP:$OWNCAST_PORT"
echo "Admin panel:    http://$PUBLIC_IP:$OWNCAST_PORT/admin"
echo "Admin password: abc123 (CHANGE THIS in admin panel)"
echo "RTMP ingest:    rtmp://$PUBLIC_IP:$RTMP_PORT/live"
echo "HLS stream:     http://$PUBLIC_IP:$OWNCAST_PORT/hls/stream.m3u8"
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Open admin panel and change the admin password"
echo "2. Set stream key in admin → Configuration → Server Setup"
echo "3. Add webhook in admin → Integrations → Webhooks:"
echo "   URL: $LEPTA_WEBHOOK_URL"
echo "   Events: Stream Started, Stream Stopped, User Joined, User Parted, Chat"
echo ""
echo "4. In OBS:"
echo "   Settings → Stream → Service: Custom"
echo "   Server: rtmp://$PUBLIC_IP:$RTMP_PORT/live"
echo "   Stream Key: (whatever you set in step 2)"
echo ""
echo "5. Update your Lepta .env:"
echo "   OWNCAST_URL=http://$PUBLIC_IP:$OWNCAST_PORT"
echo "   NEXT_PUBLIC_OWNCAST_URL=http://$PUBLIC_IP:$OWNCAST_PORT"
echo ""
echo "6. Redeploy Vercel with the updated env vars:"
echo "   vercel env add NEXT_PUBLIC_OWNCAST_URL"
echo "   vercel --prod"
echo ""
