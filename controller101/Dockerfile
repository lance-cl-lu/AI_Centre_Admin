# Build stage
FROM golang AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download
# copy the source code
COPY main.go .

# Build statically linked Go binary (recommended to avoid glibc issues)
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -installsuffix cgo -o main main.go

# Final stage with minimal image
#FROM gcr.io/distroless/static
FROM golang

WORKDIR /app

# 安裝開發工具（vim, curl 等）
RUN apt-get update && \
    apt-get install -y vim curl && \
    rm -rf /var/lib/apt/lists/*

#RUN mkdir -p /root/.kube
#COPY config /root/.kube/config

COPY --from=builder /app/main .

# 複製原始碼（開發時使用）
COPY main.go .

# Expose the port (adjust as per your application)
EXPOSE 8080

# 建立啟動腳本
RUN echo '#!/bin/sh\nwhile true; do\n  echo "Starting main..."\n  ./main\n  echo "main exited with code $?, restarting in 5 seconds..."\n  sleep 5\ndone' > /app/start.sh && chmod +x /app/start.sh

# Run the Go application with auto-restart
CMD ["/app/start.sh"]
