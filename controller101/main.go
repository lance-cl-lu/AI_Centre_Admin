package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
	duration := os.Getenv("DURATION")
	if duration == "" {
		duration = "60"
	}

	timeIntervalInt, err := strconv.Atoi(timeInterval)
	if err != nil {
		panic(err.Error())
	}
	fmt.Printf("Time interval: %d seconds\n", timeIntervalInt)
	durationInt, err := strconv.Atoi(duration)
	if err != nil {
		panic(err.Error())
	}
	fmt.Printf("Duration: %d seconds\n", durationInt)

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
	notebookMap := make(map[string]*Notebook)

	// 啟動每日定時任務（在固定時間執行，不影響主迴圈）
	go scheduleDailyTask(clientset, ctx)

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
				if val, exists := labels["persisitent"]; exists {
					if valStr, ok := val.(string); ok && valStr == "true" {
						persistentTag = true
					}
				}
			}

			annotations, hasAnnotations := metadata["annotations"].(map[string]interface{})
			stoppedAnnotation := ""
			if hasAnnotations {
				if stopped, ok := annotations["kubeflow-resource-stopped"]; ok {
					stoppedAnnotation, _ = stopped.(string)
				}
			}

			if _, exists := notebookMap[key]; !exists {
				notebookMap[key] = &Notebook{
					Name:        name,
					Namespace:   namespace,
					RemovalTag:  !persistentTag,
					IdleCounter: 0,
				}
			}

			if stoppedAnnotation != "" {
				notebookMap[key].IdleCounter = 0
			} else {
				notebookMap[key].RemovalTag = !persistentTag
			}
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
							fmt.Printf("Notebook %s in namespace %s has been idle for %d seconds\n", notebook.Name, notebook.Namespace, notebook.IdleCounter)
							stopNotebook(clientset, notebook, ctx)
							notebook.IdleCounter = 0
						}
					}
				}
			}
		}

		for _, notebook := range notebookMap {
			fmt.Printf("Notebook: %s, Namespace: %s, CPU Usage: %s, Mem Usage: %s, Idle Counter: %d, Removal Tag: %t\n",
				notebook.Name, notebook.Namespace, notebook.CPUUsage, notebook.MemUsage, notebook.IdleCounter, notebook.RemovalTag)
			if notebook.IdleCounter > timeIntervalInt && notebook.RemovalTag {
				fmt.Printf("Notebook %s in namespace %s has been idle for %d minutes\n", notebook.Name, notebook.Namespace, notebook.IdleCounter)
			}
		}

		time.Sleep(time.Duration(durationInt) * time.Second)
		fmt.Println(time.Now().Format("2006-01-02 15:04:05"))
		fmt.Println("=====================================================")
	}
}

// scheduleDailyTask 根據設定在固定時間執行任務
func scheduleDailyTask(clientset *kubernetes.Clientset, ctx context.Context) {
	// 從環境變數讀取執行模式
	taskMode := os.Getenv("TASK_MODE") // "daily" 或 "hourly"，預設 "daily"
	if taskMode == "" {
		taskMode = "daily"
	}

	var dailyHour, dailyMinute, hourlyMinute int

	// 讀取每日執行時間
	dailyHour = 2   // 預設凌晨 2 點
	dailyMinute = 0 // 預設 0 分

	if hourEnv := os.Getenv("DAILY_TASK_HOUR"); hourEnv != "" {
		if h, err := strconv.Atoi(hourEnv); err == nil && h >= 0 && h < 24 {
			dailyHour = h
		}
	}

	if minuteEnv := os.Getenv("DAILY_TASK_MINUTE"); minuteEnv != "" {
		if m, err := strconv.Atoi(minuteEnv); err == nil && m >= 0 && m < 60 {
			dailyMinute = m
		}
	}

	// 讀取每小時執行時間（分鐘）
	hourlyMinute = 0 // 預設每小時的 0 分執行

	if minuteEnv := os.Getenv("HOURLY_TASK_MINUTE"); minuteEnv != "" {
		if m, err := strconv.Atoi(minuteEnv); err == nil && m >= 0 && m < 60 {
			hourlyMinute = m
		}
	}

	if taskMode == "daily" {
		fmt.Printf("Daily task scheduled at %02d:%02d\n", dailyHour, dailyMinute)
		scheduleDailyTaskLoop(clientset, ctx, dailyHour, dailyMinute)
	} else if taskMode == "hourly" {
		fmt.Printf("Hourly task scheduled at every hour %02d minute\n", hourlyMinute)
		scheduleHourlyTaskLoop(clientset, ctx, hourlyMinute)
	} else {
		fmt.Printf("Unknown task mode: %s, defaulting to daily\n", taskMode)
		scheduleDailyTaskLoop(clientset, ctx, dailyHour, dailyMinute)
	}
}

// scheduleDailyTaskLoop 每天固定時間執行
func scheduleDailyTaskLoop(clientset *kubernetes.Clientset, ctx context.Context, hour, minute int) {
	for {
		now := time.Now()
		// 計算到下一次執行時間的間隔
		next := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, now.Location())

		// 如果今天的執行時間已過，設定為明天
		if now.After(next) {
			next = next.Add(24 * time.Hour)
		}

		duration := next.Sub(now)
		fmt.Printf("Next daily task will run at: %s (in %v)\n", next.Format("2006-01-02 15:04:05"), duration)

		time.Sleep(duration)

		// 執行每日任務
		performDailyTask(clientset, ctx)
	}
}

// scheduleHourlyTaskLoop 每小時固定時刻執行
func scheduleHourlyTaskLoop(clientset *kubernetes.Clientset, ctx context.Context, minute int) {
	for {
		now := time.Now()
		// 計算到下一次執行時間的間隔（下一小時的指定分鐘）
		next := time.Date(now.Year(), now.Month(), now.Day(), now.Hour(), minute, 0, 0, now.Location())

		// 如果目前時刻已過本小時的執行時間，設定為下一小時
		if now.After(next) {
			next = next.Add(1 * time.Hour)
		}

		duration := next.Sub(now)
		fmt.Printf("Next hourly task will run at: %s (in %v)\n", next.Format("2006-01-02 15:04:05"), duration)

		time.Sleep(duration)

		// 執行每日任務
		performDailyTask(clientset, ctx)
	}
}

// performDailyTask 每日執行的具體任務
func performDailyTask(clientset *kubernetes.Clientset, ctx context.Context) {
	fmt.Println("=====================================================")
	fmt.Println("Starting daily task at", time.Now().Format("2006-01-02 15:04:05"))

	// 動態取得 Django backend Pod IP
	djangoAPIURL, err := getDjangoAPIURL(clientset, ctx)
	if err != nil {
		fmt.Printf("Error getting Django API URL: %v\n", err)
		// 使用預設值
		djangoAPIURL = "http://192.168.210.185:8000/api/ldap/user/deletepermanent/"
	}

	fmt.Printf("Using Django API URL: %s\n", djangoAPIURL)

	// 取得所有 Profile，找出有 delete_date 且已過期的使用者
	profiles, err := getAllProfiles(clientset, ctx)
	if err != nil {
		fmt.Printf("Error fetching profiles: %v\n", err)
		return
	}

	deletedCount := 0
	for _, profile := range profiles {
		// 檢查 delete_date annotation
		deleteDate, exists := profile["delete_date"]
		if !exists {
			continue
		}

		// 解析 delete_date 時間
		deleteDateStr, ok := deleteDate.(string)
		if !ok {
			continue
		}

		deleteTime, err := time.Parse("2006-01-02 15:04:05", deleteDateStr)
		if err != nil {
			fmt.Printf("Error parsing delete_date for profile %s: %v\n", profile["name"], err)
			continue
		}

		// 檢查是否已過期
		if time.Now().After(deleteTime) {
			username := profile["name"].(string)
			fmt.Printf("Deleting expired user: %s (delete_date: %s)\n", username, deleteDateStr)

			// 呼叫 Django API 刪除使用者
			if err := deleteUserPermanent(djangoAPIURL, username); err != nil {
				fmt.Printf("Error deleting user %s: %v\n", username, err)
			} else {
				fmt.Printf("Successfully deleted user: %s\n", username)
				deletedCount++
			}
		}
	}

	fmt.Printf("Total users deleted: %d\n", deletedCount)
	fmt.Println("Daily task completed at", time.Now().Format("2006-01-02 15:04:05"))
	fmt.Println("=====================================================")
}

// getDjangoAPIURL 動態取得 Django backend Pod IP
func getDjangoAPIURL(clientset *kubernetes.Clientset, ctx context.Context) (string, error) {
	// 從環境變數讀取配置（可選）
	namespace := os.Getenv("DJANGO_NAMESPACE")
	if namespace == "" {
		namespace = "ldap"
	}

	deploymentName := os.Getenv("DJANGO_DEPLOYMENT")
	if deploymentName == "" {
		deploymentName = "backend-deployment"
	}

	port := os.Getenv("DJANGO_PORT")
	if port == "" {
		port = "8000"
	}

	apiPath := os.Getenv("DJANGO_API_PATH")
	if apiPath == "" {
		apiPath = "/api/ldap/user/deletepermanent/"
	}

	// 取得 Deployment 的 label selector
	deployment, err := clientset.AppsV1().Deployments(namespace).Get(ctx, deploymentName, v1.GetOptions{})
	if err != nil {
		return "", fmt.Errorf("error getting deployment: %v", err)
	}

	// 使用 label selector 找到對應的 Pod
	labelSelector := ""
	for key, value := range deployment.Spec.Selector.MatchLabels {
		if labelSelector != "" {
			labelSelector += ","
		}
		labelSelector += fmt.Sprintf("%s=%s", key, value)
	}

	// 取得 Pod 列表
	pods, err := clientset.CoreV1().Pods(namespace).List(ctx, v1.ListOptions{
		LabelSelector: labelSelector,
	})
	if err != nil {
		return "", fmt.Errorf("error listing pods: %v", err)
	}

	if len(pods.Items) == 0 {
		return "", fmt.Errorf("no pods found for deployment %s", deploymentName)
	}

	// 取得第一個 Running 的 Pod IP
	for _, pod := range pods.Items {
		if pod.Status.Phase == "Running" && pod.Status.PodIP != "" {
			apiURL := fmt.Sprintf("http://%s:%s%s", pod.Status.PodIP, port, apiPath)
			return apiURL, nil
		}
	}

	return "", fmt.Errorf("no running pod found with IP")
}

// getAllProfiles 取得所有 Kubeflow Profile
func getAllProfiles(clientset *kubernetes.Clientset, ctx context.Context) ([]map[string]interface{}, error) {
	profilesData, err := clientset.RESTClient().
		Get().
		AbsPath("/apis/kubeflow.org/v1/profiles").
		DoRaw(ctx)

	if err != nil {
		return nil, err
	}

	var profilesResp map[string]interface{}
	if err := json.Unmarshal(profilesData, &profilesResp); err != nil {
		return nil, err
	}

	profiles := []map[string]interface{}{}
	items, ok := profilesResp["items"].([]interface{})
	if !ok {
		return profiles, nil
	}

	for _, item := range items {
		profileMap := item.(map[string]interface{})
		metadata := profileMap["metadata"].(map[string]interface{})
		annotations, hasAnnotations := metadata["annotations"].(map[string]interface{})

		profileInfo := map[string]interface{}{
			"name": metadata["name"].(string),
		}

		if hasAnnotations {
			if deleteDate, exists := annotations["delete_date"]; exists {
				profileInfo["delete_date"] = deleteDate
			}
		}

		profiles = append(profiles, profileInfo)
	}

	return profiles, nil
}

// deleteUserPermanent 呼叫 Django API 永久刪除使用者
func deleteUserPermanent(apiURL, username string) error {
	// 建立 JSON payload
	payload := map[string]string{
		"username": username,
	}
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("error marshalling JSON: %v", err)
	}

	// 發送 POST 請求
	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("error creating request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("error sending request: %v", err)
	}
	defer resp.Body.Close()

	// 讀取回應
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("error reading response: %v", err)
	}

	// 檢查 HTTP 狀態碼
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	fmt.Printf("API response for user %s: %s\n", username, string(body))
	return nil
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
