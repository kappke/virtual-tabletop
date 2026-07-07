package websocket

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize: 1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // TODO: allow all origins for simplicity, change later
	},
}

func HandleWebsocket(w http.ResponseWriter, r *http.Request) {
	// handle websocket connection here
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, "Failed to upgrade to websocket", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	connectionLoop:
	for {
		// read message from websocket
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}

		// decode message to json
		var data map[string]any
		if err := json.Unmarshal(msg, &data); err != nil {
			break connectionLoop
		}

		eventType, ok := data["type"].(string)
		if !ok {
			// invalid message format
			response := map[string]string{"type": "error", "message": "invalid message format"}
			responseBytes, _ := json.Marshal(response)
			if err := conn.WriteMessage(websocket.TextMessage, responseBytes); err != nil {
				break connectionLoop
			}
			continue
		}

		switch eventType {
		case "ping":
			// respond with pong
			response := map[string]string{"type": "pong"}
			responseBytes, _ := json.Marshal(response)
			if err := conn.WriteMessage(websocket.TextMessage, responseBytes); err != nil {
				break connectionLoop
			}
		default:
			// unknown event type
			response := map[string]string{"type": "error", "message": "unknown event type"}
			responseBytes, _ := json.Marshal(response)
			if err := conn.WriteMessage(websocket.TextMessage, responseBytes); err != nil {
				break connectionLoop
			}
		}
	}
}
