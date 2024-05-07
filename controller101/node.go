package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/metrics/pkg/client/clientset/versioned"
)

// string array to store the profile list
var profileNames = make([]string, 0) // Renamed to avoid confusion

type Notebooks struct {
	notebookNamepsace string
	notebookName      string
	time              time.Time
	cpuUsage          int64
	memoryUsage       int64
}

func containsNotebook(slice []Notebooks, val string) bool {
	for _, item := range slice {
		if item.notebookName == val {
			return true
		}
	}
	return false
}

func contains(slice []string, val string) bool {
	for _, item := range slice {
		if item == val {
			return true
		}
	}
	return false
}

// Method to update the notebook list
func updateNotebookList(slice []Notebooks, slice2 []Notebooks) []Notebooks {
	// if in slice but not in slice2, remove from slice
	for i, item := range slice {
		if !containsNotebook(slice2, item.notebookName) {
			slice = append(slice[:i], slice[i+1:]...)
		}
	}
	// if in slice2 but not in slice, append to slice
	for _, item := range slice2 {
		if !containsNotebook(slice, item.notebookName) {
			slice = append(slice, item)
		}
	}
	return slice
}

// Method to compare the memory usage of the notebooks
func compairMemoryUsage(slice []Notebooks, slice2 []Notebooks) []Notebooks {
	memoryThreshold := int64(10000)
	for i, item := range slice {
		for _, item2 := range slice2 {
			if item.notebookName == item2.notebookName {
				if item2.memoryUsage > memoryThreshold {
					slice[i].memoryUsage = item2.memoryUsage
				}
			}
		}
	}
	return slice
}

// Method to compare the CPU usage of the notebooks
func compairCPUUsage(slice []Notebooks, slice2 []Notebooks) []Notebooks {
	cpuThreshold := int64(100)
	for i, item := range slice {
		for _, item2 := range slice2 {
			if item.notebookName == item2.notebookName {
				if item2.cpuUsage > cpuThreshold {
					slice[i].cpuUsage = item2.cpuUsage
				}
			}
		}
	}
	return slice
}

func updateProfileNames() {
	// Load the kubeconfig file to connect to the Kubernetes cluster
	kubeconfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(clientcmd.NewDefaultClientConfigLoadingRules(), nil)
	restConfig, err := kubeconfig.ClientConfig()
	if err != nil {
		log.Fatalf("Failed to load client config: %v", err)
	}

	// Create a dynamic client
	dynamicClient, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		log.Fatalf("Failed to create dynamic client: %v", err)
	}

	// Define the GVR for Kubeflow profiles using the correct schema
	profilesGVR := schema.GroupVersionResource{
		Group:    "kubeflow.org",
		Version:  "v1",
		Resource: "profiles",
	}

	res, err := dynamicClient.Resource(profilesGVR).Namespace("").List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		log.Fatalf("Failed to list profiles: %v", err)
		return
	}

	for _, item := range res.Items {
		// if in profileNames then skip, else append to profileNames
		if contains(profileNames, item.GetName()) {
			continue
		}
		profileNames = append(profileNames, item.GetName()) // Populate global slice
	}
}

func main() {
	// 使用kubeconfig建立配置
	kubeconfig := filepath.Join(homeDir(), ".kube", "config")
	config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		log.Fatalf("Error building kubeconfig: %s", err)
	}

	// 建立Kubernetes客戶端
	//clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		log.Fatalf("Error building Kubernetes clientset: %s", err)
	}

	// 建立Metrics客戶端
	metricsClient, err := versioned.NewForConfig(config)
	if err != nil {
		log.Fatalf("Error building Metrics clientset: %s", err)
	}
	//times := 0
	listNotebooks := make([]Notebooks, 0)

	// 獲取所有Namespaces中的Pod度量信息
	podMetricsList, err := metricsClient.MetricsV1beta1().PodMetricses(metav1.NamespaceAll).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		log.Fatalf("Error fetching pod metrics: %s", err)
	}
	// sort the pods by name
	sort.Slice(podMetricsList.Items, func(i, j int) bool {
		return podMetricsList.Items[i].Name < podMetricsList.Items[j].Name
	})
	updateProfileNames()
	// 輸出所有Pod的CPU和內存使用情況
	for _, p := range podMetricsList.Items {
		for _, c := range p.Containers {
			// list related profile's containers in Namespace
			if contains(profileNames, p.Namespace) {
				// if notebook is in listNotebooks and its user is same, update the CPU and Memory usage
				for i, notebook := range listNotebooks {
					if notebook.notebookName == c.Name && notebook.notebookNamepsace == p.Namespace {
						listNotebooks[i].cpuUsage = c.Usage.Cpu().Value()
						listNotebooks[i].memoryUsage = c.Usage.Memory().Value()
					}
				}

				if containsNotebook(listNotebooks, p.Namespace) {
					continue
				} else {
					listNotebooks = append(listNotebooks, Notebooks{
						notebookNamepsace: p.Namespace,
						notebookName:      c.Name,
						time:              time.Now(),
						cpuUsage:          c.Usage.Cpu().Value(),
						memoryUsage:       c.Usage.Memory().Value(),
					})
				}
			}
		}
	}
	for _, notebook := range listNotebooks {
		fmt.Printf("Notebook %s from user %s, CPU Usage: %d, Memory Usage: %d, Time: %s\n", notebook.notebookName, notebook.notebookNamepsace, notebook.cpuUsage, notebook.memoryUsage, notebook.time)
	}
	fmt.Println("Length of listNotebooks: ", len(listNotebooks))
	time.Sleep(2 * time.Second)
}

func homeDir() string {
	if h := os.Getenv("HOME"); h != "" {
		return h
	}
	return os.Getenv("USERPROFILE") // windows
}
