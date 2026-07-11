package utils

import (
	"encoding/json"

	"github.com/gorilla/websocket"
)

func WriteWebsocketResponse(conn *websocket.Conn, messageType string, message any) error {
	err := conn.WriteMessage(websocket.TextMessage, GetWebsocketResponse(messageType, message))
	return err
}

func GetWebsocketResponse(messageType string, message any) []byte {
	response := map[string]any{"type": messageType, "data": message}
	responseBytes, err := json.Marshal(response)
	if err != nil {
		println(err.Error())
		return []byte(`{"type":"error","data":"failed to marshal response"}`)
	}

	return responseBytes
}
