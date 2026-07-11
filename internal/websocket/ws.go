package websocket

import (
	"encoding/json"
	"net/http"
	"vtt/internal/utils"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type WebsocketEvent struct {
	Type string `json:"type"`
	Data any    `json:"data"`
}

func HandleWebsocket(w http.ResponseWriter, r *http.Request) {
	roomId := r.URL.Path[len("/ws/"):]
	if roomId == "" {
		http.Error(w, "Missing room ID", http.StatusBadRequest)
		return // stop if path missing
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, "Failed to upgrade to websocket", http.StatusInternalServerError)
		return
	}

	client := &Client{
		Id: r.RemoteAddr,
		Conn: conn,
		Send: make(chan WebsocketEvent, 256),
	}
	Manager.Join(roomId, client)

	defer func() {
		Manager.Leave(roomId, client)
		conn.Close()
	}()

	go writePump(client)
	readPump(roomId, client)
}

func writePump(client *Client) {
	for event := range client.Send {
		if err := utils.WriteWebsocketResponse(client.Conn, event.Type, event.Data); err != nil {
			logger.Error("Failed to write message to client: " + err.Error())
			break
		}
	}
}

func readPump(roomId string, client *Client) {
connectionLoop:
	for {
		_, msg, err := client.Conn.ReadMessage()
		if err != nil {
			break
		}

		var event WebsocketEvent
		if err := json.Unmarshal(msg, &event); err != nil {
			if err := utils.WriteWebsocketResponse(client.Conn, "error", "invalid message format"); err != nil {
				logger.Error("Failed to write error message to client: " + err.Error())
				break connectionLoop
			}
			continue
		}

		switch event.Type {
		case "ping":
			if err := utils.WriteWebsocketResponse(client.Conn, "pong", ""); err != nil {
				logger.Error("Failed to write pong message to client: " + err.Error())
				break connectionLoop
			}
		case "pointermove":
			Manager.Broadcast(
				roomId, 
				client.Id,
				WebsocketEvent{
					Type: "pointermove", 
					Data: map[string]any{
						"clientId": client.Id, 
						"position": event.Data,
					},
				},
			)

		default:
			if err := utils.WriteWebsocketResponse(client.Conn, "error", "unknown event type"); err != nil {
				break connectionLoop
			}
		}
	}
}

