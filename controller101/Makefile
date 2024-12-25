run:
	docker build -t cguaicadmin/pod-killer .
	docker push cguaicadmin/pod-killer
	kubectl delete -f mycontroll.yaml
	kubectl apply -f mycontroll.yaml