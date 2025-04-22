# AI_Centre_Admin
In this project, we worked under the guidance of Prof. Yu-Chung Wang, and our platform was presented by Prof. Wang at COSCUP 2024. You can view the presentation [here](https://volunteer.coscup.org/schedule/2024/session/DNQDD9).

This educational platform is built on Kubernetes (K8s) and integrates various artificial intelligence toolkits, such as Jupyter Notebook, Remote Desktop Docker images, and Jupyter Lab. My contributions to the platform include implementing account authentication (Account Manager) using OpenLDAP and developing a Kubernetes resource controller (Resource Manager). These two applications can be found in my [GitHub repository](https://github.com/JaeggerJose/AI_Centre_Admin). Additionally, our [CGU-Kubeflow repository](https://github.com/wycc/cgu-kubeflow) is also available on GitHub.

### Account Manager

Utilizing the OpenID Connect token authenticator plugin within Kubernetes (K8s), we developed a sophisticated web-based user interface that manages users in a hierarchical structure with three permission levels: admin, group manager, and user. This interface improves operational efficiency through features such as exporting and importing lab and user data to and from Excel, along with providing a comprehensive tree-level overview.

To integrate Dex with our OpenLDAP-based authentication application, we created a specialized YAML file that enables authentication of information from OpenLDAP via Dex within K8s. Additionally, we experimented with OAuth2 authentication using Office 365 (O365). However, this method faced integration challenges with OpenLDAP, leading us to put it on hold for the time being.
 ![image](https://github.com/user-attachments/assets/5e503baa-6f6f-4bb3-90c2-dc6dbb5154ab)

### Resource Manager

To optimize resource utilization within our platform, I developed a Go-based controller program designed to monitor idle Jupyter Notebooks. This program interfaces directly with the Kubernetes Metrics API, allowing it to retrieve detailed information about each notebook, including its name, associated pods, namespace, and CPU usage on a per-minute basis.

Prof. Wang and I collaborated to establish a CPU usage threshold to identify inactive notebooks. If a notebook's CPU usage falls below this threshold consistently, it is flagged by our system. If it remains inactive for 60 consecutive checks, the notebook is automatically scheduled for deletion, thereby releasing the computing resources back to Kubeflow and Kubernetes for other users.

This method not only enhances the efficiency of resource allocation but also ensures that our computing environment remains dynamic and responsive to the varying needs of different users. By continuously monitoring and adjusting resource deployment, we maintain an optimal balance between availability and utilization, maximizing the platform's overall performance.
