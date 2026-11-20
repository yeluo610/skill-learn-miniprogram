/**
 * kubectl 板块（单文件：checker + tutorial + 元数据）
 *
 * 填空题校验：与 Linux 板块相同，采用「命令归一化匹配」。
 */
import type { Skill, CheckResult, TestCase, TutorialSection } from '../shared/types'
import { buildResult, toExpectedArray } from '../shared/utils'

function normalize(cmd: string): string {
  return cmd.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function kubectlChecker(
  userInput: string,
  testCases: TestCase[]
): CheckResult {
  const details = testCases.map((tc) => {
    const expArr = toExpectedArray(tc.expected)
    const got = normalize(userInput)
    const expList = expArr.map(normalize)
    const pass = expList.includes(got)
    return {
      pass,
      got: userInput.trim(),
      expected: expArr.join(' | '),
    }
  })
  return buildResult(details)
}

export const kubectlTutorial: TutorialSection[] = [
  {
    id: 'k8s-intro',
    title: 'Kubernetes 与 kubectl',
    content: `# Kubernetes 简介

Kubernetes（常缩写 K8s，因为 K 和 s 之间有 8 个字母）是**容器编排系统**——管理成百上千个容器化应用的部署、扩缩容、故障恢复。kubectl 是它的命令行客户端，你用 kubectl 告诉集群"我想要什么样的状态"，K8s 帮你把实际状态调成那样。

## 核心概念

| 概念 | 是什么 | 类比 |
|---|---|---|
| **Pod** | K8s 最小调度单元，含 1+ 容器 | 一个应用实例 |
| **Deployment** | 管理 Pod 副本，负责滚动更新 | 应用的"管理者" |
| **Service** | 给一组 Pod 提供稳定访问入口 | 内部负载均衡 |
| **Namespace** | 逻辑隔离资源 | 项目的"房间" |
| **ConfigMap/Secret** | 配置和敏感数据 | 配置文件/密码 |

## 为什么需要 K8s

- **自愈**：容器挂了自动重启；节点挂了自动迁移
- **扩缩容**：流量大时一键扩容，闲时缩容
- **滚动更新**：零停机更新版本
- **声明式**：描述"我要 3 个副本"，不用关心怎么实现

## kubectl 命令格式

\`\`\`
kubectl <动词> <资源> [名字] [选项]
\`\`\`

例如 \`kubectl get pods -n default\`：
- \`get\` 动词
- \`pods\` 资源
- \`-n default\` 选项（指定命名空间）

## kubectl vs docker

- \`docker run\` 启动一个容器，挂了就没了
- \`kubectl create deployment\` 让 K8s 帮你跑并保证一直跑着

## 本板块怎么学

从 get（查看）→ apply（应用）→ scale/rollout（扩缩容/更新）→ debug（调试）→ 高级运维，由浅入深。每个命令都动手敲，看输出。`,
  },
  {
    id: 'k8s-get',
    title: '查看资源',
    content: `# 查看资源

\`kubectl get\` 是最常用的命令，列出集群里的资源。

## 基本用法

\`\`\`
kubectl get pods                    # 列出当前命名空间的 Pod
kubectl get pods -A                 # 所有命名空间
kubectl get pods -o wide            # 详细信息（节点、IP）
kubectl get deploy,svc              # 同时看多种资源
kubectl get pod <name> -o yaml      # 输出完整 YAML
kubectl get pod <name> -o json      # 输出 JSON
kubectl describe pod <name>         # 详情（含事件）
kubectl get nodes                   # 集群节点
\`\`\`

## 常用选项

| 选项 | 作用 |
|---|---|
| \`-A\` / \`--all-namespaces\` | 所有命名空间 |
| \`-n <ns>\` | 指定命名空间 |
| \`-o wide\` | 更多字段（节点、IP） |
| \`-o yaml\` / \`-o json\` | 完整结构 |
| \`-l app=nginx\` | 按标签筛选 |
| \`--show-labels\` | 显示标签 |
| \`-w\` / \`--watch\` | 实时跟踪变化 |

## 资源简写

K8s 资源都有简写，敲起来更快：

| 全名 | 简写 |
|---|---|
| pods | po |
| deployments | deploy |
| services | svc |
| namespaces | ns |
| nodes | no |
| configmaps | cm |
| secrets | secret |
| ingresses | ing |
| persistentvolumes | pv |
| persistentvolumeclaims | pvc |

## get vs describe

- \`get\`：列表，看名字、状态、年龄
- \`describe\`：单个资源的详细事件、配置、调度历史

**故障排查第一步永远是 \`describe\`**——看 Events 部分能发现"镜像拉不下来""资源不够""健康检查失败"等线索。

## 实用技巧

- \`kubectl get all\`：列出常见资源
- \`kubectl get pods --sort-by=.status.startTime\`：按启动时间排序
- \`kubectl get events --sort-by=.lastTimestamp\`：按时间看事件`,
  },
  {
    id: 'k8s-apply',
    title: '创建与更新',
    content: `# 创建与更新资源

K8s 推荐**声明式**——你描述"我要这个样子"，系统帮你达到。和命令式（一步步下指令）是两种思维。

## 声明式 apply（推荐）

把资源定义写在 YAML 里，用 apply 应用：

\`\`\`
kubectl apply -f deploy.yaml          # 创建或更新
kubectl delete -f deploy.yaml          # 删除
kubectl apply -f ./manifests/         # 目录下所有 YAML
\`\`\`

apply 的好处：
- **幂等**：重复执行结果一致
- **可版本化**：YAML 进 Git，可追溯
- **可对比**：\`kubectl diff -f deploy.yaml\` 看会改什么

## 命令式创建

适合快速试验，不建议生产用：

\`\`\`
kubectl create deployment nginx --image=nginx
kubectl create deployment web --image=nginx --replicas=3
kubectl expose deployment nginx --port=80
\`\`\`

## 扩缩容

\`\`\`
kubectl scale deployment nginx --replicas=3
kubectl scale deployment nginx --replicas=5
kubectl autoscale deployment nginx --min=2 --max=10 --cpu-percent=80
\`\`\`

## 滚动更新

更新镜像触发滚动更新，K8s 自动逐个替换 Pod：

\`\`\`
kubectl set image deploy/nginx nginx=nginx:1.25
kubectl rollout status deploy/nginx          # 看进度
kubectl rollout history deploy/nginx         # 看历史
kubectl rollout undo deploy/nginx            # 回滚到上一版
kubectl rollout undo deploy/nginx --to-revision=2
kubectl rollout restart deploy/nginx         # 重启（不改变镜像）
\`\`\`

## apply vs create 的区别

- \`create\`：资源已存在会**报错**
- \`apply\`：资源存在就**更新**，不存在就创建（智能 patch）

生产环境几乎都用 apply。

## 实用技巧

- 编辑线上资源：\`kubectl edit deploy/nginx\`（打开编辑器，保存即生效）
- 临时调试：\`kubectl run tmp --image=busybox --rm -it -- sh\`
- 扩缩容配合 HPA（自动扩缩），不用手动 scale`,
  },
  {
    id: 'k8s-debug',
    title: '调试与日志',
    content: `# 调试与日志

应用出问题时，按"事件 → 日志 → 进容器"的顺序排查。

## 第一步：describe 看事件

\`\`\`
kubectl describe pod <name>
\`\`\`

看末尾 Events 部分，常见问题：
- **ImagePullBackOff**：镜像拉不下来（标签错？仓库无权限？）
- **CrashLoopBackOff**：容器启动后崩溃重启（看日志）
- **Pending**：调度不上（资源不够？节点污点？）
- **OOMKilled**：内存超限被杀（调大 limits）

## 第二步：看日志

\`\`\`
kubectl logs <pod>                   # 当前日志
kubectl logs -f <pod>                # 跟踪日志（类似 tail -f）
kubectl logs --previous <pod>        # 上次崩溃前的日志（重要！）
kubectl logs <pod> -c <container>    # 指定容器（多容器 Pod）
kubectl logs -l app=nginx --tail=100 # 按标签查多 Pod 日志
\`\`\`

\`--previous\` 是神器——容器崩了重启后，新日志是空的，但旧日志能告诉你为什么崩。

## 第三步：进容器

\`\`\`
kubectl exec -it <pod> -- sh         # 进入交互终端
kubectl exec -it <pod> -- bash       # bash 更全
kubectl exec <pod> -- ls /app        # 执行单条命令
\`\`\`

进容器看进程、改配置、测网络，和 SSH 进服务器类似。

## 端口转发

把集群服务转到本地，方便本地工具连接：

\`\`\`
kubectl port-forward svc/web 8080:80     # 本地 8080 → service 80
kubectl port-forward pod/xyz 9090:9090
\`\`\`

然后浏览器访问 \`http://localhost:8080\` 就是集群里的服务。

## 临时调试 Pod

\`\`\`
kubectl run debug --image=nicolaka/netshoot --rm -it -- sh
\`\`\`

启动一个临时 Pod，里面有全套网络调试工具（curl、dig、tcpdump...），用完即删。

## 资源使用

\`\`\`
kubectl top nodes                   # 节点 CPU/内存
kubectl top pods                    # Pod 资源
kubectl top pods -A                 # 所有命名空间
\`\`\`

## 排查思路总结

| 症状 | 第一步 |
|---|---|
| Pod 一直 Pending | \`describe\` 看 Events，是否资源/污点 |
| Pod 一直 CrashLoopBackOff | \`logs --previous\` 看崩溃前日志 |
| Pod Running 但访问不通 | \`exec\` 进去 ping/curl，看 Service/Endpoints |
| 服务慢 | \`top\` 看资源，\`describe\` 看调度`,
  },
  {
    id: 'k8s-config',
    title: '配置与上下文',
    content: `# 配置与上下文

kubeconfig 是 kubectl 的配置文件，定义了"连接哪个集群、用哪个账号、默认命名空间"。管理多集群时必须搞懂。

## kubeconfig 文件

默认位置：\`~/.kube/config\`，YAML 格式，包含：
- **clusters**：集群地址
- **users**：认证信息
- **contexts**：集群 + 用户 + 命名空间的组合

## 查看配置

\`\`\`
kubectl config view                          # 看完整配置
kubectl config get-contexts                 # 列出所有上下文
kubectl config current-context               # 当前上下文
kubectl cluster-info                         # 集群地址
kubectl version                              # 客户端/服务端版本
\`\`\`

## 切换上下文

\`\`\`
kubectl config use-context prod              # 切到 prod 集群
kubectl config set-context --current --namespace=dev   # 改默认命名空间
\`\`\`

**多集群最危险的操作**：在 prod 集群里误执行了 dev 的命令。养成切完上下文先 \`kubectl config current-context\` 确认的习惯。

## 切换命名空间

\`\`\`
kubectl -n dev get pods                      # 临时指定
kubectl config set-context --current --namespace=dev    # 改默认
\`\`\`

## 合并多集群配置

把别的集群配置合并进来：
\`\`\`
KUBECONFIG=config1:config2 kubectl config view --flatten > merged
\`\`\`

## 实用技巧

- 善用 \`kubectl config get-contexts\` 看当前在哪个集群
- 用别名：\`alias k=kubectl\`，\`alias kprod='kubectl config use-context prod'\`
- 复杂操作前先 \`--dry-run=client -o yaml\` 预览`,
  },
  {
    id: 'k8s-advanced',
    title: '高级操作',
    content: `# 高级运维操作

掌握这些，你能做标签调度、节点维护、卷管理等高级运维。

## 标签与注解

**标签（Label）**：用来筛选资源，是 Service/Deployment 找到 Pod 的关键。

\`\`\`
kubectl label pod <name> env=prod            # 加标签
kubectl label pod <name> env-                # 删除标签
kubectl get pods -l env=prod                 # 按标签筛
kubectl get pods --show-labels               # 显示所有标签
\`\`\`

**注解（Annotation）**：保存非标识性元数据（如版本、说明），不能用来筛。

\`\`\`
kubectl annotate pod <name> owner=team-a
\`\`\`

## 节点调度控制

\`\`\`
kubectl cordon <node>             # 标记不可调度（已有 Pod 不动）
kubectl drain <node>              # 驱逐 Pod，准备维护
kubectl uncordon <node>           # 恢复调度
kubectl taint node <n> key=value:NoSchedule   # 打污点，Pod 不调度上来
kubectl taint node <n> key:NoSchedule-        # 移除污点
\`\`\`

**维护节点标准流程**：\`cordon\` → \`drain\` → 修机器 → \`uncordon\`。

## 污点与容忍

污点让节点拒绝 Pod 调度；Pod 设置 toleration 才能上去。常见污点：
- \`NoSchedule\`：不调度新 Pod
- \`PreferNoSchedule\`：尽量不调度
- \`NoExecute\`：驱逐现有不符的 Pod

## 卷相关

\`\`\`
kubectl get pv                               # 持久卷（集群级）
kubectl get pvc                              # 持久卷声明（命名空间级）
kubectl get storageclass                     # 存储类
\`\`\`

PV 是集群的存储资源，PVC 是用户对存储的"申请"，绑定后 Pod 才能用这块存储。

## 安全与 RBAC

\`\`\`
kubectl get roles                            # 角色
kubectl get rolebindings                     # 角色绑定
kubectl get clusterrole                      # 集群级角色
kubectl get sa                               # ServiceAccount
\`\`\`

RBAC（基于角色的访问控制）：Role 定义"能做什么"，RoleBinding 把 Role 绑给用户/ServiceAccount。

## 实用技巧

- 强制删除卡住的资源：\`kubectl delete pod <name> --force --grace-period=0\`（慎用）
- 编辑资源：\`kubectl edit deploy/nginx\`
- 导出资源定义：\`kubectl get deploy nginx -o yaml > deploy.yaml\`
- 看 API 资源：\`kubectl api-resources\`
- 看 API 版本：\`kubectl api-versions\``,
  },
]


export const kubectlSkill: Skill = {
  id: 'kubectl',
  name: 'kubectl',
  icon: '/assets/icons/kubectl.svg',
  desc: 'Kubernetes 命令行，从查看到调试',
  levels: [
    { id: 'low', name: '初级', desc: 'get / describe / 基础资源', count: 80 },
    { id: 'mid', name: '中级', desc: 'apply / scale / 日志 / exec', count: 80 },
    { id: 'high', name: '高级', desc: '标签、污点、卷、配置', count: 80 },
    { id: 'top', name: '顶级', desc: '排障、性能、安全、运维', count: 80 },
  ],
  checker: kubectlChecker,
  tutorial: kubectlTutorial,
  enabled: true,
}
