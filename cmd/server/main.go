package main

import (
	"context"
	"net/http"

	"vtt/internal/websocket"
	"vtt/internal/api"
)

func main() {
	ctx := context.Background()

	// spin up a websocket server
	http.HandleFunc("/ws", websocket.HandleWebsocket)

	// spin up a REST API server
	http.HandleFunc("/api", api.HandleAPI)

	// listen and serve with custom context
	http.ListenAndServe(":8080", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// pass the context to the request
		r = r.WithContext(ctx)
		http.DefaultServeMux.ServeHTTP(w, r)
	}))
}

