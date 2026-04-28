/**
 * 常順地產值班系統 - 排班條件設定
 * 
 * 本文件包含所有特殊排班條件和規則
 * 用於隨機排班時的智能判斷
 */

// ==================== 排班條件設定 ====================

/**
 * 特殊排班條件設定
 * 格式：條件類型 => 條件詳情
 */
const SCHEDULE_CONDITIONS = {
  
  // 1. 特定日期限制（某成員只能在特定星期排班）
  SPECIFIC_DAY_ONLY: {
    '01': ['thursday'],  // 以蓁只排週四
    // 可擴展更多成員
  },
  
  // 2. 禁止排班日期（成員ID＝紙本菁英名單／現場編號）
  FORBIDDEN_DAYS: {
    '05': ['friday'],    // 秋屏不能排週五
    '06': ['friday'],    // 林鋒不能排週五
    '16': ['tuesday'],   // 志桓不能排週二
    '17': ['monday'],    // 子菲不能排週一
    '20': ['monday'],    // 濬瑒不能排週一
    '08': ['monday'],    // 大同不能排週一
    '07': ['monday'],    // 盈橙不能排週一
  },
  
  // 3. 不能同時排班的成員組合
  FORBIDDEN_PAIRS: {
    // 可擴展更多組合
  },
  
  // 4. 必須一起排班的成員組合
  REQUIRED_PAIRS: {
    '17-20': true,       // 子菲跟濬瑒排一起
    '08-07': true,       // 大同跟盈橙排一起
  },
  
  // 5. 特殊班別限制
  FORBIDDEN_SHIFTS: {
    '10': ['monday-evening', 'friday-evening'],  // 雅婷不要排週一跟週五晚班
    '11': ['monday-evening', 'friday-evening'],  // 瑪娜不要排週一跟週五晚班
  }
};

// ==================== 輔助函數 ====================

/**
 * 將星期數字轉換為英文名稱
 * @param {number} dayOfWeek - 星期數字（0=週日, 1=週一, ..., 6=週六）
 * @return {string} 英文星期名稱
 */
function getDayName(dayOfWeek) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[dayOfWeek];
}

/**
 * 將英文星期名稱轉換為數字
 * @param {string} dayName - 英文星期名稱
 * @return {number} 星期數字
 */
function getDayNumber(dayName) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days.indexOf(dayName.toLowerCase());
}

/**
 * 檢查成員是否可以在特定日期排班
 * @param {string} memberId - 成員ID
 * @param {number} dayOfWeek - 星期數字
 * @param {string} shiftKey - 班別key（morning/noon/evening）
 * @return {object} {canWork: boolean, reason: string}
 */
function canMemberWorkOnDay(memberId, dayOfWeek, shiftKey = null) {
  const dayName = getDayName(dayOfWeek);
  const memberStr = memberId.toString();
  
  // 檢查特定日期限制（只能在特定星期排班）
  const specificDayOnly = SCHEDULE_CONDITIONS.SPECIFIC_DAY_ONLY[memberStr];
  if (specificDayOnly && !specificDayOnly.includes(dayName)) {
    return {
      canWork: false,
      reason: `只能在 ${specificDayOnly.map(d => getDayNameInChinese(d)).join('、')} 排班`
    };
  }
  
  // 檢查禁止排班日期
  const forbiddenDays = SCHEDULE_CONDITIONS.FORBIDDEN_DAYS[memberStr];
  if (forbiddenDays && forbiddenDays.includes(dayName)) {
    return {
      canWork: false,
      reason: `不能排 ${getDayNameInChinese(dayName)}`
    };
  }
  
  // 檢查禁止班別
  if (shiftKey) {
    const shiftRestriction = `${dayName}-${shiftKey}`;
    const forbiddenShifts = SCHEDULE_CONDITIONS.FORBIDDEN_SHIFTS[memberStr];
    if (forbiddenShifts && forbiddenShifts.includes(shiftRestriction)) {
      return {
        canWork: false,
        reason: `不能排 ${getDayNameInChinese(dayName)} ${getShiftNameInChinese(shiftKey)}`
      };
    }
  }
  
  return { canWork: true, reason: '' };
}

/**
 * 檢查兩個成員是否可以同時排班
 * @param {string} member1Id - 成員1 ID
 * @param {string} member2Id - 成員2 ID
 * @return {object} {canWorkTogether: boolean, reason: string}
 */
function canMembersWorkTogether(member1Id, member2Id) {
  const pair1 = `${member1Id}-${member2Id}`;
  const pair2 = `${member2Id}-${member1Id}`;
  
  // 檢查禁止組合
  if (SCHEDULE_CONDITIONS.FORBIDDEN_PAIRS[pair1] || SCHEDULE_CONDITIONS.FORBIDDEN_PAIRS[pair2]) {
    return {
      canWorkTogether: false,
      reason: '不能同時排班'
    };
  }
  
  return { canWorkTogether: true, reason: '' };
}

/**
 * 檢查兩個成員是否必須一起排班
 * @param {string} member1Id - 成員1 ID
 * @param {string} member2Id - 成員2 ID
 * @return {boolean} 是否必須一起排班
 */
function mustWorkTogether(member1Id, member2Id) {
  const pair1 = `${member1Id}-${member2Id}`;
  const pair2 = `${member2Id}-${member1Id}`;
  
  return SCHEDULE_CONDITIONS.REQUIRED_PAIRS[pair1] || SCHEDULE_CONDITIONS.REQUIRED_PAIRS[pair2];
}

/**
 * 獲取必須一起排班的夥伴
 * @param {string} memberId - 成員ID
 * @return {string|null} 夥伴ID，如果沒有則返回null
 */
function getRequiredPartner(memberId) {
  const memberStr = memberId.toString();
  
  // 查找該成員是否在任何必須組合中
  for (const [pair, required] of Object.entries(SCHEDULE_CONDITIONS.REQUIRED_PAIRS)) {
    if (required) {
      const [id1, id2] = pair.split('-');
      if (id1 === memberStr) return id2;
      if (id2 === memberStr) return id1;
    }
  }
  
  return null;
}

/**
 * 檢查當天已排班成員是否符合條件
 * @param {Array} assignedMembers - 當天已排班的成員ID陣列
 * @param {string} newMemberId - 要新增的成員ID
 * @return {object} {canAdd: boolean, reason: string}
 */
function checkDayScheduleConditions(assignedMembers, newMemberId) {
  const newMemberStr = newMemberId.toString();
  
  // 檢查禁止組合
  for (const assignedMember of assignedMembers) {
    const canWorkTogether = canMembersWorkTogether(newMemberStr, assignedMember);
    if (!canWorkTogether.canWorkTogether) {
      return {
        canAdd: false,
        reason: canWorkTogether.reason
      };
    }
  }
  
  // 檢查必須組合（如果新成員有必須的夥伴）
  const requiredPartner = getRequiredPartner(newMemberStr);
  if (requiredPartner) {
    const partnerAssigned = assignedMembers.includes(requiredPartner);
    
    // 如果夥伴還沒排班，檢查夥伴是否可用
    if (!partnerAssigned) {
      // 這裡可以加入更複雜的邏輯，例如檢查夥伴是否有其他限制
      // 暫時返回可以，讓系統繼續嘗試
    }
  }
  
  return { canAdd: true, reason: '' };
}

// ==================== 中文化輔助函數 ====================

/**
 * 將英文星期名稱轉換為中文
 */
function getDayNameInChinese(dayName) {
  const dayMap = {
    'monday': '週一',
    'tuesday': '週二',
    'wednesday': '週三',
    'thursday': '週四',
    'friday': '週五',
    'saturday': '週六',
    'sunday': '週日'
  };
  return dayMap[dayName.toLowerCase()] || dayName;
}

/**
 * 將班別key轉換為中文
 */
function getShiftNameInChinese(shiftKey) {
  const shiftMap = {
    'morning': '早班',
    'noon': '中班',
    'evening': '晚班'
  };
  return shiftMap[shiftKey] || shiftKey;
}

// ==================== 條件統計和顯示 ====================

/**
 * 獲取所有條件摘要
 * @return {string} 條件摘要文字
 */
function getScheduleConditionsSummary() {
  let summary = '📋 特殊排班條件摘要\n\n';
  
  // 特定日期限制
  const specificDayOnly = SCHEDULE_CONDITIONS.SPECIFIC_DAY_ONLY;
  if (Object.keys(specificDayOnly).length > 0) {
    summary += '🗓️ 特定日期限制：\n';
    Object.entries(specificDayOnly).forEach(([memberId, days]) => {
      const member = MEMBERS.find(m => m.id === memberId);
      const dayNames = days.map(d => getDayNameInChinese(d)).join('、');
      summary += `  ${memberId}${member ? member.name : ''}：只能排 ${dayNames}\n`;
    });
    summary += '\n';
  }
  
  // 禁止日期
  const forbiddenDays = SCHEDULE_CONDITIONS.FORBIDDEN_DAYS;
  if (Object.keys(forbiddenDays).length > 0) {
    summary += '❌ 禁止排班日期：\n';
    Object.entries(forbiddenDays).forEach(([memberId, days]) => {
      const member = MEMBERS.find(m => m.id === memberId);
      const dayNames = days.map(d => getDayNameInChinese(d)).join('、');
      summary += `  ${memberId}${member ? member.name : ''}：不能排 ${dayNames}\n`;
    });
    summary += '\n';
  }
  
  // 禁止組合
  const forbiddenPairs = SCHEDULE_CONDITIONS.FORBIDDEN_PAIRS;
  if (Object.keys(forbiddenPairs).length > 0) {
    summary += '🚫 不能同時排班：\n';
    Object.entries(forbiddenPairs).forEach(([pair, required]) => {
      if (required) {
        const [id1, id2] = pair.split('-');
        const member1 = MEMBERS.find(m => m.id === id1);
        const member2 = MEMBERS.find(m => m.id === id2);
        summary += `  ${id1}${member1 ? member1.name : ''} 與 ${id2}${member2 ? member2.name : ''}\n`;
      }
    });
    summary += '\n';
  }
  
  // 必須組合
  const requiredPairs = SCHEDULE_CONDITIONS.REQUIRED_PAIRS;
  if (Object.keys(requiredPairs).length > 0) {
    summary += '🤝 必須一起排班：\n';
    Object.entries(requiredPairs).forEach(([pair, required]) => {
      if (required) {
        const [id1, id2] = pair.split('-');
        const member1 = MEMBERS.find(m => m.id === id1);
        const member2 = MEMBERS.find(m => m.id === id2);
        summary += `  ${id1}${member1 ? member1.name : ''} 與 ${id2}${member2 ? member2.name : ''}\n`;
      }
    });
    summary += '\n';
  }
  
  // 禁止班別
  const forbiddenShifts = SCHEDULE_CONDITIONS.FORBIDDEN_SHIFTS;
  if (Object.keys(forbiddenShifts).length > 0) {
    summary += '⏰ 禁止特定班別：\n';
    Object.entries(forbiddenShifts).forEach(([memberId, shifts]) => {
      const member = MEMBERS.find(m => m.id === memberId);
      summary += `  ${memberId}${member ? member.name : ''}：不能排 ${shifts.join('、')}\n`;
    });
  }
  
  return summary;
}

// ==================== 匯出條件設定 ====================

// 將條件設定匯出為 JSON 格式（方便備份和修改）
function exportScheduleConditions() {
  return JSON.stringify(SCHEDULE_CONDITIONS, null, 2);
}

// 從 JSON 格式匯入條件設定
function importScheduleConditions(jsonString) {
  try {
    const conditions = JSON.parse(jsonString);
    // 這裡可以加入驗證邏輯
    Object.assign(SCHEDULE_CONDITIONS, conditions);
    return { success: true, message: '條件設定已更新' };
  } catch (error) {
    return { success: false, message: 'JSON 格式錯誤：' + error.message };
  }
}
