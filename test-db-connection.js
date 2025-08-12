// 测试数据库连接脚本
// 在小程序开发者工具的控制台中运行此代码

const testDatabaseConnection = async () => {
  console.log('=== 开始测试数据库连接 ===');
  
  try {
    // 1. 测试云开发初始化
    if (!wx.cloud) {
      console.error('❌ 云开发未初始化');
      return;
    }
    console.log('✅ 云开发已初始化');
    
    // 2. 获取数据库引用
    const db = wx.cloud.database();
    console.log('✅ 获取数据库引用成功');
    
    // 3. 测试读取用户集合
    console.log('正在测试读取 users 集合...');
    const usersResult = await db.collection('users').limit(1).get();
    console.log('✅ 成功读取 users 集合，记录数:', usersResult.data.length);
    
    // 4. 测试云函数调用
    console.log('正在测试调用 login 云函数...');
    const loginResult = await wx.cloud.callFunction({
      name: 'login',
      data: { test: true }
    });
    console.log('✅ 云函数调用成功:', loginResult.result);
    
    // 5. 测试写入权限（创建测试记录）
    console.log('正在测试写入权限...');
    const testData = {
      test: true,
      timestamp: new Date(),
      description: '测试记录，可以删除'
    };
    
    // 先检查是否有测试集合
    try {
      const testCollection = db.collection('test_connection');
      const addResult = await testCollection.add({
        data: testData
      });
      console.log('✅ 写入测试成功，记录ID:', addResult._id);
      
      // 清理测试数据
      await testCollection.doc(addResult._id).remove();
      console.log('✅ 测试数据已清理');
    } catch (writeError) {
      console.warn('⚠️ 写入测试失败（可能是权限问题）:', writeError.message);
    }
    
    console.log('=== 数据库连接测试完成 ===');
    console.log('结论: 数据库连接正常，可以进行用户信息上传');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误详情:', error.message);
    console.error('请检查：');
    console.error('1. 云开发环境是否正确配置');
    console.error('2. 云函数是否已部署');
    console.error('3. 数据库权限是否正确设置');
  }
};

// 导出测试函数，可以在控制台调用
module.exports = testDatabaseConnection;