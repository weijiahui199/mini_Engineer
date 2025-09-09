/**
 * 将云存储 fileID 或其它路径转换为可用于 <image src> 的可展示 URL。
 * - cloud://xxx → 通过 wx.cloud.getTempFileURL 转为 https 临时链接
 * - http/https/wxfile 等 → 原样返回
 * - 支持拼接版本参数 ?v=version 以规避缓存
 */

function appendVersion(url, version) {
  if (!url) return '';
  if (!version) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${version}`;
}

async function getDisplayUrl(fileId, version) {
  try {
    if (!fileId) return '';
    // 云存储 fileID → 临时URL
    if (typeof fileId === 'string' && fileId.startsWith('cloud://')) {
      const res = await wx.cloud.getTempFileURL({ fileList: [fileId] });
      const tmp = res.fileList && res.fileList[0] && res.fileList[0].tempFileURL ? res.fileList[0].tempFileURL : '';
      return appendVersion(tmp, version);
    }
    // 其它情况（http/https/wxfile本地路径等）直接返回，按需拼版本
    return appendVersion(fileId, version);
  } catch (e) {
    console.warn('[display-url] 转换展示URL失败:', e);
    return '';
  }
}

module.exports = { getDisplayUrl };

