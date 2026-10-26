import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  buildNetworkPacket, 
  calculateChecksum 
} from './utils/packetEngine';
import { 
  Server, 
  Wifi, 
  Send, 
  Paperclip, 
  Copy, 
  Check, 
  Activity, 
  Terminal, 
  FileText, 
  Download, 
  ShieldCheck, 
  Users, 
  Layers,
  HardDrive,
  Sun,
  Moon
} from 'lucide-react';

// Connect to current origin in production; fallback to port 5000 in dev
const SOCKET_SERVER_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000' 
  : window.location.origin;

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('netvisualizer-theme') || 'dark');
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [socket, setSocket] = useState(null);
  const [isInRoom, setIsInRoom] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [copied, setCopied] = useState(false);

  // Network State
  const [selfInfo, setSelfInfo] = useState(null);
  const [peers, setPeers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  
  // Wireshark / Packet Visualizer State
  const [capturedPackets, setCapturedPackets] = useState([]);
  const [selectedPacket, setSelectedPacket] = useState(null);

  const chatScrollRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('netvisualizer-theme', theme);
  }, [theme]);

  useEffect(() => {
    const clockInterval = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(clockInterval);
  }, []);

  useEffect(() => {
    const s = io(SOCKET_SERVER_URL, { transports: ['websocket', 'polling'] });
    setSocket(s);

    s.on('room-joined', (data) => {
      setRoomId(data.roomId);
      setSelfInfo(data.self);
      setPeers(data.participants);
      setIsInRoom(true);

      const initPkt = buildNetworkPacket({
        srcUser: data.self,
        type: 'ARP_HANDSHAKE',
        rawPayload: `Node ${data.self.username} initialized subnet identity with ${data.self.ip}`
      });
      setCapturedPackets([initPkt]);
      setSelectedPacket(initPkt);
    });

    s.on('peer-joined', (data) => {
      setPeers(data.participants);
    });

    s.on('peer-left', (data) => {
      setPeers(data.participants);
    });

    s.on('receive-message', (data) => {
      setMessages((prev) => [...prev, { ...data, isFile: false }]);
      if (data.packetMetadata) {
        setCapturedPackets((prev) => [data.packetMetadata, ...prev]);
      }
    });

    s.on('receive-file', (data) => {
      setMessages((prev) => [...prev, { ...data, isFile: true }]);
      if (data.packetMetadata) {
        setCapturedPackets((prev) => [data.packetMetadata, ...prev]);
      }
    });

    s.on('error-msg', (msg) => {
      alert(msg);
    });

    return () => s.disconnect();
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!username.trim()) return alert("Enter your display name.");
    socket.emit('create-room', { username });
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!username.trim() || !roomId.trim()) return alert("Enter both room code and name.");
    socket.emit('join-room', { roomId, username });
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!textInput.trim() || !socket) return;

    const packet = buildNetworkPacket({
      srcUser: selfInfo,
      type: 'TCP_STREAM_MESSAGE',
      rawPayload: textInput
    });

    socket.emit('send-message', {
      roomId,
      message: textInput,
      packetMetadata: packet
    });

    setTextInput('');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("File size exceeds 15MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target.result;
      const checksum = calculateChecksum(base64Data);

      const packet = buildNetworkPacket({
        srcUser: selfInfo,
        type: 'FILE_CHUNK',
        rawPayload: `[FILE]: ${file.name} | bytes:${file.size} | hash:${checksum}`
      });

      socket.emit('send-file', {
        roomId,
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(1) + ' KB',
        fileType: file.type || 'application/octet-stream',
        fileData: base64Data,
        checksum,
        packetMetadata: packet
      });
    };
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  // 1. Landing View
  if (!isInRoom) {
    return (
      <div data-theme={theme} className="min-h-screen bg-darkbg text-slate-200 flex flex-col justify-center items-center px-4 font-sans select-none">
        <div className="w-full max-w-md bg-panelbg border border-slate-800 rounded-xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4">
            <div className="p-3 bg-blue-600/20 text-blue-400 rounded-lg">
              <Server size={28} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">NetVisualizer Lab</h1>
              <p className="text-xs text-slate-400">Layer 2-7 Protocol Sandbox & Multi-Node Gateway</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2">Display Name</label>
            <input 
              type="text" 
              placeholder="e.g. Laptop_Alpha"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-darkbg border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <button 
              onClick={handleCreateRoom}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Wifi size={16} /> Create Room
            </button>

            <div className="flex flex-col gap-2">
              <input 
                type="text" 
                placeholder="6-Char Room ID"
                maxLength={6}
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                className="w-full bg-darkbg border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-center uppercase tracking-widest text-slate-200 focus:outline-none focus:border-emerald-500"
              />
              <button 
                onClick={handleJoinRoom}
                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium py-1.5 px-4 rounded-lg text-xs transition-all flex items-center justify-center gap-2"
              >
                Join Existing
              </button>
            </div>
          </div>
          <ThemeToggle className="fixed bottom-4 left-4" theme={theme} setTheme={setTheme} />
        </div>
      </div>
    );
  }

  // 2. Main 50/50 Split Screen Dashboard
  return (
    <div data-theme={theme} className="h-screen w-screen flex flex-col bg-darkbg text-slate-200 overflow-hidden font-sans">
      {/* Top Protocol Status Bar */}
      <header className="h-14 bg-panelbg border-b border-slate-800 px-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Server className="text-blue-500" size={20} />
            <span className="font-bold text-sm tracking-wide text-white">NET-ENGINE CONSOLE</span>
          </div>
          <div className="flex items-center bg-darkbg px-3 py-1 rounded border border-slate-800 gap-3">
            <span className="text-xs text-slate-400">ROOM ID:</span>
            <span className="font-mono text-xs font-bold text-emerald-400">{roomId}</span>
            <button onClick={copyRoomCode} className="text-slate-400 hover:text-white transition-colors">
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {selfInfo && (
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="hidden sm:block text-slate-400">LOCAL TIME: <time className="text-slate-200">{currentTime.toLocaleTimeString()}</time></div>
            <div className="hidden md:flex px-2.5 py-1 bg-blue-950/60 border border-blue-800 text-blue-300 rounded items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>HOST: {selfInfo.username}</span>
            </div>
            <div className="hidden lg:block text-slate-400">IP: <span className="text-slate-200">{selfInfo.ip}</span></div>
            <div className="hidden lg:block text-slate-400">MAC: <span className="text-slate-200">{selfInfo.mac}</span></div>
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>
        )}
      </header>

      {/* 50/50 Main Split */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT HALF: Real-Time Communication & File Transfer */}
        <section className="w-1/2 flex flex-col border-r border-slate-800 bg-darkbg">
          
          {/* Active Nodes / Participants */}
          <div className="p-3 bg-panelbg border-b border-slate-800 flex items-center gap-3 overflow-x-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold px-2 border-r border-slate-700">
              <Users size={14} /> NODES ({peers.length}):
            </div>
            <div className="flex gap-2">
              {peers.map((peer) => (
                <div key={peer.socketId} className="flex items-center gap-2 bg-darkbg border border-slate-800 px-2.5 py-1 rounded-md text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="font-medium text-slate-200">{peer.username}</span>
                  <span className="font-mono text-[10px] text-slate-500">({peer.ip})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Messages & Transfers Viewport */}
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                <Terminal size={36} />
                <p className="text-sm">Link established. Send packets or drop files to inspect stream.</p>
              </div>
            ) : (
              messages.map((m, idx) => (
                <div key={idx} className="bg-panelbg border border-slate-800/80 rounded-lg p-3 max-w-[85%] text-sm">
                  <div className="flex items-center justify-between gap-4 mb-1 text-[11px] border-b border-slate-800 pb-1">
                    <span className="font-bold text-blue-400">{m.sender.username} ({m.sender.ip})</span>
                    <span className="font-mono text-slate-500">{m.timestamp}</span>
                  </div>

                  {!m.isFile ? (
                    <p className="text-slate-200 mt-1 whitespace-pre-wrap leading-relaxed">{m.message}</p>
                  ) : (
                    <div className="mt-2 bg-darkbg p-2.5 rounded border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <FileText className="text-emerald-400" size={24} />
                        <div>
                          <p className="font-medium text-xs text-slate-200">{m.fileName}</p>
                          <p className="text-[10px] text-slate-500 font-mono">Size: {m.fileSize} | Adler32: {m.checksum}</p>
                        </div>
                      </div>
                      <a 
                        href={m.fileData} 
                        download={m.fileName}
                        className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 p-2 rounded transition-all"
                        title="Download Verified File"
                      >
                        <Download size={16} />
                      </a>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Transmission Input Controls */}
          <form onSubmit={sendMessage} className="p-3 bg-panelbg border-t border-slate-800 flex items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
            />
            <button 
              type="button" 
              onClick={() => fileInputRef.current.click()}
              className="p-2.5 text-slate-400 hover:text-white bg-darkbg border border-slate-800 hover:border-slate-700 rounded-lg transition-colors"
              title="Transmit binary file payload"
            >
              <Paperclip size={18} />
            </button>
            <input 
              type="text" 
              placeholder="Inject payload / send chat message across subnet..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="flex-1 bg-darkbg border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
            <button 
              type="submit" 
              className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              <Send size={18} />
            </button>
          </form>
        </section>

        {/* RIGHT HALF: Live Network Execution & Packet Visualizer */}
        <section className="w-1/2 flex flex-col bg-consoleblack">
          
          {/* Section Heading */}
          <div className="h-10 px-4 bg-panelbg border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Activity size={15} className="text-emerald-400" /> Wireshark Frame Analyzer
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              Captured: {capturedPackets.length} Frames
            </div>
          </div>

          {/* Packet Summary Table (Top View) */}
          <div className="h-2/5 border-b border-slate-800 overflow-y-auto">
            <table className="w-full text-left font-mono text-[11px] border-collapse select-none">
              <thead className="bg-panelbg text-slate-400 sticky top-0 border-b border-slate-800">
                <tr>
                  <th className="py-1.5 px-3">No.</th>
                  <th className="py-1.5 px-3">Time</th>
                  <th className="py-1.5 px-3">Source IP</th>
                  <th className="py-1.5 px-3">Destination IP</th>
                  <th className="py-1.5 px-3">Protocol</th>
                  <th className="py-1.5 px-3">Length</th>
                  <th className="py-1.5 px-3">Info</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {capturedPackets.map((pkt) => {
                  const isSelected = selectedPacket?.frameNumber === pkt.frameNumber;
                  return (
                    <tr 
                      key={pkt.frameNumber} 
                      onClick={() => setSelectedPacket(pkt)}
                      className={`cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-blue-600/30 text-white font-semibold' 
                          : 'hover:bg-slate-800/40 text-slate-300'
                      }`}
                    >
                      <td className="py-1 px-3 text-slate-500">{pkt.frameNumber}</td>
                      <td className="py-1 px-3">{pkt.timestamp}</td>
                      <td className="py-1 px-3 text-cyan-400">{pkt.layer3.srcIP}</td>
                      <td className="py-1 px-3 text-yellow-400">{pkt.layer3.destIP}</td>
                      <td className="py-1 px-3 text-purple-400">TCP/APP</td>
                      <td className="py-1 px-3">{pkt.layer3.totalLength}</td>
                      <td className="py-1 px-3 truncate max-w-xs text-slate-400">{pkt.layer7.type} | Seq={pkt.layer4.seq}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Dissected Packet Breakdown & Hex Dump (Bottom View) */}
          <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4 font-mono text-xs">
            {selectedPacket ? (
              <>
                {/* Protocol Tree */}
                <div className="space-y-2">
                  <div className="p-2 bg-panelbg border border-slate-800 rounded">
                    <p className="text-slate-400 font-bold flex items-center gap-2">
                      <Layers size={14} className="text-blue-400" /> Frame {selectedPacket.frameNumber}: {selectedPacket.layer3.totalLength} bytes captured on interface eth0
                    </p>
                  </div>

                  {/* L2: Data Link Layer */}
                  <div className="p-2 bg-panelbg border border-slate-800 rounded">
                    <p className="text-indigo-400 font-bold mb-1">▶ Ethernet II, Src: {selectedPacket.layer2.srcMAC}, Dst: {selectedPacket.layer2.destMAC}</p>
                    <div className="pl-4 text-slate-400 text-[11px] space-y-0.5">
                      <p>Destination: {selectedPacket.layer2.destMAC} (Broadcast)</p>
                      <p>Source: {selectedPacket.layer2.srcMAC}</p>
                      <p>Type: {selectedPacket.layer2.ethertype}</p>
                    </div>
                  </div>

                  {/* L3: Network Layer */}
                  <div className="p-2 bg-panelbg border border-slate-800 rounded">
                    <p className="text-cyan-400 font-bold mb-1">▶ Internet Protocol Version 4, Src: {selectedPacket.layer3.srcIP}, Dst: {selectedPacket.layer3.destIP}</p>
                    <div className="pl-4 text-slate-400 text-[11px] grid grid-cols-2 gap-x-4">
                      <p>Header Length: {selectedPacket.layer3.headerLength}</p>
                      <p>Total Length: {selectedPacket.layer3.totalLength} bytes</p>
                      <p>TTL: {selectedPacket.layer3.ttl}</p>
                      <p>Protocol: {selectedPacket.layer3.protocol}</p>
                      <p>Checksum: {selectedPacket.layer3.headerChecksum}</p>
                    </div>
                  </div>

                  {/* L4: Transport Layer */}
                  <div className="p-2 bg-panelbg border border-slate-800 rounded">
                    <p className="text-yellow-400 font-bold mb-1">▶ Transmission Control Protocol, Src Port: {selectedPacket.layer4.srcPort}, Dst Port: {selectedPacket.layer4.destPort}</p>
                    <div className="pl-4 text-slate-400 text-[11px] grid grid-cols-2 gap-x-4">
                      <p>Sequence Number: {selectedPacket.layer4.seq}</p>
                      <p>Acknowledgment: {selectedPacket.layer4.ack}</p>
                      <p>Window Size: {selectedPacket.layer4.windowSize}</p>
                      <p>Flags: PSH={selectedPacket.layer4.flags.PSH}, ACK={selectedPacket.layer4.flags.ACK}</p>
                      <p>TCP Checksum: {selectedPacket.layer4.checksum}</p>
                    </div>
                  </div>

                  {/* L7: Application Layer & Integrity */}
                  <div className="p-2 bg-panelbg border border-slate-800 rounded">
                    <p className="text-emerald-400 font-bold mb-1">▶ Application Protocol Data Unit ({selectedPacket.layer7.type})</p>
                    <div className="pl-4 text-slate-400 text-[11px] space-y-1">
                      <p className="flex items-center gap-2">
                        <ShieldCheck size={14} className="text-emerald-400" />
                        Payload Checksum: <span className="text-slate-200">{selectedPacket.layer7.integrityHash}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Raw Hex/ASCII Packet Bytes */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span className="flex items-center gap-1"><HardDrive size={12} /> Payload Hex Dump</span>
                    <span>Offset: 0000 - 0060</span>
                  </div>
                  <pre className="p-3 bg-darkbg border border-slate-800 rounded text-slate-300 text-[11px] leading-relaxed overflow-x-auto">
                    {selectedPacket.layer7.hexDump}
                  </pre>
                </div>
              </>
            ) : (
              <div className="text-center text-slate-600 mt-10">Select a captured frame above to inspect protocol headers.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ThemeToggle({ theme, setTheme, className = '' }) {
  return (
    <div className={`${className} flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 bg-panelbg p-1 shadow-lg`} aria-label="Color theme">
      <button
        type="button"
        onClick={() => setTheme('light')}
        aria-label="Switch to light mode"
        aria-pressed={theme === 'light'}
        className={`rounded-md p-2 transition-colors ${theme === 'light' ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:text-white'}`}
      >
        <Sun size={16} />
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        aria-label="Switch to dark mode"
        aria-pressed={theme === 'dark'}
        className={`rounded-md p-2 transition-colors ${theme === 'dark' ? 'bg-slate-700 text-blue-300' : 'text-slate-400 hover:text-white'}`}
      >
        <Moon size={16} />
      </button>
    </div>
  );
}