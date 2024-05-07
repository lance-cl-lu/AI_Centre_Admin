package main

import (
    "context"
    "fmt"
    "time"
    "k8s.io/client-go/kubernetes"
    "k8s.io/client-go/rest"
    "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func main() {
    // 使用 InClusterConfig
    times := 0
    config, err := rest.InClusterConfig()
    if err != nil {
        panic(err.Error())
    }

    clientset, err := kubernetes.NewForConfig(config)
    if err != nil {
        panic(err.Error())
    }

    for {
        pods, err := clientset.CoreV1().Pods("").List(context.TODO(), v1.ListOptions{})
        if err != nil {
            panic(err.Error())
        }
        fmt.Printf("There are %d pods in the cluster\n", len(pods.Items))

        for _, pod := range pods.Items {
            fmt.Printf("Pod name: %s\n", pod.Name)
        }

        time.Sleep(1 * time.Second)
        fmt.Printf("times: %d\n", times)
        times++
    }
}
