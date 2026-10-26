FROM heroiclabs/nakama-pluginbuilder:3.41.0 AS builder
ENV GO111MODULE=on CGO_ENABLED=1
WORKDIR /backend
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build --trimpath --buildmode=plugin -o ./backend.so

FROM heroiclabs/nakama:3.41.0
COPY --from=builder /backend/backend.so /nakama/data/modules/