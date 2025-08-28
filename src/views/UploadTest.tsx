import { html } from 'hono/html'

export const UploadTestPage = () => {
  return html`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>文件上传测试 - Bun Hono Server</title>
    <style>
        body { font-family: system-ui; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; color: #333; }
        .test-section { margin: 30px 0; padding: 20px; border: 2px dashed #ddd; border-radius: 8px; }
        .btn { background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin: 5px; }
        .btn:hover { background: #0056b3; }
        .result { margin: 15px 0; padding: 15px; border-radius: 6px; display: none; }
        .result.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .result.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        input[type="file"] { margin: 10px 0; padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 100%; }
        .loading { display: none; text-align: center; margin: 20px 0; }
        .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #007bff; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 文件上传测试</h1>
            <p>Bun + Hono 文件上传功能测试</p>
        </div>

        <div class="test-section">
            <h3>📄 单文件上传测试</h3>
            <input type="file" id="singleFile" accept="image/*,.txt,.pdf">
            <button class="btn" onclick="uploadSingle()">上传文件</button>
            <button class="btn" onclick="getTypes()">获取支持类型</button>
            <div class="loading" id="singleLoading"><div class="spinner"></div><p>上传中...</p></div>
            <div class="result" id="singleResult"></div>
        </div>

        <div class="test-section">
            <h3>📁 多文件上传测试</h3>
            <input type="file" id="multipleFiles" multiple accept="image/*,.txt">
            <button class="btn" onclick="uploadMultiple()">批量上传</button>
            <button class="btn" onclick="clearResults()">清空结果</button>
            <div class="loading" id="multipleLoading"><div class="spinner"></div><p>批量上传中...</p></div>
            <div class="result" id="multipleResult"></div>
        </div>

        <div class="test-section">
            <h3>🔗 API 测试</h3>
            <button class="btn" onclick="testHealth()">健康检查</button>
            <button class="btn" onclick="testInfo()">服务器信息</button>
            <div class="result" id="apiResult"></div>
        </div>
    </div>

    <script>
        function showResult(id, success, message, data = null) {
            const el = document.getElementById(id);
            el.className = \`result \${success ? 'success' : 'error'}\`;
            let content = \`<strong>\${success ? '✅ 成功' : '❌ 失败'}:</strong> \${message}\`;
            if (data) content += \`<br><pre>\${JSON.stringify(data, null, 2)}</pre>\`;
            el.innerHTML = content;
            el.style.display = 'block';
        }

        function showLoading(id, show) {
            document.getElementById(id).style.display = show ? 'block' : 'none';
        }

        async function uploadSingle() {
            const file = document.getElementById('singleFile').files[0];
            if (!file) return showResult('singleResult', false, '请选择文件');
            
            showLoading('singleLoading', true);
            const formData = new FormData();
            formData.append('file', file);
            
            try {
                const response = await fetch('/api/upload/single', { method: 'POST', body: formData });
                const result = await response.json();
                showResult('singleResult', response.ok, response.ok ? '上传成功' : result.message, result);
            } catch (error) {
                showResult('singleResult', false, '网络错误: ' + error.message);
            } finally {
                showLoading('singleLoading', false);
            }
        }

        async function uploadMultiple() {
            const files = document.getElementById('multipleFiles').files;
            if (files.length === 0) return showResult('multipleResult', false, '请选择文件');
            
            showLoading('multipleLoading', true);
            const formData = new FormData();
            Array.from(files).forEach(file => formData.append('files', file));
            
            try {
                const response = await fetch('/api/upload/multiple', { method: 'POST', body: formData });
                const result = await response.json();
                showResult('multipleResult', response.ok, response.ok ? \`上传 \${files.length} 个文件成功\` : result.message, result);
            } catch (error) {
                showResult('multipleResult', false, '网络错误: ' + error.message);
            } finally {
                showLoading('multipleLoading', false);
            }
        }

        async function getTypes() {
            try {
                const response = await fetch('/api/upload/types');
                const result = await response.json();
                showResult('singleResult', response.ok, '获取文件类型成功', result);
            } catch (error) {
                showResult('singleResult', false, '网络错误: ' + error.message);
            }
        }

        async function testHealth() {
            try {
                const response = await fetch('/api/health');
                const result = await response.json();
                showResult('apiResult', response.ok, '健康检查完成', result);
            } catch (error) {
                showResult('apiResult', false, '健康检查失败: ' + error.message);
            }
        }

        async function testInfo() {
            try {
                const response = await fetch('/api');
                const result = await response.json();
                showResult('apiResult', response.ok, '获取服务器信息成功', result);
            } catch (error) {
                showResult('apiResult', false, '获取服务器信息失败: ' + error.message);
            }
        }

        function clearResults() {
            document.querySelectorAll('.result').forEach(el => el.style.display = 'none');
        }

        console.log('🚀 文件上传测试页面已加载');
    </script>
</body>
</html>
  `
}