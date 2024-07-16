package main

import (
    "context"
    "fmt"
    "log"
    "os"
    "path/filepath"

    "k8s.io/client-go/kubernetes"
    "k8s.io/client-go/tools/clientcmd"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    metricsv "k8s.io/metrics/pkg/client/clientset/versioned"

    // Import the Kubeflow notebook API
    notebookv1 "github.com/kubeflow/kubeflow/components/notebook-controller/api/v1"
    "k8s.io/client-go/kubernetes/scheme"
    "k8s.io/client-go/dynamic"
)

func main() {
    // Set up the kubeconfig
    kubeconfig := filepath.Join(
        homeDir(), ".kube", "config",
    )
    config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
    if err != nil {
        log.Fatalf("Error building kubeconfig: %s", err.Error())
    }

    // Create the clientset
    clientset, err := kubernetes.NewForConfig(config)
    if err != nil {
        log.Fatalf("Error creating clientset: %s", err.Error())
    }

    // Create the metrics clientset
    metricsClientset, err := metricsv.NewForConfig(config)
    if err != nil {
        log.Fatalf("Error creating metrics clientset: %s", err.Error())
    }

    // Register the notebook scheme
    notebookv1.AddToScheme(scheme.Scheme)

    // Create a dynamic client for custom resources
    dynamicClient, err := dynamic.NewForConfig(config)
    if err != nil {
        log.Fatalf("Error creating dynamic client: %s", err.Error())
    }

    // Specify the namespace
    namespace := "default" // Change this to your namespace if needed

    // Get the notebooks (using the dynamic client)
    gvr := notebookv1.GroupVersion.WithResource("notebooks")
    notebooks, err := dynamicClient.Resource(gvr).Namespace(namespace).List(context.TODO(), metav1.ListOptions{})
    if err != nil {
        log.Fatalf("Error getting notebooks: %s", err.Error())
    }

    fmt.Printf("Notebooks: %v\n", notebooks)

    // List the pods in the namespace
    pods, err := clientset.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{})
    if err != nil {
        log.Fatalf("Error listing pods: %s", err.Error())
    }

    // Get the metrics for each pod
    for _, pod := range pods.Items {
        podMetrics, err := metricsClientset.MetricsV1beta1().PodMetricses(namespace).Get(context.TODO(), pod.Name, metav1.GetOptions{})
        if err != nil {
            log.Printf("Error getting metrics for pod %s: %s", pod.Name, err.Error())
            continue
        }

        fmt.Printf("Pod: %s\n", pod.Name)
        for _, container := range podMetrics.Containers {
            fmt.Printf("  Container: %s\n", container.Name)
            fmt.Printf("    CPU Usage: %s\n", container.Usage.Cpu().String())
            fmt.Printf("    Memory Usage: %s\n", container.Usage.Memory().String())
        }
    }
}

// homeDir returns the home directory for the current user
func homeDir() string {
    if h := os.Getenv("HOME"); h != "" {
        return h
    }
    return os.Getenv("USERPROFILE") // windows
}

