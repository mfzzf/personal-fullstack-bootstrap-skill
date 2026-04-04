// SSE handler template for Go.
//
// Copy into: internal/interfaces/http/handlers/
// Adapt the service methods and event types to your domain.

package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// Stream handles GET /api/{resource}/{id}/stream
// Replays stored events from DB, then tails for new events.
func (h *Handler) Stream(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid ID", http.StatusBadRequest)
		return
	}

	// ---- SSE headers (all four are required) ----
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // disable nginx buffering

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	ctx := r.Context()
	var lastID int64
	hasDoneEvent := false

	// 1. Replay all stored events.
	events, err := h.service.GetEvents(ctx, id)
	if err == nil {
		for _, ev := range events {
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.EventType, string(ev.Data))
			lastID = ev.ID
			if ev.EventType == "done" {
				hasDoneEvent = true
			}
		}
		flusher.Flush()
	}

	// 2. If resource is terminal, stop here.
	resource, err := h.service.Get(ctx, id)
	if err != nil || resource.IsTerminal() {
		if !hasDoneEvent {
			fmt.Fprintf(w, "event: done\ndata: {}\n\n")
			flusher.Flush()
		}
		return
	}

	// 3. Tail for new events with timeout.
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	deadline := time.After(10 * time.Minute)

	for {
		select {
		case <-ctx.Done():
			return
		case <-deadline:
			if !hasDoneEvent {
				fmt.Fprintf(w, "event: done\ndata: {}\n\n")
				flusher.Flush()
			}
			return
		case <-ticker.C:
			newEvents, err := h.service.GetEventsAfter(ctx, id, lastID)
			if err != nil {
				continue
			}
			for _, ev := range newEvents {
				fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.EventType, string(ev.Data))
				lastID = ev.ID
				if ev.EventType == "done" {
					flusher.Flush()
					return
				}
			}
			if len(newEvents) > 0 {
				flusher.Flush()
			}

			// Fallback: check resource status.
			resource, err := h.service.Get(ctx, id)
			if err != nil || resource.IsTerminal() {
				fmt.Fprintf(w, "event: done\ndata: {}\n\n")
				flusher.Flush()
				return
			}
		}
	}
}

// IMPORTANT: Set WriteTimeout on the HTTP server to >= 10 minutes:
//
//   srv := &http.Server{
//       Addr:         ":8080",
//       Handler:      router,
//       WriteTimeout: 10 * time.Minute,
//   }
