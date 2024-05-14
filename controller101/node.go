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

// macro to define cpu and memory threshold
const (
	cpuThreshold    = 100
	memoryThreshold = 10000
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

func containsNotebook(slice []Notebooks, val string, val2 string) bool {
	for _, item := range slice {
		if item.notebookName == val && item.notebookNamepsace == val2 {
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
		if !containsNotebook(slice2, item.notebookName, item.notebookNamepsace) {
			slice = append(slice[:i], slice[i+1:]...)
		}
	}
	// if in slice2 but not in slice, append to slice
	for _, item := range slice2 {
		if !containsNotebook(slice, item.notebookName, item.notebookNamepsace) {
			slice = append(slice, item)
		}
	}
	return slice
}

// Method to compare the memory usage of the notebooks
func compairMemoryUsage(slice []Notebooks, slice2 []Notebooks) []Notebooks {
	memoryThreshold := int64(10000)
	// remove notebook list
	removeList := make([]Notebooks, 0)

	for _, item := range slice {
		for _, item2 := range slice2 {
			if item.notebookName == item2.notebookName && item.notebookNamepsace == item2.notebookNamepsace {
				if item2.memoryUsage > memoryThreshold {
					removeList = append(removeList, item)
					continue
				}
				item.memoryUsage = item2.memoryUsage
			}
		}
	}
	return slice
}

// Method to compare the CPU usage of the notebooks
func compairCPUUsage(slice []Notebooks, slice2 []Notebooks) []Notebooks {
	cpuThreshold := int64(100)
	removeList := make([]Notebooks, 0)
	for _, item := range slice {
		for _, item2 := range slice2 {
			if item.notebookName == item2.notebookName && item.notebookNamepsace == item2.notebookNamepsace {
				if item2.cpuUsage > cpuThreshold {
					removeList = append(removeList, item)
					continue
				}
				item.cpuUsage = item2.cpuUsage
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

	// Extract the profile names from the response
	for _, item := range res.Items {
		profileNames = append(profileNames, item.GetName())
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
	// while loop

	times := 0
	for {
		updateProfileNames()
		newlistNotebooks := make([]Notebooks, 0)
		// 輸出所有Pod的CPU和內存使用情況
		for _, podMetrics := range podMetricsList.Items {
			for _, container := range podMetrics.Containers {
				fmt.Printf("Namespace: %s, Pod: %s, Container: %s, CPU Usage: %d, Memory Usage: %d\n",
					podMetrics.Namespace, podMetrics.Name, container.Name, container.Usage.Cpu().MilliValue(), container.Usage.Memory().Value())
				// add the notebook to the new list
				if contains(profileNames, podMetrics.Namespace) {
					newlistNotebooks = append(newlistNotebooks, Notebooks{notebookNamepsace: podMetrics.Namespace, notebookName: podMetrics.Name, time: time.Now(), cpuUsage: container.Usage.Cpu().MilliValue(), memoryUsage: container.Usage.Memory().Value()})
				}
			}
		}
		// update the notebook list, if in newlistNotebooks but not in listNotebooks, append to listNotebooks
		listNotebooks = updateNotebookList(listNotebooks, newlistNotebooks)

		//compare the memory usage of the notebooks
		listNotebooks = compairMemoryUsage(listNotebooks, newlistNotebooks)
		//compare the CPU usage of the notebooks
		listNotebooks = compairCPUUsage(listNotebooks, newlistNotebooks)

		// compare the memory usage of the notebooks
		for _, notebook := range listNotebooks {
			fmt.Printf("Notebook %s from user %s, CPU Usage: %d, Memory Usage: %d, Time: %s\n", notebook.notebookName, notebook.notebookNamepsace, notebook.cpuUsage, notebook.memoryUsage, notebook.time)
		}
		fmt.Println("Length of listNotebooks: ", len(listNotebooks))
		// print time and sleep
		fmt.Println("Time: ", times)
		times++

		time.Sleep(1 * time.Second)
	}
}

func homeDir() string {
	if h := os.Getenv("HOME"); h != "" {
		return h
	}
	return os.Getenv("USERPROFILE") // windows
}
