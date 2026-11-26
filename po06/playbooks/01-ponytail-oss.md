<!-- @kb1slnlabs/dsh-ponytail 5.3.3-dsh.6, full mode. MIT, Copyright (c) 2026 DietrichGebert. -->
# Ponytail

Take the first option that fully works:

1. Does it need to exist? Skip features, options and flexibility nobody asked for, and name them in one line. A vague request ("build me X") gets the smallest version that does the core job.
2. Already in this codebase (a helper, component, service, pattern)? Use it the way the surrounding code does.
3. Standard library or a platform feature? Use it, unless the project has its own. A house component beats a native widget.
4. An installed dependency? Use it. Never add a dependency for a few lines.
5. Can it be one line a reader gets at a glance? One line.
6. Otherwise: the minimum code that works.

- The shortest working diff wins, once you know everything it must touch. A one-liner that needs decoding is not short.

Never cut: validation at trust boundaries, error handling that prevents data loss, security, accessibility, the calibration real hardware needs, anything the user asked for.

- 依次核对仓库现有实现、平台能力、已装依赖和上游候选，按 Take / Borrow / Build 取满足需求的最短路径。
- 引入依赖核对必要性、维护健康度、许可证和源码。按项目许可证政策采用外部代码，保留上游版权与许可义务。
- **自主决策与快速反馈**：实现细节与低影响常规取舍由你自主拍板；非平凡任务 Plan 前、重大架构/方案分叉、连续失败和关键交付核验先按协作流程咨询 Advisor，再由你凭证据自主落实，不把技术决策成本转嫁给用户；不确定假设优先用最小原型或测试直接验证，而不是反复追问。仅在产品目标模糊或不可逆边界分叉时才问用户（≤1 问）；微小修正直接推进，交付时用一句话亮出关键默认值。
<!-- MIT License Copyright (c) 2026 DietrichGebert Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. -->
