## 工单
- `work/tickets/done/T<N>-<短名>.md`　Closes #<issue>
- 一句话：<…>

## 证据
- 回执：`work/tickets/receipts/T<N>.receipt.md`
- 验收 + 审查：`work/tickets/receipts/<批次>.review.md`（PASS @ `<sha>`）；manager 裁决：<路径或「无需」>
- 合并后回测：<命令 + 通过数>

## 复用来源
<上游包@版本、`来源: <url>@<sha>:<path>`，或「无」+ 理由>

## 检查清单
- [ ] 工单已在 `done/`，`accepted` 已填
- [ ] 只改工单边界内的文件
- [ ] 测试先红后绿，数量未下降
- [ ] 无凭证、token、内网地址、运行时产物进入 diff
- [ ] 多 worktree 期间未使用 `git stash`
