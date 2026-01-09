# Stage 1: Build the Go plugin
FROM golang:1.22.4-bullseye AS builder

ENV GO111MODULE=on
ENV CGO_ENABLED=1

WORKDIR /backend

# Copy Go module files
COPY data/modules/go.mod data/modules/go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY data/modules/*.go ./

# Build the plugin
RUN go build --trimpath --mod=readonly --buildmode=plugin -o ./backend.so

# Stage 2: Create final Nakama image
FROM heroiclabs/nakama:3.22.0

# Create the modules directory
RUN mkdir -p /nakama/data/modules

# Copy the compiled plugin from builder stage
COPY --from=builder /backend/backend.so /nakama/data/modules/backend.so

# Copy configuration
COPY data/local.yml /nakama/data/local.yml