# 通知模板配置说明

## 已配置的订阅消息模板

### 1. 待接单提醒（新工单通知）
- **模板ID**: `A5RmnL45TNMGA7a7MYeL7jSPOHuIVprbbVKqwvZsZ2c`
- **模板编号**: 28000
- **使用场景**: 新工单创建时通知所有工程师
- **字段配置**:
  ```javascript
  {
    thing4: "工单标题",           // 最多20个字符
    character_string21: "工单编号", // 最多32个字符
    thing14: "联系人",            // 最多20个字符
    phone_number1: "联系电话",     // 电话号码格式
    thing2: "用户地址"            // 最多20个字符
  }
  ```

### 2. 服务取消通知
- **模板ID**: `CHwAIAdTsyFcH1yP108bo3M3oCQccy2MmkDA82UhRYQ`
- **模板编号**: 30749
- **使用场景**: 工单被用户取消时通知负责工程师
- **字段配置**:
  ```javascript
  {
    thing1: "服务项目",           // 最多20个字符（使用工单标题）
    character_string4: "订单编号"  // 最多32个字符（使用工单编号）
  }
  ```

### 3. 经理通知（待申请）
- **模板ID**: 待申请
- **使用场景**: 经理群发通知给工程师团队
- **建议字段**: 通知标题、通知内容、发送时间、优先级

## 代码配置位置

### 1. 前端模板ID配置
**文件**: `/miniprogram/utils/wxp.js`
```javascript
export function getEngineerTemplateIds() {
  return {
    new_ticket: 'A5RmnL45TNMGA7a7MYeL7jSPOHuIVprbbVKqwvZsZ2c',
    ticket_cancelled: 'CHwAIAdTsyFcH1yP108bo3M3oCQccy2MmkDA82UhRYQ',
    manager_notice: 'TEMPLATE_ID_MANAGER'  // 待申请
  };
}
```

### 2. 云函数模板配置
**文件**: `/cloudfunctions/sendNotification/index.js`

模板ID映射：
```javascript
function getTemplateId(type) {
  const templates = {
    'new_ticket': 'A5RmnL45TNMGA7a7MYeL7jSPOHuIVprbbVKqwvZsZ2c',
    'ticket_cancelled': 'CHwAIAdTsyFcH1yP108bo3M3oCQccy2MmkDA82UhRYQ',
    'manager_notice': 'TEMPLATE_ID_MANAGER'
  }
  return templates[type] || null
}
```

字段映射：
```javascript
function buildMessageData(type, data) {
  switch(type) {
    case 'new_ticket':
      return {
        thing4: { value: data.ticketTitle },
        character_string21: { value: data.ticketNo },
        thing14: { value: data.contactName },
        phone_number1: { value: data.contactPhone },
        thing2: { value: data.address }
      }
    case 'ticket_cancelled':
      return {
        thing1: { value: data.serviceName },
        character_string4: { value: data.ticketNo }
      }
  }
}
```

## 数据传递说明

### 新工单通知数据
从 `submitTicket` 云函数传递：
```javascript
{
  ticketTitle: ticket.title,        // 工单标题
  ticketNo: ticket.ticketNo,        // 工单编号
  contactName: ticket.submitterName, // 提交人姓名
  contactPhone: ticket.phone,       // 联系电话
  address: ticket.location          // 地址/位置
}
```

### 取消通知数据
从 `cancelTicket` 函数传递：
```javascript
{
  serviceName: ticket.title,  // 使用工单标题作为服务项目
  ticketNo: ticket.ticketNo   // 工单编号
}
```

## 字段限制处理

### thing类型（20字符限制）
- 工单标题
- 联系人
- 用户地址
- 服务项目

使用 `truncate` 函数处理：
```javascript
function truncate(str, maxLength) {
  if (!str) return ''
  let len = 0
  let result = ''
  for (let i = 0; i < str.length; i++) {
    len += str.charCodeAt(i) > 127 ? 2 : 1  // 中文算2个字符
    if (len <= maxLength) {
      result += str[i]
    } else {
      return result.length > 0 ? result : str.substring(0, 1)
    }
  }
  return result
}
```

### character_string类型（32字符限制）
- 工单编号
- 订单编号

通常不需要截断，因为工单编号格式固定。

### phone_number类型
- 必须是有效的电话号码格式
- 如果无效，使用默认值"未提供"

## 测试要点

1. **字段长度**：确保所有字段不超过限制
2. **必填字段**：确保所有必填字段都有值
3. **订阅权限**：用户需要先订阅才能收到通知
4. **配额管理**：每次订阅只能发送一次通知

## 注意事项

1. **模板审核**：新模板需要1-3个工作日审核
2. **字段类型**：必须严格按照模板定义的字段类型
3. **字符限制**：thing类型20字符，中文算2个
4. **发送频率**：避免频繁发送，可能被限制

## 后续优化

1. **申请更多模板**：
   - 工单完成通知（用户端）
   - 经理群发通知
   - 工单催办通知

2. **优化数据处理**：
   - 智能截断长文本
   - 优先显示关键信息
   - 添加省略号提示

3. **监控统计**：
   - 发送成功率
   - 用户订阅率
   - 通知点击率

---

*更新时间：2024-12-29*
*配置状态：已完成*