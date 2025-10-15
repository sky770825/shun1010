/**
 * 常順地產值班key進出系統 - Google Apps Script 端代码（適配現有排班記錄結構）
 * 
 * 部署方式：
 * 1. 在 Google Sheets 中，点击「擴充功能」→「Apps Script」
 * 2. 复制此代码**替换**现有代码
 * 3. 点击保存
 * 4. 不需要重新部署，保存后等待 1-2 分钟生效
 */

// ==================== 配置区 ====================

// 工作表名称配置（完全匹配您現有的工作表）
const SHEET_NAMES = {
  SCHEDULE: '排班記錄',      // ✅ 您現有的排班記錄工作表
  KEYS: '鑰匙借還記錄',     // ✅ 您現有的鑰匙借還記錄工作表
  KEY_LIST: '鑰匙名稱清單'  // ✅ 您現有的鑰匙名稱清單工作表（注意是「清單」不是「列表」）
};

// ==================== 主函数 ====================

function doGet(e) {
  const action = e.parameter.action;
  const callback = e.parameter.callback;
  
  let result;
  
  try {
    switch(action) {
      case 'getSchedule':
        const yearMonth = e.parameter.yearMonth;
        result = getSchedule(yearMonth);
        break;
      case 'getKeys':
        result = getKeyRecords();
        break;
      case 'getKeyList':
        result = getKeyNameList();
        break;
      default:
        result = { status: 'error', message: '未知的操作' };
    }
  } catch (error) {
    result = { status: 'error', message: error.toString() };
  }
  
  // JSONP 响应
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const dataType = data.dataType;
    
    let result;
    
    switch(dataType) {
      case 'schedule':
        result = saveSchedule(data);
        break;
      case 'key':
        result = saveKeyRecord(data);
        break;
      case 'keyName':
        result = saveKeyName(data);
        break;
      default:
        result = { status: 'error', message: '未知的数据类型' };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==================== 排班記錄相关（適配現有結構）====================

function getSchedule(yearMonth) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.SCHEDULE);
  
  if (!sheet) {
    // 如果找不到工作表，返回錯誤訊息
    return {
      status: 'error',
      message: '找不到「排班記錄」工作表，請確認工作表名稱是否正確'
    };
  }
  
  const data = sheet.getDataRange().getValues();
  
  // 檢查是否有數據（至少要有表頭）
  if (data.length <= 1) {
    return {
      status: 'success',
      recordCount: 0,
      data: []
    };
  }
  
  // 假設表頭在第一行，數據格式：
  // 時間戳記 | 年月 | 排班類型 | 日期 | 班別 | 成員ID | 成員姓名 | 班別時段
  // 列索引：  0     1      2        3      4      5        6         7
  
  const records = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    // 跳過空行
    if (!row[1] || !row[3]) continue;
    
    // 如果指定了年月，只返回該月份的記錄
    if (!yearMonth || row[1] === yearMonth) {
      records.push({
        timestamp: row[0],
        yearMonth: row[1],
        scheduleType: row[2],
        date: row[3],
        shift: row[4],
        memberId: row[5],
        memberName: row[6],
        shiftPeriod: row[7]
      });
    }
  }
  
  return {
    status: 'success',
    recordCount: records.length,
    data: records
  };
}

function saveSchedule(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.SCHEDULE);
  
  if (!sheet) {
    return {
      status: 'error',
      message: '找不到「排班記錄」工作表'
    };
  }
  
  const yearMonth = data.yearMonth;
  const scheduleData = data.data;
  
  // 刪除該月份的舊數據
  const allData = sheet.getDataRange().getValues();
  for (let i = allData.length - 1; i >= 1; i--) {
    if (allData[i][1] === yearMonth) {  // 第2列是年月
      sheet.deleteRow(i + 1);
    }
  }
  
  // 添加新數據
  scheduleData.forEach(record => {
    sheet.appendRow([
      new Date().toISOString(),  // 時間戳記
      yearMonth,                 // 年月
      record.scheduleType || '', // 排班類型
      record.date,               // 日期
      record.shift || '',        // 班別
      record.memberId,           // 成員ID
      record.memberName,         // 成員姓名
      record.shiftPeriod || ''   // 班別時段
    ]);
  });
  
  return { status: 'success', message: '排班数据已保存' };
}

// ==================== 鑰匙借還記錄相關 ====================

function getKeyRecords() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.KEYS);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.KEYS);
    // 创建表头
    sheet.appendRow([
      'ID', '借出時間', '借用人類型', '借用人編號', '借用人姓名', 
      '電話號碼', '鑰匙項目', '狀態', '歸還時間', '值班確認人', '值班確認時間'
    ]);
    
    // ⭐ 重要：设置电话号码列为纯文本格式
    const phoneColumn = 6; // F列（电话号码列）
    sheet.getRange(2, phoneColumn, sheet.getMaxRows() - 1, 1)
      .setNumberFormat('@STRING@'); // 强制设置为文本格式
    
    return {
      status: 'success',
      recordCount: 0,
      data: []
    };
  }
  
  const data = sheet.getDataRange().getValues();
  const records = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    
    records.push({
      id: row[0],
      borrowTime: row[1],
      borrowerType: row[2],
      borrowerId: row[3],
      borrowerName: row[4],
      borrowerPhone: row[5],
      keyItem: row[6],
      status: row[7],
      returnTime: row[8] || null,
      dutyConfirmedBy: row[9] || null,
      dutyConfirmedTime: row[10] || null
    });
  }
  
  return {
    status: 'success',
    recordCount: records.length,
    data: records
  };
}

function saveKeyRecord(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.KEYS);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.KEYS);
    sheet.appendRow([
      'ID', '借出時間', '借用人類型', '借用人編號', '借用人姓名', 
      '電話號碼', '鑰匙項目', '狀態', '歸還時間', '值班確認人', '值班確認時間'
    ]);
    
    // ⭐ 设置电话号码列为纯文本格式
    const phoneColumn = 6;
    sheet.getRange(2, phoneColumn, sheet.getMaxRows() - 1, 1)
      .setNumberFormat('@STRING@');
  }
  
  const action = data.action;
  const record = data.record;
  
  // ⭐⭐⭐ 关键：使用 colleaguePhoneForSheets 字段（已包含单引号前缀）
  const phone = record.colleaguePhoneForSheets || record.colleaguePhone || '';
  
  if (action === 'borrow') {
    // 新增借出记录
    const newRow = sheet.getLastRow() + 1;
    
    // 先设置该行的电话号码格式为文本
    sheet.getRange(newRow, 6).setNumberFormat('@STRING@');
    
    // 写入数据
    sheet.appendRow([
      record.id,
      record.borrowTime,
      record.borrowerType === 'member' ? '成員' : '同業',
      record.memberId || '',
      record.borrowerType === 'member' ? record.memberName : record.colleagueName,
      phone,  // ⭐ 使用带单引号的电话号码
      record.keyItem,
      '借出中',
      '',
      '',
      ''
    ]);
    
    // ⭐ 再次确保电话号码格式正确
    if (phone) {
      const phoneCell = sheet.getRange(newRow, 6);
      phoneCell.setNumberFormat('@STRING@');
      // 如果电话号码以单引号开头，去掉单引号后再设置
      const cleanPhone = phone.startsWith("'") ? phone.substring(1) : phone;
      phoneCell.setValue(cleanPhone);
    }
    
    return { status: 'success', message: '借出记录已保存' };
    
  } else if (action === 'return' || action === 'confirm') {
    // 更新归还或确认记录
    const allData = sheet.getDataRange().getValues();
    
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][0] == record.id) {
        const rowNum = i + 1;
        
        if (action === 'return') {
          sheet.getRange(rowNum, 8).setValue('已歸還');
          sheet.getRange(rowNum, 9).setValue(record.returnTime || new Date().toISOString());
        } else if (action === 'confirm') {
          sheet.getRange(rowNum, 10).setValue(record.dutyConfirmedBy);
          sheet.getRange(rowNum, 11).setValue(record.dutyConfirmedTime || new Date().toISOString());
        }
        
        return { status: 'success', message: '记录已更新' };
      }
    }
    
    return { status: 'error', message: '找不到对应的记录' };
  }
  
  return { status: 'error', message: '未知的操作' };
}

// ==================== 鑰匙名稱列表相關 ====================

function getKeyNameList() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.KEY_LIST);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.KEY_LIST);
    sheet.appendRow(['ID', '鑰匙名稱', '開發業務', '備註', '新增時間']);
    
    return {
      status: 'success',
      recordCount: 0,
      data: []
    };
  }
  
  const data = sheet.getDataRange().getValues();
  const records = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    
    records.push({
      id: row[0],
      keyName: row[1],
      developer: row[2],
      note: row[3] || '',
      createTime: row[4]
    });
  }
  
  return {
    status: 'success',
    recordCount: records.length,
    data: records
  };
}

function saveKeyName(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAMES.KEY_LIST);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.KEY_LIST);
    sheet.appendRow(['ID', '鑰匙名稱', '開發業務', '備註', '新增時間']);
  }
  
  const keyData = data.keyData;
  
  sheet.appendRow([
    keyData.id,
    keyData.keyName,
    keyData.developer,
    keyData.note || '',
    new Date().toISOString()
  ]);
  
  return { status: 'success', message: '钥匙名称已保存' };
}

// ==================== 辅助函数 ====================

/**
 * 测试函数 - 可以在 Apps Script 编辑器中直接运行测试
 */
function testReadSchedule() {
  const result = getSchedule('2025-10');
  Logger.log('測試讀取排班記錄：');
  Logger.log(JSON.stringify(result, null, 2));
}

function testPhoneNumber() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('测试');
  
  if (!sheet) {
    sheet = ss.insertSheet('测试');
  }
  
  sheet.clear();
  sheet.appendRow(['方法', '输入值', '显示结果']);
  
  // 测试1：直接输入数字字符串
  const row1 = sheet.getLastRow() + 1;
  sheet.getRange(row1, 1).setValue('直接输入');
  sheet.getRange(row1, 2).setValue('0912345678');
  
  // 测试2：设置格式后输入
  const row2 = sheet.getLastRow() + 1;
  sheet.getRange(row2, 1).setValue('先设置格式');
  sheet.getRange(row2, 2).setNumberFormat('@STRING@').setValue('0912345678');
  
  // 测试3：使用单引号前缀
  const row3 = sheet.getLastRow() + 1;
  sheet.getRange(row3, 1).setValue('单引号前缀');
  sheet.getRange(row3, 2).setNumberFormat('@STRING@').setValue("'0912345678".substring(1));
  
  Logger.log('测试完成，请查看"测试"工作表');
}

