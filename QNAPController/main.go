// main.go
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
)

func main() {
	var kubeconfig *string
	if home := homedir.HomeDir(); home != "" {
		kubeconfig = flag.String("kubeconfig", filepath.Join(home, ".kube", "config"), "(optional) absolute path to the kubeconfig file")
	} else {
		kubeconfig = flag.String("kubeconfig", "", "absolute path to the kubeconfig file")
	}
	flag.Parse()

	config, err := clientcmd.BuildConfigFromFlags("", *kubeconfig)
	if err != nil {
		fmt.Printf("Error building kubeconfig: %s\n", err.Error())
		os.Exit(1)
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		fmt.Printf("Error creating Kubernetes client: %s\n", err.Error())
		os.Exit(1)
	}

	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		fmt.Printf("Error creating dynamic client: %s\n", err.Error())
		os.Exit(1)
	}

	stopCh := make(chan os.Signal, 1)
	signal.Notify(stopCh, syscall.SIGINT, syscall.SIGTERM)

	fmt.Println("Starting QNAP Controller...")

	// Start the controller
	go runController(clientset, dynamicClient)

	<-stopCh
	fmt.Println("Shutting down QNAP Controller...")
}

func runController(clientset *kubernetes.Clientset, dynamicClient dynamic.Interface) {
	profileGVR := schema.GroupVersionResource{
		Group:    "kubeflow.org",
		Version:  "v1",
		Resource: "profiles",
	}

	for {
		// List all Profile CRDs
		profiles, err := dynamicClient.Resource(profileGVR).List(context.TODO(), metav1.ListOptions{})
		if err != nil {
			fmt.Printf("Error listing profiles: %s\n", err.Error())
			time.Sleep(10 * time.Second)
			continue
		}

		// Iterate over each profile
		for _, profile := range profiles.Items {
			namespace := profile.GetName()
			// Check if the Secret exists
			_, err := clientset.CoreV1().Secrets(namespace).Get(context.TODO(), "qnap", metav1.GetOptions{})
			if errors.IsNotFound(err) {
				// Secret does not exist, create it
				createSecret(clientset, namespace)
			} else if err != nil {
				fmt.Printf("Error getting secret: %s\n", err.Error())
			}
		}

		time.Sleep(30 * time.Second)
	}
}

func createSecret(clientset *kubernetes.Clientset, namespace string) {
	// Retrieve the ConfigMap
	configMap, err := clientset.CoreV1().ConfigMaps("kubeflow").Get(context.TODO(), "qnap-config", metav1.GetOptions{})
	if err != nil {
		fmt.Printf("Error getting configmap: %s\n", err.Error())
		return
	}

	// Create the Secret
	secretData := map[string][]byte{
		"ip":       []byte(configMap.Data["ip"]),
		"username": []byte(configMap.Data["username"]),
		"password": []byte(configMap.Data["password"]),
	}

	secret := &v1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name: "qnap",
		},
		Data: secretData,
	}

	_, err = clientset.CoreV1().Secrets(namespace).Create(context.TODO(), secret, metav1.CreateOptions{})
	if err != nil {
		fmt.Printf("Error creating secret: %s\n", err.Error())
	} else {
		fmt.Printf("Secret 'qnap' created in namespace '%s'\n", namespace)
	}
}
