// 查询优化工具类
class QueryOptimizer {
  constructor(db) {
    this.db = db;
    this._ = db.command;
  }

  /**
   * 构建优化的权限查询条件
   * @param {string} roleGroup - 用户角色组
   * @param {string} openid - 用户openid
   * @param {string} assigneeFilter - 负责人筛选条件
   * @returns {object} 查询条件
   */
  buildPermissionQuery(roleGroup, openid, assigneeFilter = 'all') {
    const _ = this._;
    
    // 用户角色：返回不可能的条件，快速返回空结果
    if (roleGroup === '用户') {
      return { _id: _.eq(null) }; // 更高效的空结果查询
    }
    
    // 经理角色：根据筛选条件返回
    if (roleGroup === '经理') {
      switch(assigneeFilter) {
        case 'my':
          return { assigneeOpenid: openid };
        case 'unassigned':
          return this.getUnassignedQuery();
        case 'all':
          return {}; // 经理看所有
        default:
          // 特定工程师
          return { assigneeOpenid: assigneeFilter };
      }
    }
    
    // 工程师角色
    if (roleGroup === '工程师') {
      switch(assigneeFilter) {
        case 'my':
          return { assigneeOpenid: openid };
        case 'unassigned':
          return this.getUnassignedQuery();
        case 'all':
          // 使用更高效的查询结构
          return _.or([
            { assigneeOpenid: openid },
            this.getUnassignedQuery()
          ]);
        default:
          return { assigneeOpenid: openid };
      }
    }
    
    return {};
  }
  
  /**
   * 获取未分配工单的查询条件
   * @returns {object} 查询条件
   */
  getUnassignedQuery() {
    const _ = this._;
    // 简化未分配查询，只检查一个条件
    return _.or([
      { assigneeOpenid: '' },
      { assigneeOpenid: _.exists(false) }
    ]);
  }
  
  /**
   * 构建状态筛选查询
   * @param {string} filter - 筛选条件
   * @returns {object} 查询条件
   */
  buildStatusQuery(filter) {
    const _ = this._;
    
    const statusMap = {
      'all': { status: _.nin(['resolved', 'closed']) },
      'pending': { status: 'pending' },
      'processing': { status: 'processing' },
      'resolved': { status: 'resolved' },
      'closed': { status: 'closed' },
      'urgent': { 
        priority: 'urgent',
        status: _.nin(['resolved', 'closed'])
      }
    };
    
    return statusMap[filter] || {};
  }
  
  /**
   * 构建搜索查询
   * @param {string} keyword - 搜索关键词
   * @returns {object} 查询条件
   */
  buildSearchQuery(keyword) {
    if (!keyword) return {};
    
    // 使用正则表达式优化搜索
    const regex = this.db.RegExp({
      regexp: keyword,
      options: 'i'
    });
    
    return this._.or([
      { ticketNo: regex },
      { title: regex }
      // 移除description搜索以提高性能
    ]);
  }
  
  /**
   * 合并多个查询条件
   * @param {Array} conditions - 查询条件数组
   * @returns {object} 合并后的查询条件
   */
  mergeConditions(conditions) {
    const validConditions = conditions.filter(c => 
      c && Object.keys(c).length > 0
    );
    
    if (validConditions.length === 0) return {};
    if (validConditions.length === 1) return validConditions[0];
    
    return this._.and(validConditions);
  }
}

module.exports = QueryOptimizer;