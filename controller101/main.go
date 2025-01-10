package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

var leastCPUUsage = 300000000

type Notebook struct {
	Name        string `json:"name"`
	Namespace   string `json:"namespace"`
	CPUUsage    string `json:"cpuUsage"`
	MemUsage    string `json:"memUsage"`
	IdleCounter int    `json:"idleCounter"`
	RemovalTag  bool
}

type PodMetricsList struct {
	Items []struct {
		Metadata struct {
			Name      string `json:"name"`
			Namespace string `json:"namespace"`
		} `json:"metadata"`
		Containers []struct {
			Name  string `json:"name"`
			Usage struct {
				CPU    string `json:"cpu"`
				Memory string `json:"memory"`
			} `json:"usage"`
		} `json:"containers"`
	} `json:"items"`
}

func main() {
	timeInterval := os.Getenv("TIMEINTERVAL")
	if timeInterval == "" {
		timeInterval = "60"
	}

	timeIntervalInt, err := strconv.Atoi(timeInterval)
	if err != nil {
		panic(err.Error())
	}
	fmt.Printf("Time interval: %d seconds\n", timeIntervalInt)

	home := os.Getenv("HOME")
	kubeconfig := home + "/.kube/config"
	config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		config, err = rest.InClusterConfig()
		if err != nil {
			panic(err.Error())
		}
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}

	ctx := context.Background()
	notebookMap := make(map[string]*Notebook) // 用 namespace+name 作為 key

	for {
		// 動態更新 Notebook 資料
		notebooksData, err := clientset.RESTClient().
			Get().
			AbsPath("/apis/kubeflow.org/v1/notebooks").
			DoRaw(ctx)
		if err != nil {
			panic(err.Error())
		}

		var notebooksResp map[string]interface{}
		if err := json.Unmarshal(notebooksData, &notebooksResp); err != nil {
			panic("Error unmarshalling JSON: " + err.Error())
		}

		for _, item := range notebooksResp["items"].([]interface{}) {
			metadata := item.(map[string]interface{})["metadata"].(map[string]interface{})
			namespace := metadata["namespace"].(string)
			name := metadata["name"].(string)
			key := namespace + "/" + name

			persistentTag := false
			if labels, ok := metadata["labels"].(map[string]interface{}); ok {
				if val, exists := labels["persistent"]; exists {
					if valStr, ok := val.(string); ok && valStr == "true" {
						persistentTag = true
					}
				}
			}

			if _, exists := notebookMap[key]; !exists {
				notebookMap[key] = &Notebook{
					Name:       name,
					Namespace:  namespace,
					RemovalTag: !persistentTag,
				}
			}
			notebookMap[key].RemovalTag = !persistentTag

		}

		// 動態更新 Pod Metrics 資料
		metricsData, err := clientset.RESTClient().
			Get().
			AbsPath("/apis/metrics.k8s.io/v1beta1").
			Resource("pods").
			DoRaw(ctx)
		if err != nil {
			panic(err.Error())
		}

		var podMetricsList PodMetricsList
		if err := json.Unmarshal(metricsData, &podMetricsList); err != nil {
			panic("Error unmarshalling JSON: " + err.Error())
		}

		for _, item := range podMetricsList.Items {
			namespace := item.Metadata.Namespace
			name := strings.Join(strings.Split(item.Metadata.Name, "-")[:len(strings.Split(item.Metadata.Name, "-"))-1], "-")
			key := namespace + "/" + name

			if notebook, exists := notebookMap[key]; exists {
				if notebook.RemovalTag == false {
					notebook.IdleCounter = 0
					continue
				}
				for _, container := range item.Containers {
					if container.Name == notebook.Name {
						cpuUsage := parseCPU(container.Usage.CPU)
						notebook.CPUUsage = container.Usage.CPU
						notebook.MemUsage = container.Usage.Memory
						if cpuUsage < leastCPUUsage {
							notebook.IdleCounter++
						} else {
							notebook.IdleCounter = 0
						}

						if notebook.IdleCounter > timeIntervalInt && notebook.RemovalTag {
							stopNotebook(clientset, notebook, ctx)
							notebook.IdleCounter = 0
						}
					}
				}
			}
		}
		// print notebookMap
		for _, notebook := range notebookMap {
			fmt.Printf("Notebook: %s, Namespace: %s, CPU Usage: %s, Mem Usage: %s, Idle Counter: %d, Removal Tag: %t\n",
				notebook.Name, notebook.Namespace, notebook.CPUUsage, notebook.MemUsage, notebook.IdleCounter, notebook.RemovalTag)
			if notebook.RemovalTag {
				fmt.Printf("Notebook %s in namespace %s is removable\n", notebook.Name, notebook.Namespace)
			}
			if notebook.IdleCounter > timeIntervalInt && notebook.RemovalTag {
				fmt.Printf("Notebook %s in namespace %s has been idle for %d seconds\n", notebook.Name, notebook.Namespace, notebook.IdleCounter)
			}
		}

		time.Sleep(time.Duration(60) * time.Second)
	}
}

func parseCPU(cpu string) int {
	cpuUsageStr := strings.TrimRight(cpu, "nmu")
	cpuUsage, err := strconv.Atoi(cpuUsageStr)
	if err != nil {
		return 0
	}
	return cpuUsage
}

func stopNotebook(clientset *kubernetes.Clientset, notebook *Notebook, ctx context.Context) {
	patchBody := map[string]interface{}{
		"metadata": map[string]interface{}{
			"annotations": map[string]interface{}{
				"kubeflow-resource-stopped": time.Now().Format("2006-01-02T15:04:05"),
			},
		},
	}

	patchBytes, err := json.Marshal(patchBody)
	if err != nil {
		panic(err.Error())
	}

	result := clientset.RESTClient().
		Patch(types.MergePatchType).
		AbsPath("/apis/kubeflow.org/v1").
		Resource("notebooks").
		Namespace(notebook.Namespace).
		Name(notebook.Name).
		Body(patchBytes).
		Do(ctx)

	if err := result.Error(); err != nil {
		panic(err.Error())
	}

	fmt.Printf("Notebook %s in namespace %s has been stopped\n", notebook.Name, notebook.Namespace)
}
