# 使用 Go 官方鏡像作為構建環境
FROM golang AS builder

# 設置工作目錄
WORKDIR /app

# 複製 Go 模塊和依賴關係清單
COPY go.mod go.sum ./

# 下載依賴
RUN go mod download

# 複製源碼到容器中
COPY node.go .

# 構建應用程序
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o node .

# 使用輕量級的鏡像
FROM alpine:latest

WORKDIR /root/

# 從構建階段複製二進制文件
COPY --from=builder /app/node .

# 運行應用程序
CMD ["./node"]
