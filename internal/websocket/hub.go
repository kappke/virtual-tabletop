package websocket

import (
	"sync"
	"vtt/internal/logging"

	"github.com/gorilla/websocket"
)

type Client struct {
	Id   string
	Conn *websocket.Conn
	Send chan WebsocketEvent
}

type Room struct {
	Clients map[*Client]bool
	Mutex   sync.RWMutex
}

type RoomManager struct {
	Rooms map[string]*Room
	Mutex sync.RWMutex
}

var Manager = &RoomManager{
	Rooms: make(map[string]*Room),
}

var logger = logging.NewLogger("RoomManager")

func (rm *RoomManager) Join(roomId string, client *Client) {
	rm.Mutex.Lock()
	room, exists := rm.Rooms[roomId]
	if !exists {
		// create new room
		logger.Info("Creating new room: " + roomId)
		room = &Room{Clients: make(map[*Client]bool)}
		rm.Rooms[roomId] = room
	}
	rm.Mutex.Unlock()

	room.Mutex.Lock()
	logger.Info("Client joined room: " + roomId)
	room.Clients[client] = true
	room.Mutex.Unlock()
}

func (rm *RoomManager) Leave(roomId string, client *Client) {
	rm.Mutex.Lock()
	room, exists := rm.Rooms[roomId]
	if !exists {
		rm.Mutex.Unlock()
		return
	}

	room.Mutex.Lock()
	logger.Info("Client left room: " + roomId)
	delete(room.Clients, client)
	close(client.Send) // Close the outbound channel
	isEmpty := len(room.Clients) == 0
	room.Mutex.Unlock()

	if isEmpty {
		logger.Info("Room is empty, deleting room: " + roomId)
		delete(rm.Rooms, roomId)
	}
	rm.Mutex.Unlock()
}

func (rm *RoomManager) Broadcast(roomId string, senderId string, event WebsocketEvent) {
	rm.Mutex.RLock()
	room, exists := rm.Rooms[roomId]
	rm.Mutex.RUnlock()

	if !exists {
		logger.Error("Attempted to broadcast to non-existent room: " + roomId)
		return
	}

	room.Mutex.RLock()
	defer room.Mutex.RUnlock()
	for client := range room.Clients {
		// Skip own client
		if senderId != "" && client.Id == senderId {
			continue
		}

		// Non-blocking send: if a client's buffer is full, skip them or drop
		select {
		case client.Send <- event:
		default:
		}
	}
}

