# Build stage
FROM golang as builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download
# copy k8s config
RUN mkdir -p /root/.kube
#COPY config /root/.kube/config
# copy the source code
COPY . .

# Build statically linked Go binary (recommended to avoid glibc issues)
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -a -installsuffix cgo -o main main.go

# Final stage with minimal image
#FROM gcr.io/distroless/static
FROM golang

WORKDIR /app

#RUN mkdir -p /root/.kube
#COPY config /root/.kube/config

COPY --from=builder /app/main .

# Expose the port (adjust as per your application)
EXPOSE 8080

# Run the Go application
CMD ["./main"]
