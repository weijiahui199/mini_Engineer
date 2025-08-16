# 云函数部署说明

## 重要提示
云函数 `submitTicket` 已经更新，需要重新部署到微信云开发环境。

## 更新内容
1. 增强了 `updateTicketStatus` 函数，支持从 `resolved` 状态转换到 `processing`
2. 添加了调试日志以便排查权限问题
3. 改进了权限检查逻辑

## 部署步骤

### 方法一：使用微信开发者工具（推荐）
1. 打开微信开发者工具
2. 在左侧文件树中找到 `cloudfunctions/submitTicket` 文件夹
3. 右键点击该文件夹
4. 选择"上传并部署：云端安装依赖"
5. 等待部署完成的提示

### 方法二：使用命令行（需要配置微信CLI）
```bash
# 如果已配置uploadCloudFunction.sh脚本
./uploadCloudFunction.sh

# 或者使用微信CLI直接部署
wxcloud functions:deploy --name submitTicket --env [你的环境ID]
```

## 验证部署
部署完成后，请测试以下功能：
1. 在工单详情页，已解决的工单应该显示"重新处理"和"关闭工单"按钮
2. 点击"重新处理"应该能将工单状态改回"处理中"
3. 点击"关闭工单"后，工单应该无法再进行任何操作

## 故障排查
如果遇到"无法从resolved状态转换为processing状态"的错误：
1. 确认云函数已经成功部署
2. 检查微信开发者工具的云开发控制台，查看云函数日志
3. 确认当前用户是工单的负责人（assigneeOpenid）

## 更新时间
- 2024-08-16 第一次更新：支持resolved到processing状态转换
- 2024-08-16 第二次更新：确保云函数已包含acceptTicket方法
- 2025-08-16 第三次更新：修复rejectTicket方法，正确清空负责人信息

## 重要提示 - 请立即部署
如果Dashboard页面的"开始处理"按钮无法正常工作，请确保：
1. 云函数已经重新部署
2. 在微信开发者工具的云开发控制台查看云函数日志
3. 检查是否有权限相关的错误

## 退回工单功能
新增的rejectTicket方法会：
1. 将工单状态设置为pending
2. 使用db.command.remove()清空assigneeOpenid字段
3. 使用db.command.remove()清空assigneeName字段
4. 使用db.command.remove()清空acceptTime字段
5. 记录退回原因和时间

这确保了退回的工单能够重新进入工单池，被任何工程师接单。