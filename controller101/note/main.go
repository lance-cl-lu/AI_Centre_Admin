package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// remove a notebook pod's policyv
var leastCPUUsage = 7890289
var leastMemUsage = 380000

// Notebook represents the structure of a notebook in the JSON response
type Notebook struct {
	Name        string `json:"name"`
	Namespace   string `json:"namespace"`
	CPUUsage    string `json:"cpuUsage"`
	MemUsage    string `json:"memUsage"`
	IdleCounter int    `json:"idleCounter"`
	removalTag  bool   `json:"removalTag"`
}

// PodMetricsList represents the structure of the JSON response from the metrics API
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
	// Use the current context in kubeconfig
	kubeconfig := filepath.Join(
		homeDir(), ".kube", "config",
	)
	config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		panic(err.Error())
	}

	// Create the clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}

	// Context for API request
	ctx := context.Background()
	notebooks := []Notebook{}
	// Replace "notebooks" with the appropriate resource name
	notebooksData, err := clientset.RESTClient().
		Get().
		AbsPath("/apis/kubeflow.org/v1").
		Resource("notebooks").
		DoRaw(ctx)
	if err != nil {
		panic(err.Error())
	}
	// add each notebook's name and namespace to the list of notebooks
	var data map[string]interface{}
	if err := json.Unmarshal(notebooksData, &data); err != nil {
		panic("Error unmarshalling JSON: " + err.Error())
	}
	for _, item := range data["items"].([]interface{}) {
		metadata := item.(map[string]interface{})["metadata"].(map[string]interface{})
		notebooks = append(notebooks, Notebook{
			Name:      metadata["name"].(string),
			Namespace: metadata["namespace"].(string),
		})
	}

	ctx = context.TODO()
	// using k8s API to get the list of notebook's resources restful API
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

	// write the pod metrics data to a file
	file, err := os.Create("podMetrics.json")
	if err != nil {
		panic(err.Error())
	}
	defer file.Close()
	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(podMetricsList); err != nil {
		panic(err.Error())
	}
	// sort notebooks by name
	sort.Slice(notebooks, func(i, j int) bool {
		return notebooks[i].Name < notebooks[j].Name
	})
	//sort the podMetricsList by name
	sort.Slice(podMetricsList.Items, func(i, j int) bool {
		return podMetricsList.Items[i].Metadata.Name < podMetricsList.Items[j].Metadata.Name
	})

	// print resources of each notebook
	for _, item := range podMetricsList.Items {
		// if pods has name {name}-{replica} at the end, remove it
		// split the name by "-" at the end of the nam
		strings.Split(item.Metadata.Name, "-")
		// if the length of the split name is greater than 1, remove the last element
		if len(strings.Split(item.Metadata.Name, "-")) > 1 {
			item.Metadata.Name = strings.Join(strings.Split(item.Metadata.Name, "-")[:len(strings.Split(item.Metadata.Name, "-"))-1], "-")
		}

		for _, container := range item.Containers {
			for i, notebook := range notebooks {
				if container.Name == notebook.Name && item.Metadata.Namespace == notebook.Namespace {
					notebooks[i].CPUUsage = container.Usage.CPU
					notebooks[i].MemUsage = container.Usage.Memory
					notebooks[i].IdleCounter = 0
					fmt.Printf("Notebook: %s, Namespace: %s, CPU Usage: %s, Memory Usage: %s\n", notebook.Name, notebook.Namespace, container.Usage.CPU, container.Usage.Memory)
					fmt.Printf("Counter: %d\n", notebooks[i].IdleCounter)
					// print time
					t := time.Now()
					fmt.Printf("Time: %s\n", t.Format("2006-01-02 15:04:05"))
				}
			}
		}
	}
	// sort notebooks by name
	sort.Slice(notebooks, func(i, j int) bool {
		return notebooks[i].Name < notebooks[j].Name
	})

	// get the resources of each notebook and print the each second
	for {

		// get all notebook's resources every 60 seconds and check if the notebook still in use, if not remove from the list
		tmpNotebooksData, err := clientset.RESTClient().
			Get().
			AbsPath("/apis/kubeflow.org/v1").
			Resource("notebooks").
			DoRaw(ctx)
		if err != nil {
			panic(err.Error())
		}

		// parse the response
		var tmpData map[string]interface{}
		if err := json.Unmarshal(tmpNotebooksData, &tmpData); err != nil {
			panic("Error unmarshalling JSON: " + err.Error())
		}
		// add new notebooks to the list and delete the notebooks that are not in use
		for _, item := range tmpData["items"].([]interface{}) {
			metadata := item.(map[string]interface{})["metadata"].(map[string]interface{})
			// check if the notebook is already in the list
			found := false
			for _, notebook := range notebooks {
				if metadata["name"].(string) == notebook.Name && metadata["namespace"].(string) == notebook.Namespace {
					found = true
					break
				}
			}
			// if the notebook is not in the list, add it to the list
			if !found {
				notebooks = append(notebooks, Notebook{
					Name:      metadata["name"].(string),
					Namespace: metadata["namespace"].(string),
				})
			}
		}
		// check if the notebook is still in use
		for i, notebook := range notebooks {
			found := false
			for _, item := range tmpData["items"].([]interface{}) {
				metadata := item.(map[string]interface{})["metadata"].(map[string]interface{})
				if metadata["name"].(string) == notebook.Name && metadata["namespace"].(string) == notebook.Namespace {
					found = true
					break
				}
			}
			// if the notebook is not in use, remove it from the list
			if !found {
				notebooks = append(notebooks[:i], notebooks[i+1:]...)
			}
		}
		// sleep for 60 seconds
		time.Sleep(1 * time.Second)
		// get resources of each notebook's pod by calling the API
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
		// sort the podMetricsList by name
		sort.Slice(podMetricsList.Items, func(i, j int) bool {
			return podMetricsList.Items[i].Metadata.Name < podMetricsList.Items[j].Metadata.Name
		})
		// print resources of each notebook
		for _, item := range podMetricsList.Items {
			// if pods has name {name}-{replica} at the end, remove it
			// split the name by "-" at the end of the nam
			strings.Split(item.Metadata.Name, "-")
			// if the length of the split name is greater than 1, remove the last element
			if len(strings.Split(item.Metadata.Name, "-")) > 1 {
				item.Metadata.Name = strings.Join(strings.Split(item.Metadata.Name, "-")[:len(strings.Split(item.Metadata.Name, "-"))-1], "-")
			}

			for _, container := range item.Containers {
				for i, notebook := range notebooks {
					if container.Name == notebook.Name && item.Metadata.Namespace == notebook.Namespace {
						notebooks[i].CPUUsage = container.Usage.CPU
						notebooks[i].MemUsage = container.Usage.Memory
						notebooks[i].IdleCounter += 1
						fmt.Printf("Notebook: %s, Namespace: %s, CPU Usage: %s, Memory Usage: %s\n", notebook.Name, notebook.Namespace, container.Usage.CPU, container.Usage.Memory)
						fmt.Printf("Counter: %d\n", notebooks[i].IdleCounter)

						// if the notebook is not in use for 5 minutes, delete it's pod
						cpuUsageStr := strings.Replace(container.Usage.CPU, "n", "", -1)
						memUsageStr := strings.Replace(container.Usage.Memory, "Ki", "", -1)
						cpuUsage, err := strconv.Atoi(cpuUsageStr)
						if err != nil {
							panic(err.Error())
						}
						memUsage, err := strconv.Atoi(memUsageStr)
						if err != nil {
							panic(err.Error())
						}
						fmt.Printf("CPU Usage: %d, Memory Usage: %d\n", cpuUsage, memUsage)
						if cpuUsage < leastCPUUsage && notebooks[i].IdleCounter > 5 && memUsage < leastMemUsage {
							// delete the pod
							fmt.Printf("Deleting all pods of notebook %s in namespace %s\n", notebook.Name, notebook.Namespace)
							// try delete all pods of the notebook
							pods, err := clientset.CoreV1().Pods(notebook.Namespace).List(ctx, metav1.ListOptions{})
							if err != nil {
								panic(err.Error())
							}
							for _, pod := range pods.Items {
								if strings.Contains(pod.Name, notebook.Name) {
									err := clientset.CoreV1().Pods(notebook.Namespace).Delete(ctx, pod.Name, metav1.DeleteOptions{})
									if err != nil {
										panic(err.Error())
									}
								}
							}
							// using k8s API to delete the notebook
							result := clientset.RESTClient().
								Delete().
								AbsPath("/apis/kubeflow.org/v1").
								Resource("notebooks").
								Namespace(notebook.Namespace).
								Name(notebook.Name).
								Do(ctx)
							notebookerr := result.Error()
							if notebookerr != nil {
								panic(notebookerr.Error())
							}

							// remove the notebook from the list
							notebooks = append(notebooks[:i], notebooks[i+1:]...)

						}
						if cpuUsage > leastCPUUsage || memUsage > leastMemUsage {
							notebooks[i].IdleCounter = 0
						}
					}
				}
			}
		}
		// sort notebooks by name
		sort.Slice(notebooks, func(i, j int) bool {
			return notebooks[i].Name < notebooks[j].Name
		})
		t := time.Now()
		fmt.Printf("Time: %s\n", t.Format("2006-01-02 15:04:05"))

	}
}

func homeDir() string {
	if h := home(); h != "" {
		return h
	}
	return "/root"
}

func home() string {
	if h := homeDirFlag(); h != "" {
		return h
	}
	if h := homeEnv(); h != "" {
		return h
	}
	return ""
}

func homeDirFlag() string {
	var home string
	flag.StringVar(&home, "home", "", "home directory override")
	flag.Parse()
	return home
}

func homeEnv() string {
	if h := homeDirFromEnv(); h != "" {
		return h
	}
	return ""
}

func homeDirFromEnv() string {
	return os.Getenv("HOME")
}
