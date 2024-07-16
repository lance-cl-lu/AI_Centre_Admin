package main

import (
	"context"
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
	"sort"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// Notebook represents the structure of a notebook in the JSON response
type Notebook struct {
	APIVersion string `json:"apiVersion"`
	Items      []struct {
		Metadata struct {
			Name      string `json:"name"`
			Namespace string `json:"namespace"`
		} `json:"metadata"`
		Spec struct {
			Template struct {
				Spec struct {
					Containers []struct {
						Image string `json:"image"`
					} `json:"containers"`
				} `json:"spec"`
			} `json:"template"`
		} `json:"spec"`
		Status struct {
			ReadyReplicas int `json:"readyReplicas"`
		} `json:"status"`
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

	// Replace "notebooks" with the appropriate resource name
	notebooksData, err := clientset.RESTClient().
		Get().
		AbsPath("/apis/kubeflow.org/v1").
		Resource("notebooks").
		DoRaw(ctx)
	if err != nil {
		panic(err.Error())
	}

	ctx = context.TODO()

	var notebooks Notebook
	err = json.Unmarshal(notebooksData, &notebooks)
	if err != nil {
		panic(err.Error())
	}
	sort.Slice(notebooks.Items, func(i, j int) bool {
		return notebooks.Items[i].Metadata.Name < notebooks.Items[j].Metadata.Name
	})

	metricsClient, err := metrics.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}
	// using k8s API to get the list of notebook's resources
	nodeMetricsList, err := notebooks.GetNotebookList()

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
