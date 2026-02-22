/* ═══════════════════════════════════════════
   ROOM CLEANUP — roomCleanup.js
   Idle room expiry to prevent memory leaks
   ═══════════════════════════════════════════ */

/**
 * Start periodic cleanup of idle rooms.
 * @param {Map} rooms - The gameEngine.rooms Map
 * @param {function(string)} deleteRoom - gameEngine.deleteRoom
 * @param {number} idleMinutes - Delete rooms idle longer than this (default 30)
 * @param {number} intervalMs - Run cleanup every this many ms (default 5 min)
 */
function startRoomCleanup(rooms, deleteRoom, idleMinutes = 30, intervalMs = 5 * 60 * 1000) {
  setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
      const idleMins = (now - room.lastActivityAt) / 60000;
      if (idleMins > idleMinutes) {
        deleteRoom(roomId);
        console.log(`[Cleanup] Deleted idle room: ${roomId} (idle ${Math.floor(idleMins)}m)`);
      }
    }
  }, intervalMs);
  console.log(`[Cleanup] Started: idle rooms removed after ${idleMinutes}m, check every ${intervalMs / 60000}m`);
}

module.exports = { startRoomCleanup };
