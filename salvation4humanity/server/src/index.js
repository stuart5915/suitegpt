require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://salvation4humanity.com').split(',');

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

// Stream state
let streamState = {
  live: false,
  startedAt: null,
  ffmpeg: null,
  ws: null
};

// ── Health check ──
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', live: streamState.live });
});

// ── Stream status ──
app.get('/status', (_req, res) => {
  res.json({
    live: streamState.live,
    uptime: streamState.live
      ? Math.floor((Date.now() - streamState.startedAt) / 1000)
      : 0
  });
});

const server = http.createServer(app);

// ── WebSocket server ──
const wss = new WebSocketServer({ server, path: '/stream' });

function killStream(reason) {
  console.log(`[stream] ending: ${reason}`);
  if (streamState.ffmpeg) {
    streamState.ffmpeg.stdin.end();
    streamState.ffmpeg.kill('SIGTERM');
    streamState.ffmpeg = null;
  }
  streamState.live = false;
  streamState.startedAt = null;
  streamState.ws = null;
}

function spawnFFmpeg(ytKey, twKey) {
  const outputs = [];
  if (ytKey) outputs.push(`[f=flv]rtmp://a.rtmp.youtube.com/live2/${ytKey}`);
  if (twKey) outputs.push(`[f=flv]rtmp://live.twitch.tv/app/${twKey}`);

  if (outputs.length === 0) {
    console.error('[ffmpeg] no stream keys provided');
    return null;
  }

  const teeOutput = outputs.join('|');

  const args = [
    '-f', 'webm',
    '-i', 'pipe:0',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-b:v', '2500k',
    '-maxrate', '2500k',
    '-bufsize', '5000k',
    '-pix_fmt', 'yuv420p',
    '-g', '60',
    '-keyint_min', '60',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-f', 'tee',
    '-map', '0:v',
    '-map', '0:a',
    teeOutput
  ];

  console.log('[ffmpeg] spawning with', outputs.length, 'output(s)');
  const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });

  proc.stdout.on('data', d => console.log('[ffmpeg stdout]', d.toString()));
  proc.stderr.on('data', d => {
    const line = d.toString().trim();
    // Only log non-progress lines to reduce noise
    if (!line.startsWith('frame=') && line.length > 0) {
      console.log('[ffmpeg]', line);
    }
  });

  proc.on('close', code => {
    console.log(`[ffmpeg] exited with code ${code}`);
    if (streamState.live) {
      killStream('ffmpeg exited');
      if (streamState.ws && streamState.ws.readyState === 1) {
        streamState.ws.send(JSON.stringify({ type: 'error', message: 'FFmpeg process ended unexpectedly' }));
      }
    }
  });

  proc.on('error', err => {
    console.error('[ffmpeg] spawn error:', err.message);
    killStream('ffmpeg error');
  });

  return proc;
}

wss.on('connection', (ws, req) => {
  // Check origin
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    console.log(`[ws] rejected origin: ${origin}`);
    ws.close(4003, 'Origin not allowed');
    return;
  }

  console.log('[ws] client connected');

  ws.on('message', (data, isBinary) => {
    // JSON control messages
    if (!isBinary) {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'start') {
          if (streamState.live) {
            ws.send(JSON.stringify({ type: 'error', message: 'Stream already active' }));
            return;
          }

          const ytKey = msg.youtubeKey || process.env.YOUTUBE_RTMP_KEY;
          const twKey = msg.twitchKey || process.env.TWITCH_RTMP_KEY;

          const ffmpeg = spawnFFmpeg(ytKey, twKey);
          if (!ffmpeg) {
            ws.send(JSON.stringify({ type: 'error', message: 'No stream keys configured' }));
            return;
          }

          streamState.ffmpeg = ffmpeg;
          streamState.live = true;
          streamState.startedAt = Date.now();
          streamState.ws = ws;

          ws.send(JSON.stringify({ type: 'started' }));
          console.log('[stream] live');
        }

        if (msg.type === 'stop') {
          killStream('client requested stop');
          ws.send(JSON.stringify({ type: 'stopped' }));
        }
      } catch (e) {
        console.error('[ws] bad JSON:', e.message);
      }
      return;
    }

    // Binary data → pipe to FFmpeg
    if (streamState.live && streamState.ffmpeg && streamState.ffmpeg.stdin.writable) {
      streamState.ffmpeg.stdin.write(Buffer.from(data));
    }
  });

  ws.on('close', () => {
    console.log('[ws] client disconnected');
    if (streamState.ws === ws && streamState.live) {
      killStream('client disconnected');
    }
  });

  ws.on('error', err => {
    console.error('[ws] error:', err.message);
  });
});

server.listen(PORT, () => {
  console.log(`[s4h-relay] listening on port ${PORT}`);
});
