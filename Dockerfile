# ═══════════════════════════════════════════════════════════════
#  klipio.io — Cloudways VPS Dockerfile
#
#  This image runs on the Cloudways VPS and provides:
#    - yt-dlp (latest) for video extraction
#    - FFmpeg + FFprobe for media processing
#    - Python 3.11 runtime for yt-dlp
#    - Node.js 20 for the health check endpoint
#    - SSH server for Next.js app to connect
#
#  Build:  docker build -t klipio-vps .
#  Run:    docker run -d --name klipio-vps -p 22:22 -p 3001:3001 klipio-vps
# ═══════════════════════════════════════════════════════════════

FROM ubuntu:24.04

LABEL maintainer="klipio.io <dev@klipio.io>"
LABEL description="klipio.io extraction server — yt-dlp + FFmpeg on Ubuntu 24.04"

# ── Environment ────────────────────────────────────────────────
ENV DEBIAN_FRONTEND=noninteractive \
    TZ=UTC \
    PYTHONUNBUFFERED=1 \
    NODE_ENV=production \
    YTDLP_PATH=/usr/local/bin/yt-dlp \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    FFPROBE_PATH=/usr/bin/ffprobe \
    HEALTH_PORT=3001

# ── System Dependencies ────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Core
    ca-certificates \
    curl \
    wget \
    gnupg \
    lsb-release \
    software-properties-common \
    # Python
    python3.11 \
    python3.11-venv \
    python3-pip \
    # FFmpeg + media
    ffmpeg \
    # SSH
    openssh-server \
    # Utilities
    git \
    jq \
    htop \
    vim-tiny \
    # SSL / Network
    openssl \
    libssl3 \
    # yt-dlp dependencies
    aria2 \
    # Cleanup
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# ── Node.js 20 (for health check endpoint) ─────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pm2

# ── Install yt-dlp (latest stable) ─────────────────────────────
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && yt-dlp --version

# ── Install yt-dlp dependencies ────────────────────────────────
RUN pip3 install --no-cache-dir --break-system-packages \
    brotli \
    certifi \
    mutagen \
    pycryptodomex \
    websockets \
    requests \
    urllib3

# ── Create application user ────────────────────────────────────
RUN useradd -m -s /bin/bash -u 1000 klipio \
    && mkdir -p /home/klipio/.ssh /home/klipio/downloads /home/klipio/logs \
    && chown -R klipio:klipio /home/klipio

# ── SSH Configuration ──────────────────────────────────────────
RUN mkdir -p /var/run/sshd \
    && echo 'Port 22' >> /etc/ssh/sshd_config \
    && echo 'PermitRootLogin no' >> /etc/ssh/sshd_config \
    && echo 'PasswordAuthentication no' >> /etc/ssh/sshd_config \
    && echo 'PubkeyAuthentication yes' >> /etc/ssh/sshd_config \
    && echo 'AuthorizedKeysFile .ssh/authorized_keys' >> /etc/ssh/sshd_config \
    && echo 'AllowUsers klipio' >> /etc/ssh/sshd_config \
    && echo 'ClientAliveInterval 60' >> /etc/ssh/sshd_config \
    && echo 'ClientAliveCountMax 3' >> /etc/ssh/sshd_config \
    && echo 'MaxSessions 50' >> /etc/ssh/sshd_config \
    && echo 'LoginGraceTime 30' >> /etc/ssh/sshd_config

# Public key will be mounted at runtime via docker-compose or secret
RUN touch /home/klipio/.ssh/authorized_keys \
    && chown klipio:klipio /home/klipio/.ssh/authorized_keys \
    && chmod 600 /home/klipio/.ssh/authorized_keys

# ── Health Check Endpoint ──────────────────────────────────────
WORKDIR /app

COPY <<'EOF' /app/health-server.js
/**
 * Lightweight health check server for the VPS.
 * The Next.js app polls this to verify yt-dlp + FFmpeg availability.
 */
const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const PORT = process.env.HEALTH_PORT || 3001;

const YTDLP_PATH = process.env.YTDLP_PATH || '/usr/local/bin/yt-dlp';
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH || '/usr/bin/ffprobe';

async function checkYtDlp() {
  try {
    const { stdout } = await execAsync(`${YTDLP_PATH} --version`, { timeout: 10000 });
    return { ok: true, version: stdout.trim() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function checkFFmpeg() {
  try {
    const { stdout } = await execAsync(`${FFMPEG_PATH} -version | head -1`, { timeout: 10000 });
    return { ok: true, version: stdout.trim() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function checkFFprobe() {
  try {
    const { stdout } = await execAsync(`${FFPROBE_PATH} -version | head -1`, { timeout: 10000 });
    return { ok: true, version: stdout.trim() };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function getDiskUsage() {
  try {
    const { stdout } = await execAsync('df -h /tmp | tail -1', { timeout: 5000 });
    const parts = stdout.trim().split(/\s+/);
    return {
      total: parts[1],
      used: parts[2],
      available: parts[3],
      percentUsed: parts[4],
    };
  } catch {
    return null;
  }
}

async function getMemoryUsage() {
  try {
    const { stdout } = await execAsync('free -m | grep Mem:', { timeout: 5000 });
    const parts = stdout.trim().split(/\s+/);
    return {
      total: parseInt(parts[1]),
      used: parseInt(parts[2]),
      free: parseInt(parts[3]),
    };
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const start = Date.now();

  if (req.url === '/health') {
    const [ytDlp, ffmpeg, ffprobe, disk, memory] = await Promise.all([
      checkYtDlp(),
      checkFFmpeg(),
      checkFFprobe(),
      getDiskUsage(),
      getMemoryUsage(),
    ]);

    const overall = ytDlp.ok && ffmpeg.ok && ffprobe.ok;

    res.writeHead(overall ? 200 : 503);
    res.end(JSON.stringify({
      status: overall ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTimeMs: Date.now() - start,
      services: { ytDlp, ffmpeg, ffprobe },
      system: { disk, memory },
    }, null, 2));
    return;
  }

  if (req.url === '/ready') {
    // Lightweight readiness check
    res.writeHead(200);
    res.end(JSON.stringify({ ready: true, timestamp: new Date().toISOString() }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[klipio-vps] Health server listening on port ${PORT}`);
  console.log(`[klipio-vps] yt-dlp: ${YTDLP_PATH}`);
  console.log(`[klipio-vps] FFmpeg: ${FFMPEG_PATH}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[klipio-vps] SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[klipio-vps] SIGINT received, shutting down...');
  server.close(() => process.exit(0));
});
EOF

# ── Startup Script ─────────────────────────────────────────────
COPY <<'EOF' /app/start.sh
#!/bin/bash
set -e

echo "=========================================="
echo "  klipio.io Extraction Server"
echo "  Starting up..."
echo "=========================================="

# Start SSH server
echo "[1/3] Starting SSH server..."
/usr/sbin/sshd -D &
SSH_PID=$!
echo "      SSH server started (PID: $SSH_PID)"

# Verify yt-dlp
echo "[2/3] Verifying yt-dlp..."
yt-dlp --version
echo "      yt-dlp OK"

# Verify FFmpeg
echo "[3/3] Verifying FFmpeg..."
ffmpeg -version | head -1
echo "      FFmpeg OK"

# Start health check server
echo "=========================================="
echo "  Starting health check server on port ${HEALTH_PORT}..."
echo "=========================================="
exec node /app/health-server.js
EOF

RUN chmod +x /app/start.sh

# ── Expose Ports ───────────────────────────────────────────────
EXPOSE 22 3001

# ── Health Check ───────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${HEALTH_PORT}/health || exit 1

# ── Run ────────────────────────────────────────────────────────
USER root
CMD ["/app/start.sh"]
