/**
 * 基于 Fuse.js 的搜索管理器
 * 实现工单的本地快速搜索
 */

class SearchManager {
  constructor() {
    this.fuse = null;
    this.ticketCache = [];
    this.isInitialized = false;
  }
  
  /**
   * 初始化搜索索引
   * @param {Array} tickets 工单列表
   */
  initSearch(tickets) {
    if (!tickets || tickets.length === 0) {
      console.log('[SearchManager] 无数据，跳过初始化');
      this.ticketCache = [];
      this.isInitialized = false;
      return;
    }
    
    this.ticketCache = tickets;
    
    // 动态加载搜索引擎
    try {
      let SearchEngine;
      let engineType = 'unknown';
      
      // 尝试加载 Fuse.js
      try {
        // 尝试不同的 Fuse.js 路径
        try {
          // 方式1：使用本地版本（推荐，避免 npm 构建问题）
          SearchEngine = require('./fuse-local');
          engineType = 'fuse-local';
          console.log('[SearchManager] ✅ 使用 Fuse.js 搜索引擎（本地版本）');
        } catch (e1) {
          try {
            // 方式2：标准 npm 包导入（需要构建 npm）
            SearchEngine = require('fuse.js');
            engineType = 'fuse-npm-standard';
            console.log('[SearchManager] ✅ 使用 Fuse.js 搜索引擎（npm）');
          } catch (e2) {
            try {
              // 方式3：从 miniprogram_npm 加载（构建后的具体路径）
              SearchEngine = require('../miniprogram_npm/fuse.js/index');
              engineType = 'fuse-npm-built';
              console.log('[SearchManager] ✅ 使用 Fuse.js 搜索引擎（miniprogram_npm）');
            } catch (e3) {
              // 如果都失败，使用备用的简单搜索
              SearchEngine = require('./simple-search');
              engineType = 'simple-search';
              console.warn('[SearchManager] ⚠️ Fuse.js 加载失败，使用简单搜索引擎');
            }
          }
        }
      } catch (loadError) {
        // 最终备用方案
        SearchEngine = require('./simple-search');
        engineType = 'simple-search-fallback';
        console.warn('[SearchManager] ⚠️ 使用备用搜索引擎:', loadError.message);
      }
      
      // 基础配置：只搜索最重要的字段
      const options = {
        keys: [
          { name: 'ticketNo', weight: 2.0 },      // 工单号权重最高
          { name: 'title', weight: 1.5 },         // 标题次之
          { name: 'submitter', weight: 1.0 },     // 提交人
          { name: 'submitterName', weight: 1.0 }, // 兼容字段名
          { name: 'assigneeName', weight: 1.2 },  // 负责人名字（重要）
          { name: 'company', weight: 0.8 },       // 公司
          { name: 'location', weight: 0.7 },      // 位置
          { name: 'category', weight: 0.6 }       // 分类
        ],
        threshold: 0.4,        // 相似度阈值（0.0 = 完全匹配，1.0 = 匹配任何内容）
        includeScore: true,    // 包含匹配分数
        minMatchCharLength: 2, // 最小匹配字符长度
        shouldSort: true,      // 按相关性排序
        findAllMatches: false, // 找到一个好的匹配就停止
        ignoreLocation: true   // 忽略匹配位置（提高性能）
      };
      
      this.fuse = new SearchEngine(tickets, options);
      this.isInitialized = true;
      
      console.log('[SearchManager] 初始化成功，使用引擎:', engineType, '，索引了', tickets.length, '条工单');
      
    } catch (error) {
      console.error('[SearchManager] 初始化失败:', error);
      this.isInitialized = false;
    }
  }
  
  /**
   * 执行搜索
   * @param {String} keyword 搜索关键词
   * @returns {Array} 搜索结果
   */
  search(keyword) {
    console.log('[SearchManager.search] 搜索关键词:', keyword);
    console.log('[SearchManager.search] 当前状态:', {
      isInitialized: this.isInitialized,
      hasFuse: !!this.fuse,
      cacheSize: this.ticketCache.length
    });
    
    // 空关键词返回所有数据
    if (!keyword || keyword.trim() === '') {
      console.log('[SearchManager.search] 空关键词，返回所有数据');
      return this.ticketCache;
    }
    
    keyword = keyword.trim();
    
    // 如果没有初始化，返回空数组
    if (!this.isInitialized || !this.fuse) {
      console.warn('[SearchManager] 搜索引擎未初始化');
      return [];
    }
    
    // 工单号精确匹配（支持部分匹配）
    if (/^TK\d+/i.test(keyword)) {
      // 先尝试精确匹配
      const exactMatch = this.ticketCache.filter(ticket => 
        ticket.ticketNo && ticket.ticketNo.toLowerCase() === keyword.toLowerCase()
      );
      
      if (exactMatch.length > 0) {
        return exactMatch;
      }
      
      // 如果没有精确匹配，尝试包含匹配
      const partialMatch = this.ticketCache.filter(ticket => 
        ticket.ticketNo && ticket.ticketNo.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (partialMatch.length > 0) {
        return partialMatch;
      }
    }
    
    // 使用 Fuse.js 进行模糊搜索
    try {
      const results = this.fuse.search(keyword);
      
      // 返回搜索结果，按相关性排序
      const searchResults = results.map(result => result.item);
      
      console.log('[SearchManager] 搜索"' + keyword + '"，找到', searchResults.length, '条结果');
      
      return searchResults;
      
    } catch (error) {
      console.error('[SearchManager] 搜索出错:', error);
      return [];
    }
  }
  
  /**
   * 更新单个工单
   * @param {Object} ticket 工单对象
   */
  updateTicket(ticket) {
    if (!ticket || !ticket.id) return;
    
    // 更新缓存中的工单
    const index = this.ticketCache.findIndex(t => t.id === ticket.id);
    if (index !== -1) {
      this.ticketCache[index] = ticket;
      
      // 重建索引
      this.initSearch(this.ticketCache);
    }
  }
  
  /**
   * 添加工单
   * @param {Object} ticket 工单对象
   */
  addTicket(ticket) {
    if (!ticket || !ticket.id) return;
    
    this.ticketCache.push(ticket);
    
    // 重建索引
    this.initSearch(this.ticketCache);
  }
  
  /**
   * 删除工单
   * @param {String} ticketId 工单ID
   */
  removeTicket(ticketId) {
    if (!ticketId) return;
    
    this.ticketCache = this.ticketCache.filter(t => t.id !== ticketId);
    
    // 重建索引
    this.initSearch(this.ticketCache);
  }
  
  /**
   * 清空搜索缓存
   */
  clear() {
    this.ticketCache = [];
    this.fuse = null;
    this.isInitialized = false;
  }
  
  /**
   * 获取缓存的工单数量
   */
  getTicketCount() {
    return this.ticketCache.length;
  }
  
  /**
   * 获取所有缓存的工单
   */
  getAllTickets() {
    return this.ticketCache;
  }
}

// 导出
module.exports = SearchManager;