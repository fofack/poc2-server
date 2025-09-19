#!/usr/bin/env node

/**
 * Minimal Y.js WebSocket Server for Collaborative Editing
 * This server handles real-time synchronization for the LaTeX editor
 */

const WebSocket = require('ws');
const http = require('http');
const { setupWSConnection } = require('y-websocket/bin/utils');

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

// Create HTTP server
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Y.js WebSocket Server is running\n');
});

// Create WebSocket server
const wss = new WebSocket.Server({ 
  server,
  // Add CORS headers for development
  verifyClient: (info) => {
    console.log(`[${new Date().toISOString()}] WebSocket connection attempt from: ${info.origin}`);
    return true;
  }
});

// Track active rooms and connections
const activeRooms = new Map();
const connectionStats = {
  totalConnections: 0,
  activeConnections: 0,
  roomsCreated: 0
};

wss.on('connection', (ws, req) => {
  connectionStats.totalConnections++;
  connectionStats.activeConnections++;
  
  const url = req.url;
  const roomName = url ? url.slice(1) : 'default';
  
  console.log(`[${new Date().toISOString()}] 📝 New client connected to room: "${roomName}"`);
  console.log(`[${new Date().toISOString()}] 📊 Stats: ${connectionStats.activeConnections} active connections, ${activeRooms.size} rooms`);
  
  // Track room activity
  if (!activeRooms.has(roomName)) {
    activeRooms.set(roomName, {
      createdAt: new Date(),
      connectionCount: 0,
      lastActivity: new Date()
    });
    connectionStats.roomsCreated++;
    console.log(`[${new Date().toISOString()}] 🏠 Room "${roomName}" created`);
  }
  
  const roomData = activeRooms.get(roomName);
  roomData.connectionCount++;
  roomData.lastActivity = new Date();
  
  // Setup Y.js WebSocket connection
  setupWSConnection(ws, req, {
    // Log document updates
    gc: true, // Enable garbage collection
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    connectionStats.activeConnections--;
    
    if (activeRooms.has(roomName)) {
      const roomData = activeRooms.get(roomName);
      roomData.connectionCount--;
      
      if (roomData.connectionCount <= 0) {
        activeRooms.delete(roomName);
        console.log(`[${new Date().toISOString()}] 🏠 Room "${roomName}" closed (no active connections)`);
      }
    }
    
    console.log(`[${new Date().toISOString()}] 👋 Client disconnected from room: "${roomName}"`);
    console.log(`[${new Date().toISOString()}] 📊 Stats: ${connectionStats.activeConnections} active connections, ${activeRooms.size} rooms`);
  });
  
  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error(`[${new Date().toISOString()}] ❌ WebSocket error in room "${roomName}":`, error);
  });
});

// Enhanced error handling
wss.on('error', (error) => {
  console.error(`[${new Date().toISOString()}] ❌ WebSocket server error:`, error);
});

// Start the server
server.listen(PORT, HOST, () => {
  console.log(`[${new Date().toISOString()}] 🚀 Y.js WebSocket server running on ws://${HOST}:${PORT}`);
  console.log(`[${new Date().toISOString()}] 📡 Ready for collaborative editing sessions`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n[${new Date().toISOString()}] 🔄 Shutting down server gracefully...`);
  console.log(`[${new Date().toISOString()}] 📊 Final stats:`);
  console.log(`   - Total connections served: ${connectionStats.totalConnections}`);
  console.log(`   - Rooms created: ${connectionStats.roomsCreated}`);
  console.log(`   - Active rooms at shutdown: ${activeRooms.size}`);
  
  wss.close(() => {
    console.log(`[${new Date().toISOString()}] ✅ Server shut down successfully`);
    process.exit(0);
  });
});

// Log server stats every 5 minutes
setInterval(() => {
  if (connectionStats.activeConnections > 0 || activeRooms.size > 0) {
    console.log(`[${new Date().toISOString()}] 📊 Server status:`);
    console.log(`   - Active connections: ${connectionStats.activeConnections}`);
    console.log(`   - Active rooms: ${activeRooms.size}`);
    console.log(`   - Total connections served: ${connectionStats.totalConnections}`);
    
    // Log active rooms
    if (activeRooms.size > 0) {
      console.log(`   - Active rooms details:`);
      activeRooms.forEach((data, roomName) => {
        console.log(`     * "${roomName}": ${data.connectionCount} connections, last active ${data.lastActivity.toISOString()}`);
      });
    }
  }
}, 5 * 60 * 1000); // 5 minutes

module.exports = server;