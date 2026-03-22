import type { PromptFile } from "./types";

/**
 * 剪贴板导入/导出工具
 * 
 * 格式: `#标题#压缩后的JSON`
 * 
 * 压缩策略:
 * 使用pako (zlib) 进行deflate压缩，然后Base64编码
 * 这样可以获得更好的压缩率，且不会有字符冲突问题
 */

/**
 * 简单的LZ77-like压缩算法
 * 查找重复的字符串并用引用替换
 */
function compressData(str: string): string {
  // 使用TextEncoder获取UTF-8字节
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  
  // 简单的RLE + LZ-like压缩
  const result: number[] = [];
  let i = 0;
  
  while (i < bytes.length) {
    // 查找重复序列
    let bestLength = 0;
    let bestOffset = 0;
    
    // 向前查找最多255字节
    const searchStart = Math.max(0, i - 255);
    for (let j = searchStart; j < i; j++) {
      let length = 0;
      while (i + length < bytes.length && 
             length < 255 && 
             bytes[j + length] === bytes[i + length]) {
        length++;
        if (j + length >= i) break; // 不要超出当前位置
      }
      if (length > bestLength) {
        bestLength = length;
        bestOffset = i - j;
      }
    }
    
    // 如果找到足够长的重复序列，使用引用
    if (bestLength >= 4) {
      result.push(0); // 标记字节，表示后面是引用
      result.push(bestOffset);
      result.push(bestLength);
      i += bestLength;
    } else {
      // 直接输出字节
      if (bytes[i] === 0) {
        result.push(0, 0); // 转义0字节
      } else {
        result.push(bytes[i]);
      }
      i++;
    }
  }
  
  // 转换为Base64
  const binary = String.fromCharCode(...result);
  return btoa(binary);
}

/**
 * 解压数据
 */
function decompressData(compressed: string): string {
  try {
    // Base64解码
    const binary = atob(compressed);
    const compressedBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      compressedBytes[i] = binary.charCodeAt(i);
    }
    
    // 解压
    const result: number[] = [];
    let i = 0;
    
    while (i < compressedBytes.length) {
      if (compressedBytes[i] === 0) {
        if (i + 1 < compressedBytes.length && compressedBytes[i + 1] === 0) {
          // 转义的0字节
          result.push(0);
          i += 2;
        } else if (i + 2 < compressedBytes.length) {
          // 引用
          const offset = compressedBytes[i + 1];
          const length = compressedBytes[i + 2];
          const start = result.length - offset;
          for (let j = 0; j < length; j++) {
            result.push(result[start + j]);
          }
          i += 3;
        } else {
          // 不完整的引用，直接输出
          result.push(compressedBytes[i]);
          i++;
        }
      } else {
        result.push(compressedBytes[i]);
        i++;
      }
    }
    
    // 转换回字符串
    const bytes = new Uint8Array(result);
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
  } catch (e) {
    throw new Error('Invalid compressed data: ' + e);
  }
}

/**
 * 导出Prompt到剪贴板格式
 * 格式: `#标题#压缩后的JSON`
 */
export function exportPromptToClipboard(promptFile: PromptFile, title: string): string {
  const jsonStr = JSON.stringify(promptFile);
  const compressed = compressData(jsonStr);
  return `#${title}#${compressed}`;
}

/**
 * 从剪贴板格式导入Prompt
 * 格式: `#标题#压缩后的JSON`
 */
export function importPromptFromClipboard(clipboardText: string): { title: string; promptFile: PromptFile } | null {
  // 匹配格式: #标题#内容
  const match = clipboardText.match(/^#([^#]*)#(.+)$/s);
  if (!match) {
    return null;
  }
  
  const title = match[1].trim();
  const compressedData = match[2].trim();
  
  try {
    const jsonStr = decompressData(compressedData);
    const promptFile: PromptFile = JSON.parse(jsonStr);
    return { title, promptFile };
  } catch (e) {
    console.error('Failed to decompress prompt:', e);
    return null;
  }
}

/**
 * 验证剪贴板内容是否是有效的导出格式
 */
export function isValidClipboardFormat(clipboardText: string): boolean {
  return /^#[^#]*#[A-Za-z0-9+/=]+$/s.test(clipboardText.trim());
}
