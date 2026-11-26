# Autopilot Dev · DSH 许愿式开发

把一句需求变成有边界、可执行、可验证的任务。在 DSH 原生 **PTC Mode** 中使用，不需要额外的 Wish 模式，也不切换主会话模型。

基于 [Wish Specializer](https://github.com/WestFox-AwA/dsh-wish-specializer) 的 BSD-3-Clause 开源实现，增加 Semantic Anchors（关键词提示词）、Worker ↔ Advisor 协作与证据驱动工作流。本仓库只包含通用工程模式，不包含科研流水线、个人环境或模型服务密钥。

## 工作方式

1. **Intent Alignment**：发送前补全意图、隐含约束与质量方向；原话不改写，补全包独立注入。
2. **Intent Elaboration**：非平凡任务轻量摸底后，先问 Advisor 如何实现，再由 Worker 制定方案。低风险小修直接做。
3. **Execution**：Karpathy 四原则 + Ponytail；连续失败时 Stop-the-Line，用 Systematic Debugging 寻找根因。
4. **Quality Calibration**：Worker 执行真实测试并检查结果；完整代码变更就绪后，按需发起一次独立只读审查；对照证据修复、重测。
5. **Goal**：原生长程 Goal 按目标、里程碑、证据与停止条件推进；Advisor 建议不能自行改写 Goal 或宣称完成。

普通咨询使用直接模型调用，不启动子代理。复杂调查和最终代码 Review 使用独立上下文，以真实源码、Git 与可定位证据为准。阶段台账只在实际存在阶段依赖时使用。

## 安装

要求：支持 PTC、bundle patch、原生 subagent 的 DSH 版本，以及 Node.js（开发和打包建议 22+）。先在独立 profile 试用。

```bash
git clone https://github.com/CrepuscularIRIS/autopilot-dev.git
cd autopilot-dev
npm pack --ignore-scripts
dsh plugin --profile desktop add "$(pwd)/dsh-external-dsh-wish-specializer-0.9.1-autopilot.1.tgz"
```

或使用 [Releases](https://github.com/CrepuscularIRIS/autopilot-dev/releases) 的同版本 .tgz。安装后重启 DSH Desktop，在新的会话选择 **PTC Mode**，在 Options 中开启许愿特化（High 或 Ultra）。启用顾问与只读工具；首次可用简单技术任务检查注入卡片。

包名保留 `@dsh-external/dsh-wish-specializer` 以兼容既有 bundle 和 UI；它是替换原版的 fork，**不能与原版同装于一个 profile**。如已有该包，请先核对所选 profile，移除旧包或使用新的 profile。Ponytail / Superpowers 的关键规则已集成，可按需关闭重复插件；不会自动修改其它插件。

## 模型配置

四个角色是路由而不是固定模型。无角色配置时，使用当前会话的模型；独立审查仍使用新的只读子代理上下文。DSH Options 的模型选项只控制发送前解释层（默认跟随会话），不会改主模型或其它角色。

| 角色 | 可选的四模型方案 | 触发 |
|---|---|---|
| Worker | GLM 5.4 1M | 主会话执行、图像与阶段证据核验 |
| Advisor | DeepSeek V4.1 Flash | 默认咨询、Plan 前校准、排错 |
| Investigator | K3.1 Pro | 根因不明或恢复路径难选，独立调查 |
| Reviewer | GPT-6.2 Sol | 完整任务交付前一次独立代码审查 |

[示例 profile 配置](examples/profile.patch.yml) 中提供可编辑 provider/model 及 reasoningEffort。将示例的 `config` 合并到该包实际生效的 bundle entry 或 profile 覆盖层；不要再次插入同名 entry。模型 ID 必须与你在 DSH 配置的 provider 一致。没有 LiteLLM 也能使用其它 DSH provider，插件不自带 API 服务、不设置密钥。图像能力取决于模型自身。

在 PTC 中：
```js
return await tools.consult_task({question:"根据当前证据，真实目标、最短路线和可测 DoD 是什么？"})
```

更多：[协作规范](po06/ADVISOR.md) · [关键词语义锚点](docs/KEYWORDS.md) · [Worker 规则目录](po06/playbooks/) · [English](README.en.md)

## 验证 / 开发

```bash
npm test
npm run pack:check
```

源码测试为本地回归，不代表所有模型或系统实测质量。Windows 可选 Shell 需要系统 Bash/Git for Windows/MSYS2；本 fork 不分发第三方二进制运行时。DSH 的原生工具、权限与工作区配置仍由宿主控制。

## License

BSD-3-Clause，保留原作者版权。集成的 Ponytail 与 Superpowers 摘录按 MIT 许可保留出处及许可；见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
