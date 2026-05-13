/** 用户账户 */
export interface User {
  /** 自增主键 */
  id: number;
  /** 用户名（唯一） */
  username: string;
  /** bcrypt 密码哈希 */
  password_hash: string;
  /** 密码最后修改时间（Unix 时间戳，秒），null 表示从未修改 */
  password_updated_at: number | null;
  /** 创建时间（Unix 时间戳，秒） */
  created_at: number;
  /** 更新时间（Unix 时间戳，秒） */
  updated_at: number;
}

/** 管理员 */
export interface Administrator {
  /** 关联 users 表的外键 */
  user_id: number;
  /** 提权时间（Unix 时间戳，秒） */
  promoted_at: number;
}

/** API 密钥（对外认证用） */
export interface ApiKey {
  /** 自增主键 */
  id: number;
  /** bcrypt 哈希后的密钥值 */
  key_hash: string;
  /** 密钥前缀，用于 UI 展示（如 "sk-a1b2c"） */
  key_prefix: string;
  /** 密钥描述/备注 */
  description: string | null;
  /** 创建时间（Unix 时间戳，秒） */
  created_at: number;
  /** 是否启用（1=启用，0=禁用） */
  is_active: number;
}

/** Router 多模型网关配置 */
export interface RouterModel {
  /** 自增主键 */
  id: number;
  /** 模型名称（唯一，对外暴露的名字） */
  name: string;
  /** 模型 variant 类型（如 "openai"） */
  variant: string;
  /** 上游 API 基础 URL */
  base_url: string;
  /** 上游实际调用的模型名 */
  model: string;
  /** 上游 API 密钥（明文存储） */
  api_key: string | null;
  /** 额外配置选项（JSON 字符串） */
  options: string | null;
  /** 创建时间（Unix 时间戳，秒） */
  created_at: number;
  /** 更新时间（Unix 时间戳，秒） */
  updated_at: number;
}

/** Chat 角色/助手配置 */
export interface Assistor {
  /** 自增主键 */
  id: number;
  /** 角色名称 */
  name: string;
  /** 使用的模型名 */
  model: string;
  /** 系统提示词 */
  system_prompt: string;
  /** 创建者用户 ID */
  created_by: number;
  /** 创建时间（Unix 时间戳，秒） */
  created_at: number;
  /** 更新时间（Unix 时间戳，秒） */
  updated_at: number;
}

/** JWT Token 载荷 */
export interface JwtPayload {
  /** 用户 ID */
  sub: number;
  /** 用户名 */
  username: string;
  /** 签发时间（Unix 时间戳，秒） */
  iat: number;
  /** 过期时间（Unix 时间戳，秒） */
  exp: number;
}

/** 系统配置键值对 */
export interface Settings {
  /** 配置键 */
  key: string;
  /** 配置值 */
  value: string;
}

/** 用户注册请求 */
export interface RegisterRequest {
  /** 用户名（3-32 字符，字母数字下划线） */
  username: string;
  /** 密码（6+ 字符） */
  password: string;
}

/** 用户登录请求 */
export interface LoginRequest {
  /** 用户名 */
  username: string;
  /** 密码 */
  password: string;
}
