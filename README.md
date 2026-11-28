# Autopilot Dev · DSH 许愿式开发

基于 [Wish Specializer](https://github.com/WestFox-AwA/dsh-wish-specializer) 的 BSD-3-Clause 开源实现，在 **DSH 原生 PTC Mode** 内提供发送前意图补全、异步专业提议、长程 Goal 校准及独立终审。不需要新模式，不改写用户原话，也不切换主会话模型。

## 四模型协作

| 角色 | 示例模型 | 职责 |
|---|---|---|
| Worker | GLM 5.4 1M | 主会话、实现、测试、视觉证据 |
| Wish / 高频顾问 | DeepSeek V4.1 Flash | 发送前补全；TODO/阶段/异常事件触发非阻塞专业提议 |
| 长程顾问 / 独立调查 | K3.1 Pro | 原生 Goal 满 10 小时后低频监督；复杂故障可显式咨询 |
| 独立终审 | GPT-6.2 Sol | 完整非平凡代码任务结束时一次 Lite 只读审查 |

发送前 Wish 保留原话，将独立建议包交给 Worker；普通 PTC 最多两轮只读查证。Flash 后台依据领域维度和轨迹补充专业细节，不阻塞 Worker。需要用户决定的事项走 DSH 原生确认卡片；顾问建议不是用户授权或验收。Sol 只报告实际源码支持的问题，Worker 核实、修复并重测。旧阶段台账默认不启用。

### 调用可视化

会话顶部 **Wish 顾问** 标签（与对话、轨迹等并列），或右侧栏的同名入口，按 Wish、Flash、Kimi、Sol 筛选，查看每个调用的耗时、状态、建议、读取的知识卡及审查问题。窄窗口在更多会话视图菜单中查找。打开面板才读状态，不增加模型调用。

### 没有领域卡片也能工作

默认加载内置 [通用领域提示](po06/lenses/generic.md)，让 Flash 自行召回领域范式、决策维度、反例与评价标准。它可以提出候选领域索引，供本任务复用；草稿不会自动变成已审核知识。

有自有领域库时，可显式导入 Markdown 卡片清单并绑定项目根目录。只在该项目中按当前任务匹配、最多读取两份原文，附文件指纹。其它项目仍使用通用提示。见 [领域知识库接口](po06/META-SUPERVISOR.md)。本仓库不包含任何个人知识库、私有项目或凭据。

## 安装

要求：支持 PTC、bundle patch、独立 subagent 和会话 View 的 DSH 版本；构建建议 Node.js 22+。先用独立 profile 试用。

    git clone https://github.com/CrepuscularIRIS/autopilot-dev.git
    cd autopilot-dev
    npm pack --ignore-scripts
    dsh plugin --profile desktop add "$(pwd)/dsh-external-dsh-wish-specializer-0.9.1-autopilot.2.tgz"

重启 DSH Desktop，选择原生 PTC Mode，启用许愿特化、顾问与只读工具。包名保留 @dsh-external/dsh-wish-specializer 以兼容已有 bundle；不可与原版同装在同一 profile。内建 Ponytail 与 Superpowers 核心方法，可按需要关闭重复插件，不会自动修改其它插件。

## 模型配置

模型是可配置的 provider/model 角色，不依赖 LiteLLM 或特定账号。未配置角色时使用当前会话的模型，独立审查仍运行在只读子代理上下文。发送前解释层由 Options 单独控制。将 [示例配置](examples/profile.patch.yml) 的 config 合并到实际生效的 bundle entry/profile patch，替换为本机真实 provider/model ID，不要重复插入同名 entry。metaSupervisor: false 可关闭后台提议；旧阶段核验默认关闭，只有显式 legacyStageReviews: true 才可用。

普通主动咨询使用 consult_task 的 question；复杂调查使用 advisorRoute: investigate；最终审查使用 advisorRoute: review, scope: general。

## 开发和验证

    npm test
    npm run pack:check

测试验证程序行为与接线，不等同于真实模型质量。Windows Shell 需要本机 Bash/Git for Windows/MSYS2；本 fork 不分发运行时二进制。完整规则见 [Advisor](po06/ADVISOR.md)、[关键词](docs/KEYWORDS.md) 和 [方法论](po06/playbooks/)。

BSD-3-Clause，保留原作者版权。Ponytail/Superpowers 摘录按 MIT 保留出处与许可，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
