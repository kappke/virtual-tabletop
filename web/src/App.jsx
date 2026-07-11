import { useEffect, useMemo, useRef, useState } from "react";

const WS_BASE = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/`;

const PALETTE = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

// ms between outgoing pointer broadcasts. Lower = smoother but more traffic;
// receiving-side lerp hides the gap, so ~10fps keeps bandwidth sane for many peers.
const SEND_INTERVAL_MS = 50;
// Lerp factor toward latest target per animation frame. ~0.2 = smooth catch-up.
const LERP = 0.3;
// Snap-to-target threshold to stop updating once "close enough".
const SNAP_EPS = 0.5;
// Drop peers that haven't moved in this long.
const PEER_TTL_MS = 30000;

function colorFor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export default function App() {
  const [roomInput, setRoomInput] = useState("default");
  const [room, setRoom] = useState("");
  const [status, setStatus] = useState("disconnected");
  // peersRef holds, per peer id: { x, y (rendered), tx, ty (target from ws), last (ms) }
  const peersRef = useRef({});
  const [, setFrame] = useState(0);
  const wsRef = useRef(null);
  const [fps, setFps] = useState(0);

  // Measure the tab's actual frame rate via a dedicated rAF loop.
  useEffect(() => {
    let raf;
    let frames = 0;
    let last = performance.now();
    const loop = (t) => {
      frames++;
      if (t - last >= 1000) {
        setFps(Math.round((frames * 1000) / (t - last)));
        frames = 0;
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!room) return;
    const ws = new WebSocket(`${WS_BASE}${encodeURIComponent(room)}`);
    wsRef.current = ws;

    ws.onopen = () => setStatus("connected");
    ws.onclose = () => {
      setStatus("disconnected");
      peersRef.current = {};
      setFrame((f) => f + 1);
    };
    ws.onerror = () => setStatus("error");

    ws.onmessage = (e) => {
      let evt;
      try {
        evt = JSON.parse(e.data);
      } catch {
        return;
      }
      if (evt.type === "pointermove" && evt.data) {
        const { clientId, position } = evt.data;
        if (!clientId || !position) return;
        const peers = peersRef.current;
        const p = peers[clientId] || { x: position.x, y: position.y };
        p.tx = position.x;
        p.ty = position.y;
        p.last = Date.now();
        peers[clientId] = p;
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [room]);

  // Interpolation loop — lerps rendered (x,y) toward target (tx,ty) each frame.
  // This decouples visual smoothness from how often (or how irregularly) updates arrive.
  useEffect(() => {
    let raf;
    const loop = () => {
      const peers = peersRef.current;
      let changed = false;
      for (const id of Object.keys(peers)) {
        const p = peers[id];
        const dx = (p.tx ?? p.x) - p.x;
        const dy = (p.ty ?? p.y) - p.y;
        if (Math.abs(dx) > SNAP_EPS || Math.abs(dy) > SNAP_EPS) {
          p.x += dx * LERP;
          p.y += dy * LERP;
          changed = true;
        } else if (p.x !== p.tx || p.y !== p.ty) {
          p.x = p.tx ?? p.x;
          p.y = p.ty ?? p.y;
          changed = true;
        }
      }
      if (changed) setFrame((f) => (f + 1) & 0xffff);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Garbage-collect stale peer cursors.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const peers = peersRef.current;
      let changed = false;
      for (const cid of Object.keys(peers)) {
        if (now - peers[cid].last >= PEER_TTL_MS) {
          delete peers[cid];
          changed = true;
        }
      }
      if (changed) setFrame((f) => (f + 1) & 0xffff);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Throttled broadcast of own pointer position.
  const onPointerMove = useMemo(() => {
    let pending = null;
    let lastSent = 0;
    return (e) => {
      pending = { x: e.clientX, y: e.clientY };
      const now = Date.now();
      if (now - lastSent < SEND_INTERVAL_MS) return;
      lastSent = now;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "pointermove", data: pending }));
        pending = null;
      }
    };
  }, []);

  function connect() {
    const trimmed = roomInput.trim();
    if (trimmed) setRoom(trimmed);
  }

  const peers = peersRef.current;
  const peerCount = Object.keys(peers).length;

  return (
    <div className="h-full w-full flex flex-col bg-slate-900 text-slate-100 font-sans select-none">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-slate-800">
        <h1 className="text-lg font-semibold tracking-tight">
          VTT — Live Cursors
        </h1>
        <div className="flex items-center gap-2">
          <input
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && connect()}
            disabled={status === "connected"}
            placeholder="room id"
            className="px-2 py-1 rounded bg-slate-700 border border-slate-600 text-sm focus:outline-none focus:border-slate-400 disabled:opacity-50"
          />
          <button
            onClick={connect}
            disabled={status === "connected" || !roomInput.trim()}
            className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium"
          >
            {status === "connected" ? "Connected" : "Join"}
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span
            className={`h-2.5 w-2.5 rounded-full ${status === "connected"
                ? "bg-emerald-400"
                : status === "error"
                  ? "bg-red-500"
                  : "bg-slate-500"
              }`}
          />
          <span className="text-slate-400">
            {room ? `room: ${room}` : status}
          </span>
        </div>
      </header>

      <main
        onPointerMove={onPointerMove}
        className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.15)_1px,transparent_0)] [background-size:24px_24px]"
      >
        {Object.entries(peers).map(([cid, info]) => {
          const color = colorFor(cid);
          return (
            <div
              key={cid}
              className="absolute pointer-events-none will-change-transform"
              style={{ transform: `translate(${info.x}px, ${info.y}px)` }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                className="drop-shadow"
              >
                <path
                  d="M4 2 L4 20 L9 15 L13 22 L16 21 L12 14 L19 14 Z"
                  fill={color}
                  stroke="#0f172a"
                  strokeWidth="1.2"
                />
              </svg>
            </div>
          );
        })}

        {status !== "connected" && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500">
            <p>
              {room
                ? status === "error"
                  ? "Connection error. Check the server is running on :8080."
                  : "Connecting…"
                : "Enter a room id and join to see other clients' cursors."}
            </p>
          </div>
        )}
      </main>

      <footer className="px-4 py-2 border-t border-slate-700 bg-slate-800 text-xs text-slate-400 flex items-center justify-between">
        <span>
          {peerCount} remote cursor{peerCount === 1 ? "" : "s"} active.
        </span>
        <span className="tabular-nums">{fps} fps</span>
      </footer>
    </div>
  );
}
