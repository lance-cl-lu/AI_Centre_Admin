package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

// remove a notebook pod's policyv
var leastCPUUsage = 300000000

// Notebook represents the structure of a notebook in the JSON response
type Notebook struct {
	Name        string `json:"name"`
	Namespace   string `json:"namespace"`
	CPUUsage    string `json:"cpuUsage"`
	MemUsage    string `json:"memUsage"`
	IdleCounter int    `json:"idleCounter"`
	removalTag  bool
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
	// try to get environment variables TIMEINTERVAL
	timeInterval := os.Getenv("TIMEINTERVAL")
	if timeInterval == "" {
		fmt.Println("TIMEINTERVAL environment variable not set, using default value of 60")
		timeInterval = "60"
	}

	// convert the timeInterval to an integer
	timeIntervalInt, err := strconv.Atoi(timeInterval)
	if err != nil {
		panic(err.Error())
	}
	// print the time interval
	fmt.Printf("Time interval: %d\n", timeIntervalInt)

	// load kubeconfig in local host
	home := homeDir()
	kubeconfig := home + "/.kube/config"
	fmt.Printf("Kubeconfig: %s\n", kubeconfig)
	// use the current context in kubeconfig
	config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {

		// Use the current context in kubeconfig
		config, err = rest.InClusterConfig()
		if err != nil {
			panic(err.Error())
		}
	}

	// Create the clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}

	// Context for API request
	ctx := context.Background()
	notebooks := []Notebook{}
	// get all pods of the notebook
	// Fetch all notebooks

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
		// print labels
		labels := metadata["labels"].(map[string]interface{})
		fmt.Printf("Labels: %v\n", labels)
		//Labels: map[app:sfmsdkfmdskflsdlfmds removal:OK]
		removalTag, err := labels["removal"].(string)
		if err != true {
			removalTag = "OK"
		}
		tmpRemovalTag := bool(removalTag == "OK")

		notebooks = append(notebooks, Notebook{
			Name:       metadata["name"].(string),
			Namespace:  metadata["namespace"].(string),
			removalTag: tmpRemovalTag,
			// in Labels, there is a key called removalTag
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
		strings.Split(item.Metadata.Name, "-")
		if len(strings.Split(item.Metadata.Name, "-")) > 1 {
			item.Metadata.Name = strings.Join(strings.Split(item.Metadata.Name, "-")[:len(strings.Split(item.Metadata.Name, "-"))-1], "-")
		}

		for _, container := range item.Containers {
			for i, notebook := range notebooks {
				if container.Name == notebook.Name && item.Metadata.Namespace == notebook.Namespace {
					notebooks[i].CPUUsage = container.Usage.CPU
					notebooks[i].MemUsage = container.Usage.Memory
					notebooks[i].IdleCounter = 0
					fmt.Printf("Notebook: %s, Namespace: %s, CPU Usage: %s, Memory Usage: %s, Counter: %d, Removal Tag: %t\n", notebook.Name, notebook.Namespace, container.Usage.CPU, container.Usage.Memory, notebooks[i].IdleCounter, notebook.removalTag)

				}
			}
		}
	}
	t := time.Now()
	fmt.Printf("Time: %s\n", t.Format("2006-01-02 15:04:05"))
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
			found := true
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
			found := true
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
		// sleep for 1 minute
		time.Sleep(time.Second)
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
						fmt.Printf("Notebook: %s, Namespace: %s, CPU Usage: %s, Memory Usage: %s, Counter: %d, Removal Tag: %t\n", notebook.Name, notebook.Namespace, container.Usage.CPU, container.Usage.Memory, notebooks[i].IdleCounter, notebook.removalTag)
						// if the notebook is not in use for 5 minutes, delete it's pod
						cpuUsageStr := ""
						if strings.Contains(container.Usage.CPU, "n") {
							cpuUsageStr = strings.Replace(container.Usage.CPU, "n", "", -1)
						} else if strings.Contains(container.Usage.CPU, "m") {
							cpuUsageStr = strings.Replace(container.Usage.CPU, "m", "", -1)
						} else if strings.Contains(container.Usage.CPU, "u") {
							cpuUsageStr = strings.Replace(container.Usage.CPU, "u", "", -1)
						} else {
							cpuUsageStr = container.Usage.CPU
						}

						cpuUsage, err := strconv.Atoi(cpuUsageStr)
						if err != nil {
							panic(err.Error())
						}
						if cpuUsage < leastCPUUsage && notebooks[i].IdleCounter > 60 && notebooks[i].removalTag == true {
							// Stop the notebook instead of deleting it

							fmt.Printf("Stopping notebook %s in namespace %s\n", notebook.Name, notebook.Namespace)

							// get current time
							t := time.Now()
							fmt.Printf("Time: %s\n", t.Format("2006-01-02T15:04:05"))

							// Prepare the patch for stopping the noteboo
							patchBody := map[string]interface{}{
								"metadata": map[string]interface{}{
									"annotations": map[string]interface{}{
										"kubeflow-resource-stopped": t.Format("2006-01-02T15:04:05"),
									},
								},
							}

							// Convert the patch body to JSON
							patchBytes, err := json.Marshal(patchBody)
							if err != nil {
								panic(err.Error())
							}

							// Send a PATCH request to update the notebook with stop annotation
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
							// print result
							fmt.Printf("Notebook %s in namespace %s has been stopped\n", notebook.Name, notebook.Namespace)
							notebooks[i].IdleCounter = 0
						}

						if cpuUsage > leastCPUUsage {
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

		// reget all the notebooks
		notebooksData, err := clientset.RESTClient().
			Get().
			AbsPath("/apis/kubeflow.org/v1").
			Resource("notebooks").
			DoRaw(ctx)
		if err != nil {
			panic(err.Error())
		}
		// check if changes have been made to the notebook
		var data map[string]interface{}
		if err := json.Unmarshal(notebooksData, &data); err != nil {
			panic("Error unmarshalling JSON: " + err.Error())
		}
		// add new notebooks to the list and delete the notebooks that are not in use
		for _, item := range data["items"].([]interface{}) {
			metadata := item.(map[string]interface{})["metadata"].(map[string]interface{})
			// check if the notebook is already in the list
			found := true
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
			found := true
			for _, item := range data["items"].([]interface{}) {
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
