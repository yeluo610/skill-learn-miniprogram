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

Kubernetes（K8s）是容器编排系统。kubectl 是它的命令行客户端。

## 核心概念
- **Pod**：最小调度单元，含一个或多个容器
- **Deployment**：管理 Pod 副本
- **Service**：稳定访问入口
- **Namespace**：逻辑隔离

## 命令格式
\`\`\`
kubectl <verb> <resource> [name] [flags]
\`\`\`
如 \`kubectl get pods -n default\`。`,
  },
  {
    id: 'k8s-get',
    title: '查看资源',
    content: `# 查看资源

\`\`\`
kubectl get pods                    # 列出 Pod
kubectl get pods -A                 # 所有命名空间
kubectl get pods -o wide            # 详细信息
kubectl get deploy,svc              # 多种资源
kubectl get pod <name> -o yaml      # YAML 格式
kubectl describe pod <name>         # 详情
kubectl get nodes                   # 节点
\`\`\`

\`-A\` = \`--all-namespaces\`。`,
  },
  {
    id: 'k8s-apply',
    title: '创建与更新',
    content: `# 声明式与命令式

**声明式（推荐）**：
\`\`\`
kubectl apply -f deploy.yaml
kubectl delete -f deploy.yaml
\`\`\`

**命令式**：
\`\`\`
kubectl create deployment nginx --image=nginx
kubectl scale deployment nginx --replicas=3
kubectl set image deploy/nginx nginx=nginx:1.25
kubectl rollout restart deployment nginx
\`\`\``,
  },
  {
    id: 'k8s-debug',
    title: '调试与日志',
    content: `# 调试

\`\`\`
kubectl logs <pod>                  # 查看日志
kubectl logs -f <pod>                # 跟踪日志
kubectl logs <pod> -c <container>   # 指定容器
kubectl exec -it <pod> -- sh        # 进入容器
kubectl port-forward svc/web 8080:80 # 端口转发
kubectl top pod                     # 资源占用
kubectl get events --sort-by=.lastTimestamp
\`\`\``,
  },
  {
    id: 'k8s-config',
    title: '配置与上下文',
    content: `# 配置

\`\`\`
kubectl config view                 # 查看配置
kubectl config get-contexts         # 上下文列表
kubectl config use-context <name>   # 切换上下文
kubectl config current-context       # 当前上下文
\`\`\`

kubeconfig 默认在 \`~/.kube/config\`。`,
  },
  {
    id: 'k8s-advanced',
    title: '高级操作',
    content: `# 高级

\`\`\`
kubectl label pod <name> env=prod    # 打标签
kubectl annotate pod <name> x=y      # 注解
kubectl taint node <n> key=value:NoSchedule
kubectl cordon <node>                # 标记不可调度
kubectl drain <node>                 # 驱逐
kubectl uncordon <node>              # 恢复
kubectl rollout status deploy/<n>    # 发布状态
kubectl rollout undo deploy/<n>      # 回滚
\`\`\``,
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
