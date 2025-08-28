#!/bin/bash

# 文件上传功能测试脚本
# 这个脚本演示了如何使用curl测试文件上传API

# 配置
BASE_URL="http://localhost:4778"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  # 替换为实际的JWT token

# 颜色输出
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

echo -e "${BLUE}🚀 文件上传功能测试脚本${NC}"
echo "=================================="

# 创建测试文件
echo -e "${YELLOW}📁 创建测试文件...${NC}"
mkdir -p test-files

# 创建测试文本文件
echo "这是一个测试文本文件。" > test-files/test.txt

# 创建简单的HTML文件（用于测试安全检查）
cat > test-files/test.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Test</title>
</head>
<body>
    <h1>Hello World</h1>
</body>
</html>
EOF

# 如果有imagemagick，创建测试图片
if command -v convert &> /dev/null; then
    echo -e "${GREEN}✅ 使用ImageMagick创建测试图片...${NC}"
    convert -size 800x600 xc:skyblue -fill navy -pointsize 30 -gravity center -annotate +0+0 "Test Image" test-files/test.jpg
    convert -size 1200x900 xc:lightgreen -fill darkgreen -pointsize 40 -gravity center -annotate +0+0 "Large Test Image" test-files/large.jpg
else
    echo -e "${YELLOW}⚠️  ImageMagick未安装，跳过图片创建${NC}"
fi

echo ""

# 函数：执行API请求并显示结果
test_api() {
    local description="$1"
    local curl_command="$2"
    
    echo -e "${BLUE}📡 测试: $description${NC}"
    echo "命令: $curl_command"
    echo ""
    
    response=$(eval $curl_command)
    echo "响应: $response"
    
    # 检查响应是否成功
    if echo "$response" | grep -q '"code":200'; then
        echo -e "${GREEN}✅ 成功${NC}"
    else
        echo -e "${RED}❌ 失败${NC}"
    fi
    
    echo ""
    echo "----------------------------------------"
    echo ""
}

# 1. 获取上传配置
test_api "获取上传配置" \\
"curl -s -X GET '$BASE_URL/api/upload/config' \\
    -H 'Authorization: Bearer $TOKEN' \\
    -H 'Content-Type: application/json'"

# 2. 单文件上传 - 文本文件
if [ -f "test-files/test.txt" ]; then
    test_api "上传文本文件" \\
    "curl -s -X POST '$BASE_URL/api/upload/single' \\
        -H 'Authorization: Bearer $TOKEN' \\
        -F 'file=@test-files/test.txt'"
fi

# 3. 单文件上传 - 图片文件（如果存在）
if [ -f "test-files/test.jpg" ]; then
    test_api "上传图片文件" \\
    "curl -s -X POST '$BASE_URL/api/upload/single' \\
        -H 'Authorization: Bearer $TOKEN' \\
        -F 'file=@test-files/test.jpg'"
    
    # 4. 图片处理 - 压缩和格式转换
    test_api "图片压缩和格式转换" \\
    "curl -s -X POST '$BASE_URL/api/upload/single' \\
        -H 'Authorization: Bearer $TOKEN' \\
        -F 'file=@test-files/test.jpg' \\
        -F 'quality=80' \\
        -F 'format=webp'"
    
    # 5. 图片尺寸调整
    test_api "图片尺寸调整" \\
    "curl -s -X POST '$BASE_URL/api/upload/single' \\
        -H 'Authorization: Bearer $TOKEN' \\
        -F 'file=@test-files/test.jpg' \\
        -F 'resize_width=400' \\
        -F 'resize_height=300' \\
        -F 'keep_aspect_ratio=true'"
    
    # 6. 生成缩略图
    test_api "生成缩略图" \\
    "curl -s -X POST '$BASE_URL/api/upload/single' \\
        -H 'Authorization: Bearer $TOKEN' \\
        -F 'file=@test-files/test.jpg' \\
        -F 'generate_thumbnail=true' \\
        -F 'thumbnail_width=150' \\
        -F 'thumbnail_height=150'"
fi

# 7. 大文件自动优化（如果存在）
if [ -f "test-files/large.jpg" ]; then
    test_api "大文件自动优化" \\
    "curl -s -X POST '$BASE_URL/api/upload/single' \\
        -H 'Authorization: Bearer $TOKEN' \\
        -F 'file=@test-files/large.jpg' \\
        -F 'auto_optimize=true' \\
        -F 'target_size=500000'"
fi

# 8. 多文件上传
if [ -f "test-files/test.txt" ] && [ -f "test-files/test.html" ]; then
    test_api "多文件上传" \\
    "curl -s -X POST '$BASE_URL/api/upload/multiple' \\
        -H 'Authorization: Bearer $TOKEN' \\
        -F 'file=@test-files/test.txt' \\
        -F 'file=@test-files/test.html' \\
        -F 'quality=75'"
fi

# 9. 自定义路径上传
if [ -f "test-files/test.txt" ]; then
    test_api "自定义路径上传" \\
    "curl -s -X POST '$BASE_URL/api/upload/single' \\
        -H 'Authorization: Bearer $TOKEN' \\
        -F 'file=@test-files/test.txt' \\
        -F 'path=custom-folder'"
fi

# 10. 安全测试 - 尝试上传可执行文件
echo "#!/bin/bash" > test-files/malicious.sh
echo "echo 'This is a test script'" >> test-files/malicious.sh

test_api "安全测试 - 尝试上传脚本文件（应该被拒绝）" \\
"curl -s -X POST '$BASE_URL/api/upload/single' \\
    -H 'Authorization: Bearer $TOKEN' \\
    -F 'file=@test-files/malicious.sh'"

# 11. 安全测试 - 文件名包含危险字符
echo "test content" > "test-files/dangerous<script>.txt"

test_api "安全测试 - 危险文件名（应该被拒绝）" \\
"curl -s -X POST '$BASE_URL/api/upload/single' \\
    -H 'Authorization: Bearer $TOKEN' \\
    -F 'file=@test-files/dangerous<script>.txt'"

# 12. 测试文件信息获取（需要先上传一个文件获取路径）
echo -e "${BLUE}📡 测试: 获取文件信息${NC}"
echo "首先上传一个文件..."

upload_response=$(curl -s -X POST "$BASE_URL/api/upload/single" \\
    -H "Authorization: Bearer $TOKEN" \\
    -F "file=@test-files/test.txt")

# 从响应中提取文件路径
file_path=$(echo "$upload_response" | grep -o '"path":"[^"]*"' | cut -d'"' -f4)

if [ ! -z "$file_path" ]; then
    echo "文件路径: $file_path"
    
    test_api "获取文件信息" \\
    "curl -s -X GET '$BASE_URL/api/upload/info/$file_path' \\
        -H 'Authorization: Bearer $TOKEN'"
    
    test_api "检查文件是否存在" \\
    "curl -s -X GET '$BASE_URL/api/upload/exists/$file_path' \\
        -H 'Authorization: Bearer $TOKEN'"
    
    test_api "删除文件" \\
    "curl -s -X DELETE '$BASE_URL/api/upload/$file_path' \\
        -H 'Authorization: Bearer $TOKEN'"
    
    test_api "再次检查文件是否存在（应该不存在）" \\
    "curl -s -X GET '$BASE_URL/api/upload/exists/$file_path' \\
        -H 'Authorization: Bearer $TOKEN'"
else
    echo -e "${RED}❌ 无法获取文件路径，跳过文件操作测试${NC}"
fi

# 13. 错误测试 - 无效token
test_api "错误测试 - 无效token（应该返回401）" \\
"curl -s -X GET '$BASE_URL/api/upload/config' \\
    -H 'Authorization: Bearer invalid-token'"

# 14. 错误测试 - 缺少文件
test_api "错误测试 - 缺少文件（应该返回400）" \\
"curl -s -X POST '$BASE_URL/api/upload/single' \\
    -H 'Authorization: Bearer $TOKEN'"

# 15. 错误测试 - 错误的Content-Type
test_api "错误测试 - 错误的Content-Type（应该返回400）" \\
"curl -s -X POST '$BASE_URL/api/upload/single' \\
    -H 'Authorization: Bearer $TOKEN' \\
    -H 'Content-Type: application/json' \\
    -d '{\"test\": \"data\"}'"

echo -e "${BLUE}🧹 清理测试文件...${NC}"
rm -rf test-files/

echo -e "${GREEN}✅ 测试完成！${NC}"
echo ""
echo -e "${YELLOW}💡 提示:${NC}"
echo "1. 确保服务器运行在 $BASE_URL"
echo "2. 替换脚本中的 TOKEN 为有效的JWT token"
echo "3. 检查 .env 文件中的上传配置"
echo "4. 查看服务器日志了解详细信息"