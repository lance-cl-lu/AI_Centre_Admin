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
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/metrics/pkg/client/clientset/versioned"
)

// macro to define cpu and memory threshold
const (
	cpuThreshold    = 1
	memoryThreshold = 100
)

// string array to store the profile list
var profileNames = make([]string, 0) // Renamed to avoid confusion

type Notebooks struct {
	notebookNamespace string
	notebookName      string
	time              time.Time
	cpuUsage          int64
	memoryUsage       int64
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
	// Create a map to track items in slice2 for quick lookup
	slice2Map := make(map[string]Notebooks)
	for _, item := range slice2 {
		key := item.notebookName + item.notebookNamespace
		slice2Map[key] = item
	}

	// Remove items from slice that are not in slice2
	var updatedSlice []Notebooks
	for _, item := range slice {
		key := item.notebookName + item.notebookNamespace
		if _, exists := slice2Map[key]; exists {
			updatedSlice = append(updatedSlice, item)
		}
	}

	// Add items from slice2 that are not in updatedSlice
	updatedSliceMap := make(map[string]Notebooks)
	for _, item := range updatedSlice {
		key := item.notebookName + item.notebookNamespace
		updatedSliceMap[key] = item
	}

	for _, item := range slice2 {
		key := item.notebookName + item.notebookNamespace
		if _, exists := updatedSliceMap[key]; !exists {
			updatedSlice = append(updatedSlice, item)
		}
	}

	return updatedSlice
}

// Helper function to check if a notebook is in the slice
func containsNotebook(slice []Notebooks, name string, namespace string) bool {
	for _, item := range slice {
		if item.notebookName == name && item.notebookNamespace == namespace {
			return true
		}
	}
	return false
}

// Method to compare the memory usage of the notebooks
func compairMemoryUsage(slice []Notebooks, slice2 []Notebooks) []Notebooks {
	memoryThreshold := int64(10000)
	// remove notebook list
	removeList := make([]Notebooks, 0)

	for _, item := range slice {
		for _, item2 := range slice2 {
			if item.notebookName == item2.notebookName && item.notebookNamespace == item2.notebookNamespace {
				if item2.memoryUsage < memoryThreshold {
					removeList = append(removeList, item)
					continue
				}
				item.memoryUsage = item2.memoryUsage
			}
		}
	}
	return removeList
}

// Method to compare the CPU usage of the notebooks
func compairCPUUsage(slice []Notebooks, slice2 []Notebooks) []Notebooks {
	cpuThreshold := int64(100)
	removeList := make([]Notebooks, 0)
	for _, item := range slice {
		for _, item2 := range slice2 {
			if item.notebookName == item2.notebookName && item.notebookNamespace == item2.notebookNamespace {
				if item2.cpuUsage < cpuThreshold {
					removeList = append(removeList, item)
					continue
				}
				item.cpuUsage = item2.cpuUsage
			}
		}
	}
	return removeList
}
func handleRemoveList(removeList []Notebooks, clientset *kubernetes.Clientset) {
	// shot down the notebook from the removeList

	deletePolicy := metav1.DeletePropagationForeground
	for _, item := range removeList {
		namespace := item.notebookNamespace
		podName := item.notebookName
		if err := clientset.CoreV1().Pods(namespace).Delete(context.TODO(), podName, metav1.DeleteOptions{
			PropagationPolicy: &deletePolicy,
		}); err != nil {
			log.Fatalf("Failed to delete pod: %v", err)
		}
	}

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

	// Get the profile names
	for _, item := range res.Items {
		profileName := item.GetName()
		if !contains(profileNames, profileName) {
			profileNames = append(profileNames, profileName)
		}
	}

}

func main() {
	// 使用kubeconfig建立配置
	times := 0

	for {
		kubeconfig := filepath.Join(homeDir(), ".kube", "config")
		config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
		if err != nil {
			log.Fatalf("Error building kubeconfig: %s", err)
		}

		// 建立Kubernetes客戶端
		clientset, err := kubernetes.NewForConfig(config)
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
		newlistNotebooks := make([]Notebooks, 0)
		// 輸出所有Pod的CPU和內存使用情況
		for _, podMetrics := range podMetricsList.Items {
			for _, container := range podMetrics.Containers {
				if contains(profileNames, podMetrics.Namespace) {
					notebook := Notebooks{
						notebookNamespace: podMetrics.Namespace,
						notebookName:      podMetrics.Name,
						time:              time.Now(),
						cpuUsage:          container.Usage.Cpu().MilliValue(),
						memoryUsage:       container.Usage.Memory().Value(),
					}
					newlistNotebooks = append(newlistNotebooks, notebook)
				}
			}
		}
		// update the notebook list, if in newlistNotebooks but not in listNotebooks, append to listNotebooks
		listNotebooks = updateNotebookList(listNotebooks, newlistNotebooks)
		removeList := make([]Notebooks, 0)
		//compare the memory usage of the notebooks
		removeList = compairMemoryUsage(listNotebooks, newlistNotebooks)
		//compare the CPU usage of the notebooks
		removeList = compairCPUUsage(listNotebooks, newlistNotebooks)

		// handle removeList
		handleRemoveList(removeList, clientset)
		for _, notebook := range newlistNotebooks {
			fmt.Printf("Namespace: %s, Pod: %s, Time: %s, CPU Usage: %d, Memory Usage: %d\n",
				notebook.notebookNamespace, notebook.notebookName, notebook.time, notebook.cpuUsage, notebook.memoryUsage)
		}
		fmt.Println("notebook list length: ", len(listNotebooks))
		fmt.Println("Time: ", times)
		times++
		time.Sleep(1 * time.Second)
		newlistNotebooks = make([]Notebooks, 0)
	}
}

func homeDir() string {
	if h := os.Getenv("HOME"); h != "" {
		return h
	}
	return os.Getenv("USERPROFILE") // windows
}
