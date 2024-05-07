package main

import (
	"fmt"
	"os/exec"
	"strings"
	"time"
	"os"
	"bufio"
	//"k8s.io/client-go/rest"
	//"k8s.io/client-go/tools/clientcmd"


	//metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	//"k8s.io/client-go/kubernetes"
	//"k8s.io/client-go/tools/clientcmd"
	//corev1 "k8s.io/api/core/v1"
)

var (
	notebooks    = make(map[string]time.Time)
	maxLiveTime  = 60 * time.Minute
	staticPods   = []string{"d000018238:baby", "d000018238:algebra1", "d000018238:public", "d000018238:deeplearning", "temp:ollama", "testcc:hf-code-autocomplete", "m1161009:vit3", "testcc1:hf"}
	kubeconfig   = "" // Path to your kubeconfig file
	// config, _    = clientcmd.BuildConfigFromFlags("", kubeconfig)
	//clientset, _ = kubernetes.NewForConfig(config)
)



func main() {
    //config, err := rest.InClusterConfig()
	for {
		poll()
		time.Sleep(5 * time.Second)
	}
}

func poll() {
	//profiles := getProfiles()
	//os.system("kubectl top po -A --containers --use-protocol-buffers > /tmp/monitor.log") 
    cmd := exec.Command("sh", "-c", "kubectl top po -A --containers --use-protocol-buffers > /tmp/monitor.log")
    if err := cmd.Run(); err != nil {
        fmt.Println("Failed to execute command:", err)
        return
    }

    // Open and read /tmp/monitor.log
    file, err := os.Open("/tmp/monitor.log")
    if err != nil {
        fmt.Println("Failed to open file:", err)
        return
    }
    defer file.Close()

    scanner := bufio.NewScanner(file)
    for scanner.Scan() {
        line := scanner.Text()
        parts := strings.Fields(line) // Fields splits the string s around each instance of one or more consecutive white space characters, as defined by unicode.IsSpace, returning an array of substrings of s or an empty list if s is empty.

        if len(parts) == 6 {
            //checkPod(parts, profiles)
        }
    }

    if err := scanner.Err(); err != nil {
        fmt.Println("Error reading file:", err)
    }
}

func getProfiles() map[string]bool {
	// Execute the kubectl command to get profiles and write output to /tmp/profile.tmp
	cmd := exec.Command("sh", "-c", "kubectl get profile -A > /tmp/profile.tmp")
	if err := cmd.Run(); err != nil {
		fmt.Println("Failed to execute command:", err)
		return nil
	}

	// Open the output file
	file, err := os.Open("/tmp/profile.tmp")
	if err != nil {
		fmt.Println("Failed to open file:", err)
		return nil
	}
	defer file.Close()

	profiles := make(map[string]bool)
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.Fields(line) // Splits the line into parts

		// Skip lines that don't have exactly 2 fields or start with 'NAME'
		if len(parts) != 2 || parts[0] == "NAME" {
			continue
		}

		// Add the profile name to the map
		profiles[parts[0]] = true
	}

	if err := scanner.Err(); err != nil {
		fmt.Println("Error reading file:", err)
	}

	return profiles
}
