package api

import "net/http"

func HandleAPI(w http.ResponseWriter, r *http.Request) {
	// handle REST API requests here
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Hello from the REST API!"))
}
