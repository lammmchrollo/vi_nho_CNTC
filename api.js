'use strict';

const Api = (() => {
  async function request(path, method = 'GET', body) {
    let response;
    try {
      response = await fetch('/api/' + path, {
        method, credentials: 'same-origin', cache: 'no-store',
        headers: body === undefined ? {} : {'Content-Type': 'application/json'},
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch {
      throw new Error('Không kết nối được máy chủ. Kiểm tra ứng dụng đang chạy bằng npm start rồi thử lại.');
    }
    let result;
    try { result = await response.json(); }
    catch { throw new Error('Máy chủ trả về dữ liệu không hợp lệ. Hãy chạy ứng dụng bằng npm start.'); }
    if (!response.ok) {
      const error = new Error(result.error?.message || result.message || 'Thao tác chưa thành công. Vui lòng thử lại.');
      error.status = response.status;
      error.payload = result;
      throw error;
    }
    return result;
  }
  return {request};
})();
