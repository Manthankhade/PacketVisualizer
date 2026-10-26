import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 5e7 // 50MB maximum payload buffer
});

// Room state storage: roomId -> { clients: Map(socketId -> clientInfo), ipCounter: number }
const rooms = new Map();

function generateMAC(index) {
  const hex = (index + 10).toString(16).padStart(2, '0').toUpperCase();
  return `02:00:5E:00:01:${hex}`;
}

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('create-room', ({ username }) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    rooms.set(roomId, {
      clients: new Map(),
      ipCounter: 10
    });
    joinRoomInternal(socket, roomId, username);
  });

  socket.on('join-room', ({ roomId, username }) => {
    const targetRoom = roomId ? roomId.trim().toUpperCase() : '';
    if (!rooms.has(targetRoom)) {
      socket.emit('error-msg', 'Room ID does not exist.');
      return;
    }
    joinRoomInternal(socket, targetRoom, username);
  });

  function joinRoomInternal(sock, roomId, username) {
    currentRoom = roomId;
    sock.join(roomId);

    const roomData = rooms.get(roomId);
    const assignedIp = `192.168.1.${roomData.ipCounter}`;
    const assignedMac = generateMAC(roomData.ipCounter);
    roomData.ipCounter += 1;

    const clientObj = {
      socketId: sock.id,
      username: username || `Host_${sock.id.substring(0, 4)}`,
      ip: assignedIp,
      mac: assignedMac,
      subnet: '255.255.255.0'
    };

    roomData.clients.set(sock.id, clientObj);

    // Notify caller with assigned network identity
    sock.emit('room-joined', {
      roomId,
      self: clientObj,
      participants: Array.from(roomData.clients.values())
    });

    // Notify room peers
    sock.to(roomId).emit('peer-joined', {
      newPeer: clientObj,
      participants: Array.from(roomData.clients.values())
    });
  }

  // Handle Text Chat Frame
  socket.on('send-message', ({ roomId, message, packetMetadata }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const sender = room.clients.get(socket.id);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    io.to(roomId).emit('receive-message', {
      sender,
      message,
      timestamp,
      packetMetadata
    });
  });

  // Handle Chunked / Raw File Transfer
  socket.on('send-file', ({ roomId, fileName, fileSize, fileType, fileData, checksum, packetMetadata }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const sender = room.clients.get(socket.id);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    io.to(roomId).emit('receive-file', {
      sender,
      fileName,
      fileSize,
      fileType,
      fileData,
      checksum,
      timestamp,
      packetMetadata
    });
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      room.clients.delete(socket.id);

      if (room.clients.size === 0) {
        rooms.delete(currentRoom);
      } else {
        io.to(currentRoom).emit('peer-left', {
          socketId: socket.id,
          participants: Array.from(room.clients.values())
        });
      }
    }
  });
});

// Serve Vite React build in production
const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[NET-ENGINE] Network Collaboration Server running on port ${PORT}`);
});