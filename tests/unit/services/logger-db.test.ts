import { describe, it, expect } from 'bun:test';
import { truncateBody } from '../../../src/services/logger-db';

describe('truncateBody', () => {
  // null 输入应返回 null
  it('should return null for null input', () => {
    expect(truncateBody(null)).toBeNull();
  });

  // undefined 输入应返回 null
  it('should return null for undefined input', () => {
    expect(truncateBody(undefined)).toBeNull();
  });

  // 短字符串不应被截断
  it('should return short string unchanged', () => {
    expect(truncateBody('short')).toBe('short');
  });

  // 超过默认 maxSize (10240) 的长字符串应被截断并附加提示信息
  it('should truncate long string with default maxSize and append truncation message', () => {
    const longString = 'a'.repeat(20000);
    const result = truncateBody(longString);
    expect(result).toEndWith('[truncated, 20000 bytes total]');
    expect(result!.length).toBe(10240 + '[truncated, 20000 bytes total]'.length);
  });

  // 使用自定义 maxSize 参数截断字符串
  it('should truncate long string with custom maxSize', () => {
    const longString = 'a'.repeat(20000);
    const result = truncateBody(longString, 5000);
    expect(result).toEndWith('[truncated, 20000 bytes total]');
    expect(result!.length).toBe(5000 + '[truncated, 20000 bytes total]'.length);
  });

  // 空字符串应保持不变
  it('should return empty string unchanged', () => {
    expect(truncateBody('')).toBe('');
  });

  // 恰好等于边界值的字符串不应被截断
  it('should not truncate string exactly at boundary (10240 bytes)', () => {
    const boundaryString = 'a'.repeat(10240);
    expect(truncateBody(boundaryString)).toBe(boundaryString);
  });

  // 刚好超过边界值的字符串应被截断
  it('should truncate string just over boundary (10241 bytes)', () => {
    const overBoundaryString = 'a'.repeat(10241);
    const result = truncateBody(overBoundaryString);
    expect(result).not.toBe(overBoundaryString);
    expect(result).toEndWith('[truncated, 10241 bytes total]');
  });
});
