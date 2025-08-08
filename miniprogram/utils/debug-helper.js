// 调试助手工具
// 用于查看和管理缓存数据

/**
 * 打印所有缓存信息
 */
function printAllCache() {
  console.log('========== 缓存调试信息 ==========');
  
  // 获取所有缓存键
  const info = wx.getStorageInfoSync();
  console.log('缓存概览:');
  console.log('- 缓存大小:', info.currentSize, 'KB');
  console.log('- 缓存键数量:', info.keys.length);
  console.log('- 缓存键列表:', info.keys);
  
  console.log('\n缓存详情:');
  
  // 头像相关缓存
  console.log('\n[头像缓存]');
  console.log('- userAvatar:', wx.getStorageSync('userAvatar'));
  console.log('- cached_avatar_file_id:', wx.getStorageSync('cached_avatar_file_id'));
  console.log('- cached_user_avatar:', wx.getStorageSync('cached_user_avatar'));
  console.log('- avatar_cache_time:', new Date(wx.getStorageSync('avatar_cache_time')));
  
  // 用户信息缓存
  console.log('\n[用户信息缓存]');
  const userInfo = wx.getStorageSync('cached_user_info');
  console.log('- cached_user_info:', userInfo);
  if (userInfo) {
    console.log('  - nickName:', userInfo.nickName);
    console.log('  - avatar:', userInfo.avatar);
    console.log('  - department:', userInfo.department);
    console.log('  - roleGroup:', userInfo.roleGroup);
  }
  
  // 缓存时间
  const cacheTime = wx.getStorageSync('user_cache_time');
  if (cacheTime) {
    const now = Date.now();
    const age = now - cacheTime;
    const hours = Math.floor(age / (1000 * 60 * 60));
    const minutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));
    console.log('\n[缓存时间]');
    console.log('- 缓存创建时间:', new Date(cacheTime));
    console.log('- 缓存年龄:', `${hours}小时${minutes}分钟`);
    console.log('- 是否过期（24小时）:', age > 24 * 60 * 60 * 1000);
  }
  
  // 登录相关
  console.log('\n[登录信息]');
  console.log('- token:', wx.getStorageSync('token'));
  console.log('- openid:', wx.getStorageSync('openid'));
  console.log('- userInfo:', wx.getStorageSync('userInfo'));
  
  console.log('========== 缓存调试信息结束 ==========');
}

/**
 * 清除头像缓存
 */
function clearAvatarCache() {
  console.log('清除头像缓存...');
  wx.removeStorageSync('userAvatar');
  wx.removeStorageSync('cached_avatar_file_id');
  wx.removeStorageSync('cached_user_avatar');
  wx.removeStorageSync('avatar_cache_time');
  console.log('头像缓存已清除');
}

/**
 * 清除用户信息缓存
 */
function clearUserCache() {
  console.log('清除用户信息缓存...');
  wx.removeStorageSync('cached_user_info');
  wx.removeStorageSync('user_cache_time');
  console.log('用户信息缓存已清除');
}

/**
 * 清除所有缓存
 */
function clearAllCache() {
  console.log('清除所有缓存...');
  wx.clearStorageSync();
  console.log('所有缓存已清除');
}

/**
 * 检查头像文件是否存在
 */
async function checkAvatarFile(fileID) {
  if (!fileID) {
    console.log('文件ID为空');
    return false;
  }
  
  try {
    if (fileID.startsWith('cloud://')) {
      // 云存储文件
      const result = await wx.cloud.getTempFileURL({
        fileList: [fileID]
      });
      
      if (result.fileList && result.fileList.length > 0) {
        const file = result.fileList[0];
        console.log('云存储文件状态:');
        console.log('- FileID:', fileID);
        console.log('- 状态码:', file.status);
        console.log('- 临时URL:', file.tempFileURL);
        return file.status === 0;
      }
    } else {
      // 本地文件
      const fs = wx.getFileSystemManager();
      try {
        const stats = fs.statSync(fileID);
        console.log('本地文件状态:');
        console.log('- 路径:', fileID);
        console.log('- 大小:', stats.size, 'bytes');
        console.log('- 修改时间:', new Date(stats.lastModifiedTime));
        return true;
      } catch (e) {
        console.log('本地文件不存在:', fileID);
        return false;
      }
    }
  } catch (error) {
    console.error('检查文件失败:', error);
    return false;
  }
}

// 导出函数
module.exports = {
  printAllCache,
  clearAvatarCache,
  clearUserCache,
  clearAllCache,
  checkAvatarFile
}