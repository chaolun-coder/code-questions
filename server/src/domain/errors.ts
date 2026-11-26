/**
 * 领域错误类型。
 *
 * 业务校验失败统一抛出 AppError，由全局 onError 转换为对应 HTTP 状态码。
 */

/** 业务错误，携带 HTTP 状态码 */
export class AppError extends Error {
  readonly status: 400 | 404 | 409;

  constructor(message: string, status: 400 | 404 | 409 = 400) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}
