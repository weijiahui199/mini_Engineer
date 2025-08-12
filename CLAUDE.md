# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WeChat Mini Program (微信小程序) project for an IT Engineer Workstation application. It uses WeChat Cloud Development (云开发) with cloud functions, database, and storage capabilities. The project is built for IT engineers and managers to manage tickets, materials, and work statistics.

## Tech Stack

- **Frontend**: WeChat Mini Program with TDesign UI components
- **Backend**: WeChat Cloud Functions (Node.js)
- **Database**: WeChat Cloud Database (JSON document database)
- **UI Library**: TDesign MiniProgram v1.10.0
- **Storage**: WeChat Cloud Storage for avatars and attachments

## Project Structure

```
/miniprogram/          # Mini program frontend code
  /pages/              # Page components
    /dashboard/        # Work dashboard
    /ticket-list/      # Ticket list view
    /ticket-detail/    # Ticket detail view
    /profile/          # User profile
    /login/            # Login and user setup
  /components/         # Reusable components
  /utils/              # Utility functions
  /assets/             # Images and icons
  
/cloudfunctions/       # Cloud functions (backend)
  /login/              # User authentication
  /userProfile/        # User profile management
  /avatarUpload/       # Avatar upload handling
  /submitTicket/       # Ticket submission
  /fileManager/        # File management
  
/docs/                 # Documentation
/engineer-prototype/   # HTML prototypes
```

## Development Commands

### Install Dependencies
```bash
npm install
```

### Build NPM Modules for Mini Program
In WeChat DevTools:
1. Tools → Build npm
2. The built modules will be in `/miniprogram/miniprogram_npm/`

### Deploy Cloud Functions
Use WeChat DevTools to deploy cloud functions:
1. Right-click on a cloud function folder
2. Select "Upload and Deploy: Cloud Install Dependencies"

Or use the script (requires WeChat CLI):
```bash
./uploadCloudFunction.sh
```

### Testing
No automated tests are currently configured. Test manually using WeChat DevTools simulator.

## Key Architecture Decisions

### User Roles System
- **User**: Default role for new registrations, limited access
- **Engineer**: Can process tickets, manage materials
- **Manager**: Has all engineer permissions plus team oversight

### State Management
- User authentication state stored in app.globalData
- Local caching using wx.setStorageSync for tokens and user info
- Real-time updates using cloud database watchers

### UI Components
All pages use TDesign components registered globally in app.json. Custom styling applied through CSS variables defined in app.wxss.

### Cloud Functions Architecture
Each cloud function is isolated with its own package.json. Common patterns:
- Authentication via SHA256 hashed tokens
- Error handling with try-catch blocks
- Response format: `{ success: boolean, data/error: any }`

### Avatar Management
- Avatars uploaded to cloud storage path: `user-avatars/YYYY/MM/`
- Automatic compression to 400x400px
- Old avatars deleted when updating

## User Authentication & Profile Management

### 重要：getUserProfile 已废弃
微信已废弃 `wx.getUserProfile` 接口。当前项目使用新的头像昵称填写能力：
- **头像选择**: 使用 `<button open-type="chooseAvatar">` 
- **昵称输入**: 使用 `<input type="nickname">`
- **登录流程**: 使用 `wx.login` 获取 code，通过云函数换取 openid

### 用户认证流程
1. **初次登录** (`/pages/login/index`)
   - 调用 `wx.login` 获取临时 code
   - 云函数 `login` 换取 openid 和生成 token
   - 跳转到用户信息设置页面

2. **信息设置** (`/pages/login/user-setup`)
   ```xml
   <!-- 头像选择按钮 -->
   <button open-type="chooseAvatar" bindchooseavatar="onChooseAvatar">
     <image src="{{avatarUrl}}" />
   </button>
   
   <!-- 昵称输入框 -->
   <input type="nickname" bindinput="onNicknameInput" />
   ```

3. **头像上传处理**
   - 选择头像后自动压缩至 400x400px
   - 上传到云存储 `user-avatars/YYYY/MM/` 目录
   - 通过 `avatarUpload` 云函数处理

## Common Development Tasks

### Adding a New Page
1. Create page folder in `/miniprogram/pages/`
2. Add to `pages` array in `/miniprogram/app.json`
3. If it's a tab page, add to `tabBar.list` in app.json

### Creating a Cloud Function
1. Create folder in `/cloudfunctions/`
2. Add `index.js` and `package.json`
3. Deploy using WeChat DevTools

### Using TDesign Components
Components are globally registered. Use them directly in WXML:
```xml
<t-button theme="primary">Button</t-button>
<t-cell title="Title" description="Description" />
```

### Database Operations
```javascript
// In cloud functions
const db = cloud.database();
const result = await db.collection('tickets')
  .where({ status: 'pending' })
  .get();

// In mini program
const db = wx.cloud.database();
db.collection('tickets').add({
  data: { /* ticket data */ }
});
```

## Important Notes

- **Environment**: Check `envList.js` for cloud environment IDs
- **Permissions**: Cloud function permissions managed in WeChat Console
- **API Limits**: Be aware of WeChat API rate limits and quotas
- **Image Optimization**: Always compress images before uploading
- **Error Handling**: Use error-handler.js utility for consistent error management
- **Caching**: Use cache-manager.js for optimized data caching