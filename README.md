# 常順地產值班key進出系統

## 📁 文件结构

```
常順地產網站/
├── index.html      (18 KB)  - HTML 结构
├── styles.css      (45 KB)  - 所有样式
├── script.js       (201 KB) - 所有功能
└── README.md       - 说明文档
```

## 🔧 最近更新

### 2025/10/15 - v2.1

#### ✅ 电话号码完整保留
**改进**：确保同业电话号码完整保留十码（包括前导0）

**前端优化**：
- 新增 `cleanPhoneNumber()` 函数，处理从 Google Sheets 读取的电话号码
- 自动去除可能的单引号前缀
- 确保显示时保持完整的十码格式

**发送到 Google Sheets**：
- 系统自动在电话号码前加上单引号（`colleaguePhoneForSheets` 字段）
- 例如：`0912-345-678` → `'0912-345-678`

#### ✅ 新增 key 名稱功能改进
**改进**：开发业务选项包含所有成员
- ✅ 一般成員（01-26）全部可选
- ✅ 主管（90-94）全部可选
- ✅ 分组显示，清晰易选
- ✅ 显示格式：编号 + 姓名（例如：01 以蓁、90 徐店東）

#### ✅ Google Sheets 功能加密
**新增**：Sheets 相关功能密码保护
- 🔐 從 Sheets 同步 - 需要密码
- 🔐 開啟 Sheets - 需要密码
- 提升数据安全性

### 2025/10/14 - v2.0

#### ✅ 代码分离
- 将 6,613 行的单文件拆分为 3 个文件
- 提升可维护性和加载性能

#### ✅ 新增公司品牌
在同业借出功能中添加以下品牌：
- 太平洋不動產
- 全國不動產
- 美祺不動產
- 屋主交代取回
- 台慶房屋

#### ✅ 修复电话号码问题
**问题**：同业电话号码在 Google Sheets 中前导 0 被删除
- 例如：`0912-345-678` → `912-345-678` ❌

**解决方案**：
- 在 `script.js` 中添加 `colleaguePhoneForSheets` 字段
- 电话号码前自动加上单引号 `'`，强制 Google Sheets 视为文本

**Google Apps Script 端设置**：

⚠️ **重要**：在您的 Google Apps Script 代码中，必须使用 `colleaguePhoneForSheets` 字段来保存电话号码！

```javascript
// Apps Script 中处理鑰匙记录
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  
  if (data.dataType === 'key') {
    const record = data.record;
    
    // ✅ 正确：使用 colleaguePhoneForSheets 字段（已包含单引号前缀）
    const phone = record.colleaguePhoneForSheets || record.colleaguePhone || '';
    
    // 写入到 Sheet（电话号码列）
    sheet.appendRow([
      record.time,
      record.displayName,
      record.keyItem,
      phone,  // ✅ 使用带单引号的版本，保留前导0
      record.status
    ]);
  }
}
```

**电话号码列设置**：
1. 在 Google Sheets 中，将电话号码列的格式设为「纯文本」
2. 或者保持默认，系统会自动处理单引号前缀

**数据流程**：
```
前端输入: 0912-345-678
    ↓
发送到 Sheets: '0912-345-678 (带单引号)
    ↓
Sheets 保存: 0912-345-678 (保留前导0)
    ↓
读取回前端: 0912-345-678 (完整显示)
```

## 📌 系统功能

### 排班管理
- ✅ 自动平均排班
- ✅ 手动排班
- ✅ 临时代班设定
- ✅ 排班统计报表
- ✅ Google Sheets 云端同步

### 鑰匙管理
- ✅ 成员借出
- ✅ 同业借出（支持13个品牌）
- ✅ 常用鑰匙项目多选
- ✅ 值班确认功能
- ✅ 自动跨日检测
- ✅ 历史记录查询

### 数据同步
- ✅ 自动从 Google Sheets 载入
- ✅ 实时同步到 Google Sheets
- ✅ 跨窗口即时同步
- ✅ 每 5 分钟自动检查更新

## 🔑 管理员密码

默认密码：`10108888`

可在 `script.js` 第 10 行修改：
```javascript
const ADMIN_PASSWORD = '10108888'; // 管理員密碼
```

## 🌐 浏览器兼容性

- ✅ Chrome / Edge (推荐)
- ✅ Firefox
- ✅ Safari
- ✅ 移动端浏览器（响应式设计）

## 📱 响应式支持

支持以下屏幕尺寸：
- 桌面 (1400px+)
- 笔记本 (1200px-1399px)
- 平板 (768px-1199px)
- 手机 (320px-767px)

## ⚠️ 注意事项

1. **电话号码格式**：
   - 建议使用格式：`0912-345-678`
   - 系统会自动加上单引号防止前导零丢失

2. **Google Sheets 设置**：
   - 确保 Web App URL 已正确配置
   - 电话号码列的格式建议设为"纯文本"

3. **浏览器缓存**：
   - 更新代码后，按 `Ctrl + F5` 强制刷新

## 🔍 调试

查看浏览器控制台 (F12) 可以看到：
- 同步状态
- 错误信息
- 数据载入进度

## 📞 技术支持

如遇到问题，请检查：
1. 浏览器控制台是否有错误
2. Google Sheets URL 是否正确
3. 网络连接是否正常
4. localStorage 是否被清除

---

**版本**: v2.1  
**更新日期**: 2025/10/15  
**维护**: 常順地產


