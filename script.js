const EXCLUDED_MEMBERS = ['02','17','22','90','91','92','93','94'];
const STORE_KEY = 'schedule-checkin';
const HISTORY_KEY = 'schedule-history';
const KEY_RECORD_KEY = 'key-records';
const SHIFT_CHANGE_KEY = 'shift-change-requests';
const KEY_HISTORY_KEY = 'key-item-history';
const COLLEAGUE_HISTORY_KEY = 'colleague-history';
const TEMP_DUTY_KEY = 'temp-duty-override'; // 临时代班数据
const KEY_LIST_KEY = 'key-name-list'; // 鑰匙名稱清單
const ADMIN_PASSWORD = '10108888'; // 管理員密碼

// 當前選擇的成員（用於鑰匙借出）
let selectedMember = null;

// 當前值班人員
let dutyMember = null;

// 當前借出類型
let currentBorrowType = 'member'; // 'member' 或 'colleague'

// 當前查看的記錄日期
let currentViewDate = new Date();

// 記錄上次檢查的日期
let lastCheckedDate = new Date();

// 已選擇的鑰匙項目
let selectedKeyItems = new Set();

// 鑰匙名稱清單（從 Google Sheets 載入）
let keyNameList = [];

// Google Sheets Web App URL（請在部署 Apps Script 後替換此 URL）
const GOOGLE_SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwYf5_7BwIcBxw-x4PpY1non0dXVpTkp0HgmT0YWiZiswCTllkgq7Uo2fbXN8RQw5U6ZA/exec';

// 聯絡電話資料
const CONTACT_PHONES = {
  '01': '梁以蓁 0930-802-502',
  '02': '黃景翔 0913-757-901', 
  '03': '邱顯宗 0935-540-532',
  '05': '曾莉羚 0987-918-219',
  '06': '梁秋屏 0909-320-909',
  '07': '林鋒 0917-110-860',
  '08': '李秀華 0981-515-802',
  '09': '朱盈橙 0972-492-576',
  '10': '吳大同 0926-950-996',
  '11': '陳曉敏 0938-534-277',
  '12': '楊雅婷 0921-998-571',
  '13': '潘瑀嬅 0921-534-575',
  '15': '鍾皓宇 0900-068-939',
  '16': '陳永樺 0916-877-000',
  '17': '范沅 0976-122-166',
  '18': '吳志桓 0916-205-238',
  '19': '劉子菲 0925-666-597',
  '20': '高志偉 0936-939-888',
  '21': '黃郁庭 0988-562-796',
  '22': '張婕茹 0963-581-509',
  '23': '張珈瑜 0987-091-219',
  '25': '蔡濬瑒 0928-776-755',
  '26': '葉益呈 0920-661-218',
  '90': '徐店東 0916-186-362',
  '91': '簡副總 0973-070-637',
  '92': '王店 0989-813-686',
  '93': '曾經理 0916-888-061',
  '94': '羅珍妮 0918-829-871'
};

// 平日與假日班別
const WEEKDAY_SHIFTS = [
  {key:'morning',label:'早班 09:30-15:30'},
  {key:'evening',label:'晚班 15:30-21:00'}
];
const WEEKEND_SHIFTS = [
  {key:'morning',label:'早班 09:30-13:30'},
  {key:'noon',   label:'中班 13:30-17:30'},
  {key:'evening',label:'晚班 17:30-21:00'}
];

// 成員清單
const MEMBERS = [
  {id:'01',name:'以蓁'},
  {id:'02',name:'景翔',disabled:true},
  {id:'03',name:'顯宗'},
  {id:'05',name:'莉羚'},
  {id:'06',name:'秋屏'},
  {id:'07',name:'林鋒',group:'group4'},
  {id:'08',name:'秀華'},
  {id:'09',name:'盈橙',group:'group3'},
  {id:'10',name:'大同',group:'group3'},
  {id:'11',name:'曉敏'},
  {id:'12',name:'雅婷',group:'group2'},
  {id:'13',name:'瑀嬅',group:'group2'},
  {id:'15',name:'皓宇'},
  {id:'16',name:'永樺'},
  {id:'17',name:'范沅',disabled:true},
  {id:'18',name:'志桓'},
  {id:'19',name:'子菲',group:'group1'},
  {id:'20',name:'志偉'},
  {id:'21',name:'郁庭'},
  {id:'22',name:'婕茹',disabled:true},
  {id:'23',name:'珈瑜',group:'group4'},
  {id:'25',name:'濬瑒',group:'group1'},
  {id:'26',name:'益呈'},
  {id:'90',name:'徐店東',disabled:true},
  {id:'91',name:'簡副總',disabled:true},
  {id:'92',name:'王店',disabled:true},
  {id:'93',name:'曾經理',disabled:true},
  {id:'94',name:'羅珍妮',disabled:true}
];

// 設定預設為當前年月（2025年）
const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
document.getElementById('monthPicker').value = `${currentYear}-${currentMonth}`;

// 產生成員對照表
function renderMemberList(){
  const ul=document.getElementById('memberListUl');
  ul.innerHTML='';
  
  // 計算班數統計
  const ym=document.getElementById('monthPicker').value;
  const days=daysInMonth(ym);
  const data=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
  
  // 計算總班數
  let totalShifts = 0;
  for(let d=1;d<=days;d++){
    const wd=new Date(`${ym}-${String(d).padStart(2,'0')}`).getDay();
    totalShifts += (wd===0||wd===6)? WEEKEND_SHIFTS.length : WEEKDAY_SHIFTS.length;
  }
  
  // 計算每個人已排的班數
  const memberStats = {};
  MEMBERS.forEach(m => {
    if(!m.disabled){
      memberStats[m.id] = {
        name: m.name,
        count: 0
      };
    }
  });
  
  // 統計已排班數
  for(const key in data){
    if(key.startsWith(ym+':') && data[key]){
      const memberId = data[key];
      if(memberStats[memberId]){
        memberStats[memberId].count++;
      }
    }
  }
  
  // 計算平均分配
  const activeMembers = Object.values(memberStats).filter(m => !EXCLUDED_MEMBERS.includes(m.id));
  const memberCount = activeMembers.length;
  const baseShifts = Math.floor(totalShifts / memberCount);
  const remainderShifts = totalShifts % memberCount;
  
  // 使用固定的分配順序（基於成員ID排序，確保一致性）
  const memberIds = Object.keys(memberStats).filter(id => !EXCLUDED_MEMBERS.includes(id)).sort();
  
  // 獲取前3次的增額分配記錄
  const previousExtraMembers = getPreviousExtraMembers(ym);
  
  // 優先選擇沒有增額過的成員（按固定順序）
  const availableMembers = memberIds.filter(m => !previousExtraMembers.includes(m));
  
  // 如果可用成員不夠，再從所有成員中選擇（按固定順序）
  let shuffled = [...availableMembers];
  if (shuffled.length < remainderShifts) {
    const remainingNeeded = remainderShifts - shuffled.length;
    const otherMembers = memberIds.filter(m => !shuffled.includes(m));
    shuffled = [...shuffled, ...otherMembers.slice(0, remainingNeeded)];
  }
  
  // 如果還是湊不夠，就用所有成員（按固定順序）
  if (shuffled.length < remainderShifts) {
    shuffled = memberIds.slice(0, remainderShifts);
  }
  
  shuffled = shuffled.slice(0, remainderShifts);
  
  // 按照固定順序顯示成員（基於成員ID排序，確保一致性）
  const sortedMembers = MEMBERS.filter(m => !m.disabled).sort((a, b) => {
    // 先按ID排序
    const idCompare = a.id.localeCompare(b.id);
    if (idCompare !== 0) return idCompare;
    
    // 如果ID相同，按排班數排序（多的在前）
    const aCount = memberStats[a.id] ? memberStats[a.id].count : 0;
    const bCount = memberStats[b.id] ? memberStats[b.id].count : 0;
    return bCount - aCount;
  });
  
  // 最後添加被禁用的成員
  const disabledMembers = MEMBERS.filter(m => m.disabled).sort((a, b) => a.id.localeCompare(b.id));
  sortedMembers.push(...disabledMembers);
  
  sortedMembers.forEach(m=>{
    const li=document.createElement('li');
    
    // 檢查是否為主管（編號90以上）
    const isManager = parseInt(m.id) >= 90;
    
    if(m.disabled){
      // 主管：不顯示編號，但可以點擊借key
      if(isManager){
        li.textContent=`👔 ${m.name}`;
        li.style.background='linear-gradient(135deg,#ffd700 0%,#ffed4e 100%)';
        li.style.color='#000';
        li.style.fontWeight='bold';
        li.style.borderLeft='4px solid #ff9800';
        li.style.cursor='pointer';
        
        // 添加點擊選擇功能（可以借key）
        li.addEventListener('click', () => selectMember(m));
        
        // 如果當前選中，添加選中樣式
        if(selectedMember && selectedMember.id === m.id){
          li.classList.add('selected');
        }
      } else {
        // 一般不排班成員：顯示編號，不能點擊
        li.textContent=`${m.id} ${m.name}`;
        li.classList.add('disabled');
      }
    }else{
      const currentCount = memberStats[m.id] ? memberStats[m.id].count : 0;
      li.textContent=`${m.id} ${m.name}(${currentCount}班)`;
      
      // 為組隊成員添加顏色標識
      if(m.group){
        li.classList.add(m.group);
      }
      
      // 添加點擊選擇功能
      li.addEventListener('click', () => selectMember(m));
      
      // 如果當前選中，添加選中樣式
      if(selectedMember && selectedMember.id === m.id){
        li.classList.add('selected');
      }
    }
    ul.appendChild(li);
  });
}

// 計算某月有幾天
function daysInMonth(ym){const [y,m]=ym.split('-').map(Number);return new Date(y,m,0).getDate();}

// 建立表格
function buildGrid(){
  const ym=document.getElementById('monthPicker').value;
  const days=daysInMonth(ym);
  const grid=document.getElementById('grid');
  grid.innerHTML='';

  // 標題列
  let head='<tr><th>班別＼日期</th>';
  for(let d=1;d<=days;d++){
    const wd=new Date(`${ym}-${String(d).padStart(2,'0')}`).getDay();
    const wdText='日一二三四五六'[wd];
    const isWeekend = (wd === 0 || wd === 6);
    const colorClass = isWeekend ? 'weekend-header' : 'weekday-header';
    head+=`<th class="${colorClass}">${d}<br><small>${wdText}</small></th>`;
  }
  head+='</tr>';
  grid.insertAdjacentHTML('beforeend',head);

  // 動態產生班別列（依當天是平日或假日）
  const maxShifts = Math.max(WEEKDAY_SHIFTS.length,WEEKEND_SHIFTS.length);
  
  // 定義固定的班別標題（對應到表格行）
  const shiftTitles = [
    {text: '早班09:30-15:30', class: 'morning-title'},  // 第1行：早班（平日時間）
    {text: '中班13:30-17:30', class: 'noon-title'},    // 第2行：中班
    {text: '晚班15:30-21:00', class: 'evening-title'}  // 第3行：晚班（平日時間）
  ];
  
  for(let i=0;i<maxShifts;i++){
    let row = `<tr><th class="${shiftTitles[i].class}">${shiftTitles[i].text}</th>`;
    
    for(let d=1;d<=days;d++){
      const wd=new Date(`${ym}-${String(d).padStart(2,'0')}`).getDay();
      const shifts = (wd===0||wd===6)? WEEKEND_SHIFTS : WEEKDAY_SHIFTS;
      
      if(i<shifts.length){
        // 簡單的一行一欄設計：每個班別都是獨立儲存格，不預設顏色
        const shiftKey = shifts[i].key;
        row+=`<td><div class="cell" data-day="${d}" data-shift="${shiftKey}" title="${shifts[i].label}"></div></td>`;
      }else{
        // 對於平日的中班位置，顯示禁用狀態
        if(!(wd===0||wd===6) && i === 1){
          row+=`<td><div class="cell disabled" data-day="${d}" data-shift="disabled" title="平日無中班"></div></td>`;
      }else{
        row+='<td></td>';
        }
      }
    }
    row+='</tr>';
    grid.insertAdjacentHTML('beforeend',row);
  }

  bindEvents();
  hydrate();
  renderMemberList(); // 重新計算成員統計
  updateDutyMember(); // 更新值班人員
  
  // 表格生成後調整縮放
  setTimeout(() => {
    adjustTableToFit();
  }, 100);
}

// 點擊簽到或換班
function bindEvents(){
  document.querySelectorAll('.cell').forEach(cell=>{
    cell.addEventListener('click',()=>{
      // 檢查是否為平日的中班位置（不可點選）
      const day = parseInt(cell.dataset.day);
      const shift = cell.dataset.shift;
      const wd = new Date(`${document.getElementById('monthPicker').value}-${String(day).padStart(2,'0')}`).getDay();
      const isWeekend = (wd === 0 || wd === 6);
      
      // 如果是禁用狀態的儲存格，則不允許點擊
      if(shift === 'disabled'){
        showCustomAlert('平日沒有中班，請選擇早班或晚班', 'error');
        return;
      }
      
      // 優先使用選中的成員，如果沒有則使用選擇框的值
      const member = selectedMember ? selectedMember.id : document.getElementById('memberInput').value;
      if(!member){showCustomAlert('請先選擇成員', 'error');return;}
      const memberObj = MEMBERS.find(m => m.id === member);
      if(memberObj && EXCLUDED_MEMBERS.includes(memberObj.id)){
        showCustomAlert(`『${memberObj.name}』不列入排班`, 'error');
        return;
      }
      
      const ym=document.getElementById('monthPicker').value;
      const key=`${ym}:${cell.dataset.day}-${cell.dataset.shift}`;
      const data=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
      const currentMember = data[key];
      
      if(currentMember === member){
        // 再點同一人 → 清空
        delete data[key];
      }else if(currentMember){
        // 已有人排班 → 需要密碼驗證後才能換班
        const memberName = MEMBERS.find(m=>m.id===member)?.name || member;
        const currentMemberName = MEMBERS.find(m=>m.id===currentMember)?.name || currentMember;
        
        // 獲取完整的日期和班別資訊
        const dateStr = `${ym}-${String(day).padStart(2, '0')}`;
        const shiftNames = {
          'morning': isWeekend ? '早班 (09:30-13:30)' : '早班 (09:30-15:30)',
          'noon': '中班 (13:30-17:30)',
          'evening': isWeekend ? '晚班 (17:30-21:00)' : '晚班 (15:30-21:00)'
        };
        const shiftName = shiftNames[shift] || shift;
        
        // 先驗證密碼
        showPasswordForShiftChange(
          dateStr,
          shiftName,
          currentMemberName,
          memberName,
          () => {
            // 密碼驗證成功後執行換班
            data[key]=member;
            localStorage.setItem(STORE_KEY,JSON.stringify(data));
            hydrate();
            renderMemberList(); // 更新成員統計
            updateDutyMember(); // 更新值班人員
            
            showCustomAlert(`✅ 已將「${currentMemberName}」換成「${memberName}」`, 'success');
            
            // 同步到 Google Sheets（異步執行 - 只更新這一筆）
            (async () => {
              await updateSingleScheduleToSheets(ym, day, shift, member);
              showSyncNotification('📊 換班已同步到 Google Sheets');
            })();
          }
        );
        return; // 等待驗證後再執行
      }else{
        // 空班別 → 直接排班
        data[key]=member;
      }
      
      // 儲存資料並更新顯示
      localStorage.setItem(STORE_KEY,JSON.stringify(data));
      hydrate();
      renderMemberList(); // 更新成員統計
      updateDutyMember(); // 更新值班人員
      
      // 同步到 Google Sheets（異步執行 - 只更新這一筆）
      (async () => {
        await updateSingleScheduleToSheets(ym, day, shift, member);
        showSyncNotification('📊 排班已同步到 Google Sheets');
      })();
    });
  });
}

// 將資料填回表格
function hydrate(){
  const ym=document.getElementById('monthPicker').value;
  const data=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
  document.querySelectorAll('.cell').forEach(cell=>{
    const key=`${ym}:${cell.dataset.day}-${cell.dataset.shift}`;
    
    // 清除所有顏色類別
    cell.classList.remove('morning-shift', 'noon-shift', 'evening-shift', 'checked', 'group1', 'group2', 'group3', 'group4');
    
    if(data[key]){
      // 有排班時，添加對應的班別顏色和選中狀態
      const shiftKey = cell.dataset.shift;
      const shiftClass = shiftKey === 'morning' ? 'morning-shift' : 
                        shiftKey === 'noon' ? 'noon-shift' : 
                        shiftKey === 'evening' ? 'evening-shift' : '';
      cell.classList.add(shiftClass, 'checked');
      
      // 為組隊成員添加組別顏色
      const member = MEMBERS.find(m => m.id === data[key]);
      if(member && member.group){
        cell.classList.add(member.group);
      }
      
      cell.textContent = data[key];
    }else{
      // 沒有排班時，只顯示空白，不添加顏色
      cell.textContent = '';
    }
  });
}

// 清除本月資料
function clearData(){
  if(confirm('確定清除本月簽到資料？')){
    const ym=document.getElementById('monthPicker').value;
    const data=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
    for(const k in data){
      if(k.startsWith(ym+':')) delete data[k];
    }
    localStorage.setItem(STORE_KEY,JSON.stringify(data));
    hydrate();
  }
}

// 匯出CSV
function exportCsv(){
  const ym=document.getElementById('monthPicker').value;
  const days=daysInMonth(ym);
  const data=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
  
  // 建立表頭
  const headers=['班別＼日期'];
  for(let d=1;d<=days;d++){
    const wd=new Date(`${ym}-${String(d).padStart(2,'0')}`).getDay();
    const wdText='日一二三四五六'[wd];
    headers.push(`${d}(${wdText})`);
  }
  
  const rows=[headers];
  
  // 建立班別行
  const maxShifts = Math.max(WEEKDAY_SHIFTS.length,WEEKEND_SHIFTS.length);
  
  // 定義固定的班別標題（對應到表格行）
  const shiftTitles = [
    '早班09:30-15:30',  // 第1行：早班（平日時間）
    '中班13:30-17:30',  // 第2行：中班
    '晚班15:30-21:00'   // 第3行：晚班（平日時間）
  ];
  
  for(let i=0;i<maxShifts;i++){
    const row=[shiftTitles[i]];
    
    for(let d=1;d<=days;d++){
      const wd=new Date(`${ym}-${String(d).padStart(2,'0')}`).getDay();
      const shifts = (wd===0||wd===6)? WEEKEND_SHIFTS : WEEKDAY_SHIFTS;
      
      if(i<shifts.length){
        let memberId = '';
        if((wd===0||wd===6)){
          // 假日：直接對應（早中晚垂直3欄）
          const key=`${ym}:${d}-${shifts[i].key}`;
          memberId = data[key];
        } else {
          // 平日：早班和晚班垂直對齊成2欄
          if(i === 0){
            // 早班（第1欄）
            const key=`${ym}:${d}-${shifts[0].key}`;
            memberId = data[key];
          } else if(i === 1){
            // 晚班（第2欄）
            const key=`${ym}:${d}-${shifts[1].key}`;
            memberId = data[key];
          }
        }
        
        if(memberId){
          const member = MEMBERS.find(m => m.id === memberId);
          row.push(member ? `${memberId} ${member.name}` : memberId);
        }else{
          row.push('');
        }
      }else{
        row.push('');
      }
    }
    rows.push(row);
  }
  
  // 轉換為CSV格式
  const csv = rows.map(row => 
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n');
  
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `排班表-${ym}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// 記錄排班歷史
function recordScheduleHistory(ym, shuffled, remainder){
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
  if (!history[ym]) {
    history[ym] = [];
  }
  
  // 記錄這次的增額分配
  const extraMembers = shuffled.slice(0, remainder);
  history[ym].push(extraMembers);
  
  // 只保留最近3次記錄
  if (history[ym].length > 3) {
    history[ym] = history[ym].slice(-3);
  }
  
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// 獲取前3次增額分配的成員
function getPreviousExtraMembers(ym){
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
  const previousHistory = history[ym] || [];
  return previousHistory.flat(); // 合併所有歷史記錄
}

// 隨機平均排班
function autoAssign(){
  console.log('開始執行 autoAssign');
  const ym=document.getElementById('monthPicker').value;
  console.log('選擇的月份:', ym);
  const days=daysInMonth(ym);
  console.log('本月天數:', days);
  const allMembers = MEMBERS.filter(m=>!m.disabled).map(m=>m.id);
  console.log('可用成員:', allMembers);
  if(allMembers.length===0){showCustomAlert('無可排班成員', 'error');return;}

  // 計算總班數
  let totalSlots=0;
  for(let d=1;d<=days;d++){
    const wd=new Date(`${ym}-${String(d).padStart(2,'0')}`).getDay();
    totalSlots += (wd===0||wd===6)? WEEKEND_SHIFTS.length : WEEKDAY_SHIFTS.length;
  }

  const base = Math.floor(totalSlots / allMembers.length);
  const remainder = totalSlots % allMembers.length;

  // 獲取前3次的增額分配記錄
  const previousExtraMembers = getPreviousExtraMembers(ym);
  
  // 使用固定的分配順序（基於成員ID排序，確保一致性）
  const sortedMembers = [...allMembers].sort();
  
  // 優先選擇沒有增額過的成員（按固定順序）
  const availableMembers = sortedMembers.filter(m => !previousExtraMembers.includes(m));
  
  // 如果可用成員不夠，再從所有成員中選擇（按固定順序）
  let shuffled = [...availableMembers];
  if (shuffled.length < remainder) {
    const remainingNeeded = remainder - shuffled.length;
    const otherMembers = sortedMembers.filter(m => !shuffled.includes(m));
    shuffled = [...shuffled, ...otherMembers.slice(0, remainingNeeded)];
  }
  
  // 如果還是湊不夠，就用所有成員（按固定順序）
  if (shuffled.length < remainder) {
    shuffled = sortedMembers.slice(0, remainder);
  }
  
  // 只取需要的數量
  shuffled = shuffled.slice(0, remainder);
  
  // 記錄這次的分配
  recordScheduleHistory(ym, shuffled, remainder);

  // 顯示分配計畫
  let plan = `📋 ${ym} 平均分配計畫\n\n`;
  plan += `總班數: ${totalSlots}\n`;
  plan += `平均每人: ${base} 班\n`;
  plan += `多餘班數: ${remainder} 班\n\n`;
  
  if (previousExtraMembers.length > 0) {
    plan += `前3次增額過的成員: ${previousExtraMembers.join(', ')}\n\n`;
  }
  
  plan += '本次增額分配:\n';
  shuffled.forEach((memberId) => {
    const member = MEMBERS.find(m => m.id === memberId);
    plan += `${memberId.padStart(2,'0')} ${member.name}\n`;
  });
  
  plan += '\n分配方式:\n';
  allMembers.forEach((memberId) => {
    const member = MEMBERS.find(m => m.id === memberId);
    const hasExtra = shuffled.includes(memberId);
    const totalShifts = base + (hasExtra ? 1 : 0);
    plan += `${memberId.padStart(2,'0')} ${member.name}: ${base}+${hasExtra ? 1 : 0} = ${totalShifts}班\n`;
  });

  showConfirmModal(
    '📋 隨機平均排班計畫',
    plan,
    '確定要執行此分配計畫並覆蓋原有資料嗎？',
    () => {
      executeAutoAssign();
    }
  );
}

function executeAutoAssign(){
  console.log('開始執行 executeAutoAssign');
  const ym=document.getElementById('monthPicker').value;
  console.log('執行月份:', ym);
  
  // 自動清除該月的所有臨時代班設定
  const tempDutyData = JSON.parse(localStorage.getItem(TEMP_DUTY_KEY) || '{}');
  let clearedCount = 0;
  Object.keys(tempDutyData).forEach(key => {
    if(key.startsWith(ym + ':')) {
      delete tempDutyData[key];
      clearedCount++;
    }
  });
  if(clearedCount > 0) {
    localStorage.setItem(TEMP_DUTY_KEY, JSON.stringify(tempDutyData));
    console.log(`已自動清除 ${clearedCount} 個臨時代班設定`);
  }
  
  const days=daysInMonth(ym);
  console.log('執行天數:', days);
  const allMembers = MEMBERS.filter(m=>!m.disabled).map(m=>m.id);
  console.log('執行成員:', allMembers);
  
  // 計算總班數
  let totalSlots=0;
  for(let d=1;d<=days;d++){
    const wd=new Date(`${ym}-${String(d).padStart(2,'0')}`).getDay();
    totalSlots += (wd===0||wd===6)? WEEKEND_SHIFTS.length : WEEKDAY_SHIFTS.length;
  }

  const base = Math.floor(totalSlots / allMembers.length);
  const remainder = totalSlots % allMembers.length;

  // 獲取前3次的增額分配記錄
  const previousExtraMembers = getPreviousExtraMembers(ym);
  
  // 使用固定的分配順序（基於成員ID排序，確保一致性）
  const sortedMembers = [...allMembers].sort();
  
  // 優先選擇沒有增額過的成員（按固定順序）
  const availableMembers = sortedMembers.filter(m => !previousExtraMembers.includes(m));
  
  // 如果可用成員不夠，再從所有成員中選擇（按固定順序）
  let shuffled = [...availableMembers];
  if (shuffled.length < remainder) {
    const remainingNeeded = remainder - shuffled.length;
    const otherMembers = sortedMembers.filter(m => !shuffled.includes(m));
    shuffled = [...shuffled, ...otherMembers.slice(0, remainingNeeded)];
  }
  
  // 如果還是湊不夠，就用所有成員（按固定順序）
  if (shuffled.length < remainder) {
    shuffled = sortedMembers.slice(0, remainder);
  }
  
  // 只取需要的數量
  shuffled = shuffled.slice(0, remainder);
  
  // 記錄這次的分配
  recordScheduleHistory(ym, shuffled, remainder);

  // 建立分配池
  const pool=[];
  allMembers.forEach(m=>{for(let j=0;j<base;j++) pool.push(m);});
  for(let i=0;i<remainder;i++) pool.push(shuffled[i]);

  const data={};
  let idx=0;
  
  // 按組別分組成員
  const groupMembers = {};
  MEMBERS.forEach(member => {
    if (member.group) {
      if (!groupMembers[member.group]) {
        groupMembers[member.group] = [];
      }
      groupMembers[member.group].push(member.id);
    }
  });
  
  // 顯示識別到的組隊成員
  console.log('識別到的組隊成員:', groupMembers);
  Object.entries(groupMembers).forEach(([groupName, members]) => {
    const memberNames = members.map(id => {
      const member = MEMBERS.find(m => m.id === id);
      return `${id}${member ? member.name : ''}`;
    }).join('、');
    console.log(`${groupName}: ${memberNames}`);
  });

  // 隨機化分配池
  pool.sort(() => Math.random() - 0.5);

  // 記錄每個成員的排班歷史，用於智能間隔控制
  const memberWorkHistory = {};
  const lastWorkDay = {}; // 記錄每個成員最後排班日期
  
  // 區分組隊成員和單人成員
  const groupedMembers = new Set();
  const singleMembers = new Set();
  
  MEMBERS.forEach(member => {
    if (member.group) {
      groupedMembers.add(member.id);
    } else if (!member.disabled) {
      singleMembers.add(member.id);
    }
  });

  // 智能間隔檢查函數（整合排班條件）
  function canWorkOnDay(memberId, targetDay) {
    // 首先檢查特殊排班條件
    const dateStr = `${ym}-${String(targetDay).padStart(2,'0')}`;
    const dayOfWeek = new Date(dateStr).getDay();
    const shiftKey = shifts[i].key;
    
    const conditionCheck = canMemberWorkOnDay(memberId, dayOfWeek, shiftKey);
    if (!conditionCheck.canWork) {
      console.log(`❌ ${memberId} 不能排 ${targetDay}日: ${conditionCheck.reason}`);
      return false;
    }
    
    // 單人成員：較寬鬆的間隔控制（2天）
    if (singleMembers.has(memberId)) {
      const workDays = memberWorkHistory[memberId] || [];
      if (workDays.length === 0) return true;
      
      // 檢查與最近一次排班的間隔
      const lastWork = Math.max(...workDays);
      return (targetDay - lastWork) >= 2;
    }
    
    // 組隊成員：較嚴格的間隔控制（4天）
    if (groupedMembers.has(memberId)) {
      const workDays = memberWorkHistory[memberId] || [];
      if (workDays.length === 0) return true;
      
      // 檢查與最近一次排班的間隔
      const lastWork = Math.max(...workDays);
      return (targetDay - lastWork) >= 4;
    }
    
    return true;
  }
  
  // 組隊成員間隔檢查（同組成員之間的最小間隔）
  function canGroupWorkOnDay(memberId, targetDay) {
    if (!groupedMembers.has(memberId)) return true;
    
    const member = MEMBERS.find(m => m.id === memberId);
    if (!member || !member.group) return true;
    
    // 檢查同組其他成員的排班情況
    const groupMembers = MEMBERS.filter(m => m.group === member.group && !m.disabled);
    const minIntervalBetweenGroupMembers = 4; // 同組成員之間至少間隔4天
    
    for (const groupMember of groupMembers) {
      if (groupMember.id === memberId) continue;
      
      // 檢查該組成員在當前已排班的日期
      const groupMemberWorkDays = memberWorkHistory[groupMember.id] || [];
      
      for (const workDay of groupMemberWorkDays) {
        const interval = Math.abs(targetDay - workDay);
        if (interval < minIntervalBetweenGroupMembers) {
          return false;
        }
      }
      
      // 也檢查 lastWorkDay（如果有的話）
      if (lastWorkDay[groupMember.id]) {
        const interval = Math.abs(targetDay - lastWorkDay[groupMember.id]);
        if (interval < minIntervalBetweenGroupMembers) {
          return false;
        }
      }
    }
    
    return true;
  }

  // 更新成員工作歷史
  function updateWorkHistory(memberId, workDay) {
    if (!memberWorkHistory[memberId]) {
      memberWorkHistory[memberId] = [];
    }
    memberWorkHistory[memberId].push(workDay);
  }

  for(let d=1;d<=days;d++){
    const wd=new Date(`${ym}-${String(d).padStart(2,'0')}`).getDay();
    const shifts = (wd===0||wd===6)? WEEKEND_SHIFTS : WEEKDAY_SHIFTS;
    const isWeekend = (wd === 0 || wd === 6);
    
    // 記錄當天已排班的成員
    const dayMembers = new Set();
    const dayGroupMembers = {}; // 記錄當天已安排組別的成員
    
    // 隨機化組別順序
    const shuffledGroups = Object.keys(groupMembers).sort(() => Math.random() - 0.5);
    
    // 如果是假日，優先安排同組成員連續排班
    if (isWeekend && shifts.length >= 2) {
      // 嘗試為每個組別安排連續的班別
      for (const groupName of shuffledGroups) {
        const members = groupMembers[groupName];
        const availableGroupMembers = members.filter(m => 
          allMembers.includes(m) && !dayMembers.has(m) && pool.includes(m) &&
          canWorkOnDay(m, d) && canGroupWorkOnDay(m, d)
        );
        
        // 如果該組別有2個成員都可用，安排他們排班
        if (availableGroupMembers.length >= 2 && pool.length >= 2) {
          // 隨機決定排班方式：連續排班 或 同班別排班
          const assignmentType = Math.random() < 0.7; // 70%機率連續排班，30%機率同班別排班
          
          if (assignmentType) {
            // 連續排班：早中班或中晚班
            const possibleStarts = [0, 1]; // 0=早班開始(早中班), 1=中班開始(中晚班)
            const startShift = possibleStarts[Math.floor(Math.random() * possibleStarts.length)];
            const endShift = startShift + 2;
            
            let canAssign = true;
            // 檢查這些班別是否都還沒被安排
            for (let i = startShift; i < endShift; i++) {
              const key = `${ym}:${d}-${shifts[i].key}`;
              if (data[key]) {
                canAssign = false;
                break;
              }
            }
            
            if (canAssign) {
              // 隨機選擇2個同組成員
              const selectedMembers = [];
              const tempAvailable = [...availableGroupMembers];
              for (let i = 0; i < Math.min(2, tempAvailable.length); i++) {
                const randomIndex = Math.floor(Math.random() * tempAvailable.length);
                selectedMembers.push(tempAvailable[randomIndex]);
                tempAvailable.splice(randomIndex, 1);
              }
              
              // 安排連續班別
              for (let i = 0; i < selectedMembers.length && startShift + i < endShift; i++) {
                const key = `${ym}:${d}-${shifts[startShift + i].key}`;
                const member = selectedMembers[i];
                
                data[key] = member;
                dayMembers.add(member);
                updateWorkHistory(member, d); // 更新工作歷史
                
                // 從pool中移除
                const poolIndex = pool.findIndex(m => m === member);
                if (poolIndex !== -1) {
                  pool.splice(poolIndex, 1);
                }
                
                // 記錄該組別的成員
                if (!dayGroupMembers[groupName]) {
                  dayGroupMembers[groupName] = [];
                }
                dayGroupMembers[groupName].push(member);
              }
            }
          } else {
            // 同班別排班：同組成員排同一個班別
            const availableShifts = [];
            for (let i = 0; i < shifts.length; i++) {
              const key = `${ym}:${d}-${shifts[i].key}`;
              if (!data[key]) {
                availableShifts.push(i);
              }
            }
            
            if (availableShifts.length > 0) {
              const selectedShift = availableShifts[Math.floor(Math.random() * availableShifts.length)];
              const key = `${ym}:${d}-${shifts[selectedShift].key}`;
              
              // 隨機選擇2個同組成員排同一個班別
              const selectedMembers = [];
              const tempAvailable = [...availableGroupMembers];
              for (let i = 0; i < Math.min(2, tempAvailable.length); i++) {
                const randomIndex = Math.floor(Math.random() * tempAvailable.length);
                selectedMembers.push(tempAvailable[randomIndex]);
                tempAvailable.splice(randomIndex, 1);
              }
              
              // 安排同一個班別（取第一個成員）
              const member = selectedMembers[0];
              data[key] = member;
              dayMembers.add(member);
              updateWorkHistory(member, d); // 更新工作歷史
              
              // 從pool中移除
              const poolIndex = pool.findIndex(m => m === member);
              if (poolIndex !== -1) {
                pool.splice(poolIndex, 1);
              }
              
              // 記錄該組別的成員
              if (!dayGroupMembers[groupName]) {
                dayGroupMembers[groupName] = [];
              }
              dayGroupMembers[groupName].push(member);
            }
          }
        }
      }
    }
    
    // 為剩餘的班別安排成員
    for(const s of shifts){
      const key=`${ym}:${d}-${s.key}`;
      
      // 如果這個班別已經被安排了，跳過
      if (data[key]) continue;
      
      let assigned = false;
      
      // 優先選擇同組成員在同一天排班（隨機順序）
      for (const groupName of shuffledGroups) {
        const members = groupMembers[groupName];
        
        // 如果該組別今天已經安排了2個人，跳過
        if (dayGroupMembers[groupName] && dayGroupMembers[groupName].length >= 2) continue;
        
        const availableGroupMembers = members.filter(m => 
          allMembers.includes(m) && !dayMembers.has(m) && pool.includes(m) &&
          canWorkOnDay(m, d) && canGroupWorkOnDay(m, d)
        );
        
        if (availableGroupMembers.length >= 1 && pool.length > 0) {
          // 隨機選擇同組成員
          let selectedMember = null;
          
          // 如果該組別今天還沒有安排任何人，隨機選擇一個可用的
          if (!dayGroupMembers[groupName] || dayGroupMembers[groupName].length === 0) {
            selectedMember = availableGroupMembers[Math.floor(Math.random() * availableGroupMembers.length)];
          } else {
            // 如果該組別今天已經安排了一個人，選擇另一個同組成員
            const alreadyAssigned = dayGroupMembers[groupName];
            const remainingMembers = availableGroupMembers.filter(m => !alreadyAssigned.includes(m));
            if (remainingMembers.length > 0) {
              selectedMember = remainingMembers[Math.floor(Math.random() * remainingMembers.length)];
            }
          }
          
          if (selectedMember) {
            const poolIndex = pool.findIndex(m => m === selectedMember);
            if (poolIndex !== -1) {
              data[key] = selectedMember;
              dayMembers.add(selectedMember);
              updateWorkHistory(selectedMember, d); // 更新工作歷史
              
              // 記錄該組別的成員
              if (!dayGroupMembers[groupName]) {
                dayGroupMembers[groupName] = [];
              }
              dayGroupMembers[groupName].push(selectedMember);
              
              pool.splice(poolIndex, 1);
              assigned = true;
              break;
            }
          }
        }
      }
      
      // 如果沒有同組成員可排，則隨機分配（也要檢查間隔）
      if (!assigned && pool.length > 0) {
        // 優先選擇單人成員（間隔要求較寬鬆）
        const singleMembersInPool = pool.filter(m => singleMembers.has(m));
        const groupMembersInPool = pool.filter(m => groupedMembers.has(m));
        
        let selectedMember = null;
        
        // 先嘗試選擇單人成員
        if (singleMembersInPool.length > 0) {
          const availableSingles = singleMembersInPool.filter(m => {
            if (!canWorkOnDay(m, d)) return false;
            
            // 檢查當天已排班成員的條件限制
            const dayCheck = checkDayScheduleConditions(Array.from(dayMembers), m);
            return dayCheck.canAdd;
          });
          
          if (availableSingles.length > 0) {
            selectedMember = availableSingles[Math.floor(Math.random() * availableSingles.length)];
          }
        }
        
        // 如果沒有合適的單人成員，再考慮組隊成員
        if (!selectedMember && groupMembersInPool.length > 0) {
          const availableGroups = groupMembersInPool.filter(m => {
            if (!canWorkOnDay(m, d) || !canGroupWorkOnDay(m, d)) return false;
            
            // 檢查當天已排班成員的條件限制
            const dayCheck = checkDayScheduleConditions(Array.from(dayMembers), m);
            return dayCheck.canAdd;
          });
          
          if (availableGroups.length > 0) {
            selectedMember = availableGroups[Math.floor(Math.random() * availableGroups.length)];
          }
        }
        
        // 如果還是沒有合適的成員，選擇間隔最短的單人成員
        if (!selectedMember && singleMembersInPool.length > 0) {
          selectedMember = singleMembersInPool[0];
        }
        
        // 最後的備選：選擇間隔最短的組隊成員
        if (!selectedMember && groupMembersInPool.length > 0) {
          selectedMember = groupMembersInPool[0];
        }
        
        if (selectedMember) {
          data[key] = selectedMember;
          dayMembers.add(selectedMember);
          updateWorkHistory(selectedMember, d);
          lastWorkDay[selectedMember] = d; // 記錄最後排班日期
          
          // 從pool中移除
          const poolIndex = pool.findIndex(m => m === selectedMember);
          if (poolIndex !== -1) {
            pool.splice(poolIndex, 1);
          }
        }
      }
    }
  }

  localStorage.setItem(STORE_KEY,JSON.stringify(data));
  hydrate();
  renderMemberList(); // 更新成員統計
  updateDutyMember(); // 更新值班人員
  
  // 檢查排班結果
  const assignedCount = Object.keys(data).length;
  console.log(`排班完成，共安排了 ${assignedCount} 個班別`);
  console.log('排班資料:', data);
  
  // 統計組隊成員排班情況
  const groupStats = {};
  Object.entries(groupMembers).forEach(([groupName, members]) => {
    groupStats[groupName] = 0;
    members.forEach(memberId => {
      const memberShifts = Object.values(data).filter(member => member === memberId).length;
      groupStats[groupName] += memberShifts;
    });
  });
  
  console.log('組隊成員排班統計:', groupStats);
  
  let statsMessage = `✅ 已完成隨機平均排班\n共安排了 ${assignedCount} 個班別\n\n組隊成員排班統計：\n`;
  Object.entries(groupStats).forEach(([groupName, count]) => {
    const groupMembersList = groupMembers[groupName].map(id => {
      const member = MEMBERS.find(m => m.id === id);
      return `${id}${member ? member.name : ''}`;
    }).join('、');
    statsMessage += `組隊${groupName}: ${groupMembersList} (共${count}班)\n`;
  });
  
  // 添加單人成員統計
  const singleMemberStats = {};
  MEMBERS.filter(m => !m.group && !m.disabled).forEach(member => {
    const memberShifts = Object.values(data).filter(memberId => memberId === member.id).length;
    if (memberShifts > 0) {
      singleMemberStats[member.id] = memberShifts;
    }
  });
  
  if (Object.keys(singleMemberStats).length > 0) {
    statsMessage += `\n單人成員排班統計：\n`;
    Object.entries(singleMemberStats).forEach(([memberId, count]) => {
      const member = MEMBERS.find(m => m.id === memberId);
      statsMessage += `${memberId}${member ? member.name : ''}: ${count}班\n`;
    });
  }
  
  showCustomAlert(statsMessage, 'success');
  
  // 發送數據到 Google Sheets（使用覆蓋模式，從第2行開始重寫）
  // 異步執行，不阻塞用戶界面
  (async () => {
    const success = await sendScheduleToGoogleSheets(ym, data, 'update', '隨機平均排班');
    if (success) {
      // 顯示同步成功的通知
      showSyncNotification('📊 排班已同步到 Google Sheets');
    }
  })();
}

// 發送排班數據到 Google Sheets
async function sendScheduleToGoogleSheets(yearMonth, scheduleData, action = 'append', scheduleType = '隨機平均排班') {
  // 檢查是否已設定 Web App URL
  if (!GOOGLE_SHEETS_WEB_APP_URL || GOOGLE_SHEETS_WEB_APP_URL === 'YOUR_WEB_APP_URL_HERE') {
    console.warn('⚠️ Google Sheets Web App URL 尚未設定，跳過自動記錄');
    return false;
  }
  
  try {
    // 準備成員名稱對照表
    const memberNames = {};
    MEMBERS.forEach(member => {
      memberNames[member.id] = member.name;
    });
    
    // 準備要發送的數據
    const postData = {
      yearMonth: yearMonth,
      scheduleType: scheduleType,
      scheduleData: scheduleData,
      members: memberNames,
      timestamp: new Date().toISOString(),
      action: action // 'append' 追加新記錄，'update' 覆蓋更新
    };
    
    console.log(`📤 正在${action === 'update' ? '更新' : '發送'}排班數據到 Google Sheets...`);
    if (scheduleType === '隨機平均排班') {
      console.log('🔄 使用完全覆蓋模式，從第2行開始重寫所有資料');
    }
    
    // 發送 POST 請求到 Google Apps Script Web App
    const response = await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors', // 使用 no-cors 模式避免 CORS 問題
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData)
    });
    
    // 等待 Google Sheets 寫入完成（預估時間）
    const recordCount = Object.keys(scheduleData).length;
    const estimatedTime = Math.max(2000, recordCount * 50); // 至少2秒，每筆記錄約50ms
    
    console.log(`⏳ 等待 Google Sheets 寫入 ${recordCount} 筆資料...（預估 ${Math.round(estimatedTime/1000)} 秒）`);
    await new Promise(resolve => setTimeout(resolve, estimatedTime));
    
    console.log(`✅ 排班數據已${action === 'update' ? '更新到' : '發送到'} Google Sheets`);
    
    // 由於使用 no-cors 模式，無法讀取回應內容
    // 但請求已成功發送
    return true;
    
  } catch (error) {
    console.error('❌ 發送數據到 Google Sheets 時發生錯誤:', error);
    // 不顯示錯誤提示，避免影響用戶體驗
    return false;
  }
}

// 更新單筆排班到 Google Sheets（換班專用 - 只更新一行）
async function updateSingleScheduleToSheets(yearMonth, day, shift, memberId) {
  if (!GOOGLE_SHEETS_WEB_APP_URL || GOOGLE_SHEETS_WEB_APP_URL === 'YOUR_WEB_APP_URL_HERE') {
    console.warn('⚠️ Google Sheets Web App URL 尚未設定，跳過同步');
    return false;
  }
  
  try {
    // 獲取成員姓名
    const memberName = MEMBERS.find(m => m.id === memberId)?.name || memberId;
    
    // 判斷是否為假日
    const dateStr = `${yearMonth}-${String(day).padStart(2, '0')}`;
    const weekday = new Date(dateStr).getDay();
    const isWeekend = (weekday === 0 || weekday === 6);
    
    // 根據班別和日期類型確定時段
    let shiftTime = '';
    if (isWeekend) {
      // 假日時段
      if (shift === 'morning') shiftTime = '09:30-13:30';
      else if (shift === 'noon') shiftTime = '13:30-17:30';
      else if (shift === 'evening') shiftTime = '17:30-21:00';
    } else {
      // 平日時段
      if (shift === 'morning') shiftTime = '09:30-15:30';
      else if (shift === 'evening') shiftTime = '15:30-21:00';
    }
    
    // 準備要發送的數據
    const postData = {
      dataType: 'singleUpdate',
      yearMonth: yearMonth,
      day: day,
      shiftKey: shift,
      memberId: memberId,
      memberName: memberName,
      shiftTime: shiftTime
    };
    
    console.log(`📤 正在更新單筆排班到 Google Sheets: ${yearMonth} 日期${day} ${shift} → ${memberName}(${memberId})`);
    
    // 發送 POST 請求
    const response = await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData)
    });
    
    // 等待寫入完成
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log(`✅ 單筆排班已更新到 Google Sheets`);
    return true;
    
  } catch (error) {
    console.error('❌ 更新單筆排班時發生錯誤:', error);
    return false;
  }
}

// 同步當前月份的完整排班到 Google Sheets（覆蓋更新）
async function syncCurrentMonthToGoogleSheets(scheduleType = '手動換班') {
  const ym = document.getElementById('monthPicker').value;
  const allData = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  
  // 只提取當前月份的排班數據
  const monthData = {};
  Object.keys(allData).forEach(key => {
    if (key.startsWith(ym + ':')) {
      monthData[key] = allData[key];
    }
  });
  
  // 使用 update 模式發送（會先刪除舊記錄再寫入新記錄）
  await sendScheduleToGoogleSheets(ym, monthData, 'update', scheduleType);
}

// 發送鑰匙記錄到 Google Sheets
async function sendKeyRecordToGoogleSheets(record, action) {
  // 檢查是否已設定 Web App URL
  if (!GOOGLE_SHEETS_WEB_APP_URL || GOOGLE_SHEETS_WEB_APP_URL === 'YOUR_WEB_APP_URL_HERE') {
    console.warn('⚠️ Google Sheets Web App URL 尚未設定，跳過鑰匙記錄');
    return;
  }
  
  try {
    const postData = {
      dataType: 'key',
      action: action, // 'borrow', 'return', 'confirm'
      record: record
    };
    
    console.log(`📤 正在${action === 'borrow' ? '記錄鑰匙借出' : action === 'return' ? '更新歸還記錄' : '更新值班確認'}到 Google Sheets...`);
    
    const response = await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(postData)
    });
    
    console.log(`✅ 鑰匙記錄已${action === 'borrow' ? '寫入' : '更新到'} Google Sheets`);
    
  } catch (error) {
    console.error('❌ 發送鑰匙記錄到 Google Sheets 時發生錯誤:', error);
  }
}

// 從 Google Sheets 讀取鑰匙借還記錄（使用 JSONP）
async function loadKeyRecordsFromGoogleSheets() {
  if (!GOOGLE_SHEETS_WEB_APP_URL || GOOGLE_SHEETS_WEB_APP_URL === 'YOUR_WEB_APP_URL_HERE') {
    console.warn('⚠️ Google Sheets Web App URL 尚未設定');
    return null;
  }
  
  return new Promise((resolve) => {
    try {
      console.log('📥 正在從 Google Sheets 讀取鑰匙借還記錄...');
      
      const callbackName = 'keyCallback_' + Date.now();
      const url = `${GOOGLE_SHEETS_WEB_APP_URL}?action=getKeys&callback=${callbackName}`;
      
      window[callbackName] = function(result) {
        delete window[callbackName];
        const scriptTag = document.getElementById(callbackName);
        if (scriptTag) scriptTag.remove();
        
        if (result.status === 'success') {
          console.log(`✅ 成功讀取 ${result.recordCount} 筆鑰匙記錄`);
          resolve(result.data);
        } else {
          console.error('❌ 讀取失敗:', result.message);
          resolve(null);
        }
      };
      
      const script = document.createElement('script');
      script.id = callbackName;
      script.src = url;
      script.onerror = () => {
        delete window[callbackName];
        console.error('❌ 載入鑰匙記錄失敗');
        resolve(null);
      };
      
      document.head.appendChild(script);
      
      // 超時處理
      setTimeout(() => {
        if (window[callbackName]) {
          delete window[callbackName];
          const scriptTag = document.getElementById(callbackName);
          if (scriptTag) scriptTag.remove();
          console.error('❌ 讀取鑰匙記錄超時');
          resolve(null);
        }
      }, 30000);
      
    } catch (error) {
      console.error('❌ 讀取鑰匙記錄錯誤:', error);
      resolve(null);
    }
  });
}

// 自動載入鑰匙記錄（載入所有記錄，保留最近30天）
async function autoLoadTodayKeyRecords() {
  try {
    console.log('🔄 自動從 Google Sheets 載入鑰匙記錄...');
    const sheetsRecords = await loadKeyRecordsFromGoogleSheets();
    
    if (!sheetsRecords || sheetsRecords.length === 0) {
      console.log('📝 Google Sheets 中暫無鑰匙記錄');
      return;
    }
    
    // 轉換 Sheets 記錄格式為本地格式
    const localRecords = [];
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    sheetsRecords.forEach(sheetRecord => {
      // 載入最近30天的記錄
      const borrowDate = sheetRecord.borrowTime ? new Date(sheetRecord.borrowTime) : null;
      
      if (borrowDate && borrowDate >= thirtyDaysAgo) {
        // 轉換為本地記錄格式
        const localRecord = {
          id: sheetRecord.id || Date.now(),
          time: borrowDate ? `${borrowDate.getMonth()+1}/${borrowDate.getDate()} ${borrowDate.getHours().toString().padStart(2,'0')}:${borrowDate.getMinutes().toString().padStart(2,'0')}` : '',
          borrowerType: sheetRecord.borrowerType === '同業' ? 'colleague' : 'member',
          memberId: sheetRecord.borrowerId || null,
          memberName: sheetRecord.borrowerType === '成員' ? sheetRecord.borrowerName : null,
          colleagueName: sheetRecord.borrowerType === '同業' ? sheetRecord.borrowerName : null,
          colleaguePhone: sheetRecord.borrowerPhone ? cleanPhoneNumber(sheetRecord.borrowerPhone) : null,
          displayName: sheetRecord.borrowerType === '同業' 
            ? (sheetRecord.borrowerPhone ? `${sheetRecord.borrowerName} (${cleanPhoneNumber(sheetRecord.borrowerPhone)})` : sheetRecord.borrowerName)
            : `${sheetRecord.borrowerId} ${sheetRecord.borrowerName}`,
          keyItem: sheetRecord.keyItem,
          status: sheetRecord.status === '已歸還' ? 'returned' : 'borrowed',
          borrowTime: borrowDate ? borrowDate.toISOString() : new Date().toISOString(),
          dutyConfirmed: sheetRecord.dutyConfirmedBy ? true : false,
          dutyConfirmedBy: sheetRecord.dutyConfirmedBy || null,
          dutyConfirmedTime: null
        };
        
        // 處理歸還時間
        if (sheetRecord.returnTime) {
          const returnDate = new Date(sheetRecord.returnTime);
          localRecord.returnTime = returnDate.toISOString();
          localRecord.returnTimeStr = `${returnDate.getMonth()+1}/${returnDate.getDate()} ${returnDate.getHours().toString().padStart(2,'0')}:${returnDate.getMinutes().toString().padStart(2,'0')}`;
        }
        
        localRecords.push(localRecord);
      }
    });
    
    if (localRecords.length > 0) {
      // ⭐ 完全同步模式：先清空舊記錄，再載入 Sheets 的最新記錄
      // 這樣可以確保本地和 Sheets 完全一致（包括刪除和狀態變更）
      
      console.log(`🔄 完全同步模式：清空本地記錄，重新載入 ${localRecords.length} 筆最新記錄`);
      
      // 直接使用從 Sheets 讀取的記錄替換本地記錄
      localStorage.setItem(KEY_RECORD_KEY, JSON.stringify(localRecords));
      renderKeyTable();
      
      console.log(`✅ 已完全同步 ${localRecords.length} 筆鑰匙記錄（共 ${sheetsRecords.length} 筆，保留最近30天）`);
      showSyncNotification(`🔑 已完全同步 ${localRecords.length} 筆鑰匙記錄`);
    } else {
      console.log(`📝 Google Sheets 中無最近30天的鑰匙記錄（共 ${sheetsRecords.length} 筆，但都超過30天）`);
      
      // 如果 Sheets 中沒有最近30天的記錄，也清空本地記錄
      localStorage.setItem(KEY_RECORD_KEY, JSON.stringify([]));
      renderKeyTable();
    }
  } catch (error) {
    console.error('❌ 自動載入鑰匙記錄失敗:', error);
  }
}

// 從 Sheets 同步鑰匙記錄到本地（手動同步，載入最近30天）
async function syncTodayKeyRecordsFromSheets() {
  const sheetsRecords = await loadKeyRecordsFromGoogleSheets();
  
  if (!sheetsRecords || sheetsRecords.length === 0) {
    showCustomAlert('Google Sheets 中沒有鑰匙記錄', 'error');
    return;
  }
  
  // 轉換 Sheets 記錄格式為本地格式
  const localRecords = [];
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  sheetsRecords.forEach(sheetRecord => {
    // 載入最近30天的記錄
    const borrowDate = sheetRecord.borrowTime ? new Date(sheetRecord.borrowTime) : null;
    
    if (borrowDate && borrowDate >= thirtyDaysAgo) {
      // 轉換為本地記錄格式
      const localRecord = {
        id: sheetRecord.id || Date.now(),
        time: borrowDate ? `${borrowDate.getMonth()+1}/${borrowDate.getDate()} ${borrowDate.getHours().toString().padStart(2,'0')}:${borrowDate.getMinutes().toString().padStart(2,'0')}` : '',
        borrowerType: sheetRecord.borrowerType === '同業' ? 'colleague' : 'member',
        memberId: sheetRecord.borrowerId || null,
        memberName: sheetRecord.borrowerType === '成員' ? sheetRecord.borrowerName : null,
        colleagueName: sheetRecord.borrowerType === '同業' ? sheetRecord.borrowerName : null,
        colleaguePhone: sheetRecord.borrowerPhone ? cleanPhoneNumber(sheetRecord.borrowerPhone) : null,
        displayName: sheetRecord.borrowerType === '同業' 
          ? (sheetRecord.borrowerPhone ? `${sheetRecord.borrowerName} (${cleanPhoneNumber(sheetRecord.borrowerPhone)})` : sheetRecord.borrowerName)
          : `${sheetRecord.borrowerId} ${sheetRecord.borrowerName}`,
        keyItem: sheetRecord.keyItem,
        status: sheetRecord.status === '已歸還' ? 'returned' : 'borrowed',
        borrowTime: borrowDate ? borrowDate.toISOString() : new Date().toISOString(),
        dutyConfirmed: sheetRecord.dutyConfirmedBy ? true : false,
        dutyConfirmedBy: sheetRecord.dutyConfirmedBy || null,
        dutyConfirmedTime: null
      };
      
      // 處理歸還時間
      if (sheetRecord.returnTime) {
        const returnDate = new Date(sheetRecord.returnTime);
        localRecord.returnTime = returnDate.toISOString();
        localRecord.returnTimeStr = `${returnDate.getMonth()+1}/${returnDate.getDate()} ${returnDate.getHours().toString().padStart(2,'0')}:${returnDate.getMinutes().toString().padStart(2,'0')}`;
      }
      
      localRecords.push(localRecord);
    }
  });
  
  if (localRecords.length === 0) {
    showCustomAlert(`Google Sheets 中沒有最近30天的鑰匙記錄（共 ${sheetsRecords.length} 筆，但都超過30天）`, 'error');
    
    // 如果 Sheets 中沒有最近30天的記錄，也清空本地記錄
    localStorage.setItem(KEY_RECORD_KEY, JSON.stringify([]));
    renderKeyTable();
    return;
  }
  
  // ⭐ 完全同步模式：直接用 Sheets 的記錄替換本地記錄
  localStorage.setItem(KEY_RECORD_KEY, JSON.stringify(localRecords));
  renderKeyTable();
  
  showCustomAlert(`✅ 已從 Google Sheets 完全同步 ${localRecords.length} 筆鑰匙記錄`, 'success');
  showSyncNotification('🔑 鑰匙記錄已完全同步');
}

// 從 Google Sheets 讀取鑰匙名稱清單（使用 JSONP）
async function loadKeyListFromGoogleSheets() {
  if (!GOOGLE_SHEETS_WEB_APP_URL || GOOGLE_SHEETS_WEB_APP_URL === 'YOUR_WEB_APP_URL_HERE') {
    console.warn('⚠️ Google Sheets Web App URL 尚未設定');
    return null;
  }
  
  return new Promise((resolve) => {
    try {
      console.log('📥 正在從 Google Sheets 讀取鑰匙名稱清單...');
      
      const callbackName = 'keyListCallback_' + Date.now();
      const url = `${GOOGLE_SHEETS_WEB_APP_URL}?action=getKeyList&callback=${callbackName}`;
      
      window[callbackName] = function(result) {
        delete window[callbackName];
        const scriptTag = document.getElementById(callbackName);
        if (scriptTag) scriptTag.remove();
        
        if (result.status === 'success') {
          console.log(`✅ 成功讀取 ${result.recordCount} 個鑰匙項目`);
          resolve(result.data);
        } else {
          console.error('❌ 讀取失敗:', result.message);
          resolve(null);
        }
      };
      
      const script = document.createElement('script');
      script.id = callbackName;
      script.src = url;
      script.onerror = () => {
        delete window[callbackName];
        console.error('❌ 載入鑰匙名稱清單失敗');
        resolve(null);
      };
      
      document.head.appendChild(script);
      
      // 超時處理
      setTimeout(() => {
        if (window[callbackName]) {
          delete window[callbackName];
          const scriptTag = document.getElementById(callbackName);
          if (scriptTag) scriptTag.remove();
          console.error('❌ 讀取鑰匙名稱清單超時');
          resolve(null);
        }
      }, 15000);
      
    } catch (error) {
      console.error('❌ 讀取鑰匙名稱清單錯誤:', error);
      resolve(null);
    }
  });
}

// 載入並快取鑰匙名稱清單
async function loadAndCacheKeyList() {
  const keyList = await loadKeyListFromGoogleSheets();
  
  if (keyList && keyList.length > 0) {
    keyNameList = keyList;
    localStorage.setItem(KEY_LIST_KEY, JSON.stringify(keyList));
    console.log(`✅ 已載入 ${keyList.length} 個鑰匙項目到搜尋清單`);
    
    // 初始化搜索功能
    initKeySearch();
  } else {
    // 如果 Sheets 沒有資料，嘗試從本地讀取
    const cached = localStorage.getItem(KEY_LIST_KEY);
    if (cached) {
      keyNameList = JSON.parse(cached);
      console.log(`📦 從快取載入 ${keyNameList.length} 個鑰匙項目`);
      initKeySearch();
    } else {
      console.log('📝 尚無鑰匙名稱清單');
    }
  }
}

// 初始化鑰匙搜索功能
function initKeySearch() {
  const keyInput = document.getElementById('keyItem');
  if (!keyInput) return;
  
  // 創建搜索建議下拉框
  let searchDropdown = document.getElementById('keySearchDropdown');
  if (!searchDropdown) {
    searchDropdown = document.createElement('div');
    searchDropdown.id = 'keySearchDropdown';
    searchDropdown.style.cssText = `
      position: absolute;
      background: white;
      border: 2px solid #667eea;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-height: 300px;
      overflow-y: auto;
      z-index: 1000;
      display: none;
      width: ${keyInput.offsetWidth}px;
    `;
    keyInput.parentElement.style.position = 'relative';
    keyInput.parentElement.appendChild(searchDropdown);
  }
  
  // 監聽輸入事件
  keyInput.addEventListener('input', function() {
    const searchText = this.value.trim().toLowerCase();
    
    if (searchText.length === 0) {
      searchDropdown.style.display = 'none';
      return;
    }
    
    // 過濾匹配的鑰匙項目
    const matches = keyNameList.filter(key => 
      key.name.toLowerCase().includes(searchText) ||
      (key.category && key.category.toLowerCase().includes(searchText))
    );
    
    if (matches.length > 0) {
      searchDropdown.innerHTML = matches.map(key => `
        <div class="key-search-item" 
          onclick="selectKeyFromSearch('${key.name}')"
          style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #eee; transition: all 0.2s;"
          onmouseover="this.style.background='#f0f7ff'"
          onmouseout="this.style.background='white'">
          <div style="font-weight: 600; color: #333; margin-bottom: 2px;">${key.name}</div>
          ${key.category ? `<div style="font-size: 11px; color: #666;">分類：${key.category}</div>` : ''}
        </div>
      `).join('');
      searchDropdown.style.display = 'block';
    } else {
      searchDropdown.style.display = 'none';
    }
  });
  
  // 點擊外部關閉下拉框
  document.addEventListener('click', function(e) {
    if (e.target !== keyInput && !searchDropdown.contains(e.target)) {
      searchDropdown.style.display = 'none';
    }
  });
}

// 從搜索建議中選擇鑰匙項目
function selectKeyFromSearch(keyName) {
  const keyInput = document.getElementById('keyItem');
  const searchDropdown = document.getElementById('keySearchDropdown');
  
  if (keyInput) {
    keyInput.value = keyName;
    searchDropdown.style.display = 'none';
    keyInput.focus();
  }
}

// 顯示同步成功通知
function showSyncNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
    padding: 15px 25px;
    border-radius: 10px;
    z-index: 10000;
    font-size: 16px;
    font-weight: bold;
    box-shadow: 0 4px 15px rgba(40, 167, 69, 0.4);
    animation: slideInRight 0.5s ease-out;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // 3秒後淡出並移除
  setTimeout(() => {
    notification.style.animation = 'fadeOut 0.5s ease-out';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 500);
  }, 3000);
}

// 開啟 Google Sheets
function openGoogleSheets() {
  const sheetsUrl = 'https://docs.google.com/spreadsheets/d/1_eujc5OwWR4riQ0oAkGbkkIQQXaX5U3a9xCLvi_qgoU/edit';
  
  showConfirmModal(
    '📊 開啟 Google Sheets',
    '即將在新分頁開啟 Google Sheets 排班記錄',
    '您可以查看最新的排班和鑰匙借還記錄',
    () => {
      window.open(sheetsUrl, '_blank');
      showSyncNotification('📊 已開啟 Google Sheets');
    }
  );
}

// 執行管理功能（下拉選單）
function executeAdminAction(action) {
  if (!action) return; // 如果選擇的是預設選項，不執行任何操作
  
  // 重置選單到預設選項
  const select = document.getElementById('adminActionSelect');
  if (select) select.value = '';
  
  // 執行對應的功能
  switch(action) {
    case 'autoAssign':
      requirePassword('autoAssign');
      break;
    case 'clearData':
      requirePassword('clearData');
      break;
    case 'showStatistics':
      requirePassword('showStatistics');
      break;
    case 'syncFromSheets':
      requirePassword('syncFromSheets');
      break;
    case 'openSheets':
      requirePassword('openSheets');
      break;
    case 'showScheduleConditions':
      showScheduleConditions();
      break;
  }
}

// 顯示排班條件設定
function showScheduleConditions() {
  const summary = getScheduleConditionsSummary();
  showCustomAlert(summary, 'info');
}

// 從 Google Sheets 讀取排班資料（使用 JSONP 避免 CORS 問題）
async function loadScheduleFromGoogleSheets(yearMonth) {
  if (!GOOGLE_SHEETS_WEB_APP_URL || GOOGLE_SHEETS_WEB_APP_URL === 'YOUR_WEB_APP_URL_HERE') {
    showCustomAlert('⚠️ Google Sheets Web App URL 尚未設定', 'error');
    return null;
  }
  
  return new Promise((resolve, reject) => {
    try {
      console.log(`📥 正在從 Google Sheets 讀取 ${yearMonth || '所有'} 排班資料...`);
      
      // 生成唯一的 callback 函數名稱
      const callbackName = 'jsonpCallback_' + Date.now();
      
      // 建立 JSONP 請求
      const url = yearMonth 
        ? `${GOOGLE_SHEETS_WEB_APP_URL}?action=getSchedule&yearMonth=${yearMonth}&callback=${callbackName}`
        : `${GOOGLE_SHEETS_WEB_APP_URL}?action=getSchedule&callback=${callbackName}`;
      
      // 定義全局 callback 函數
      window[callbackName] = function(result) {
        // 清除 script 標籤和 callback 函數
        delete window[callbackName];
        const scriptTag = document.getElementById(callbackName);
        if (scriptTag) {
          scriptTag.parentNode.removeChild(scriptTag);
        }
        
        if (result.status === 'success') {
          console.log(`✅ 成功讀取 ${result.recordCount} 筆排班記錄`);
          
          // 顯示調試信息
          if (result.debug) {
            console.log('📊 調試信息:', result.debug);
          }
          
          // 顯示部分數據樣本
          if (result.data && Object.keys(result.data).length > 0) {
            const sampleKeys = Object.keys(result.data).slice(0, 5);
            console.log('📝 數據樣本:', sampleKeys.map(k => `${k} => ${result.data[k]}`).join(', '));
          }
          
          resolve(result.data);
        } else {
          console.error('❌ 讀取失敗:', result.message);
          showCustomAlert(`讀取失敗：${result.message}`, 'error');
          resolve(null);
        }
      };
      
      // 建立 script 標籤來發送 JSONP 請求
      const script = document.createElement('script');
      script.id = callbackName;
      script.src = url;
      
      console.log('📡 JSONP 請求 URL:', url);
      
      script.onload = function() {
        console.log('✅ JSONP script 載入成功');
      };
      
      script.onerror = function(error) {
        delete window[callbackName];
        console.error('❌ JSONP script 載入失敗');
        console.error('錯誤詳情:', error);
        console.error('請求 URL:', url);
        console.error('可能原因：1) Apps Script 未部署 2) URL 不正確 3) 網路問題');
        resolve(null);
      };
      
      document.head.appendChild(script);
      console.log('✅ JSONP script 標籤已添加到頁面');
      
      // 設置超時（30秒）
      setTimeout(() => {
        if (window[callbackName]) {
          delete window[callbackName];
          const scriptTag = document.getElementById(callbackName);
          if (scriptTag) {
            scriptTag.parentNode.removeChild(scriptTag);
          }
          console.error('❌ 讀取 Google Sheets 超時');
          resolve(null);
        }
      }, 30000);
      
    } catch (error) {
      console.error('❌ 從 Google Sheets 讀取資料時發生錯誤:', error);
      resolve(null);
    }
  });
}

// 同步排班：從 Google Sheets 讀取並更新本地
async function syncScheduleFromSheets() {
  const ym = document.getElementById('monthPicker').value;
  
  showConfirmModal(
    '🔄 從 Google Sheets 同步排班',
    `確定要從 Google Sheets 讀取 ${ym} 的排班資料嗎？`,
    '這會覆蓋本地的排班資料！',
    async () => {
      const scheduleData = await loadScheduleFromGoogleSheets(ym);
      
      if (scheduleData) {
        // 更新 localStorage
        const allData = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
        
        // 刪除本地該月份的舊排班
        Object.keys(allData).forEach(key => {
          if (key.startsWith(ym + ':')) {
            delete allData[key];
          }
        });
        
        // 合併 Google Sheets 的資料
        Object.assign(allData, scheduleData);
        
        localStorage.setItem(STORE_KEY, JSON.stringify(allData));
        
        // 重新渲染
        buildGrid();
        renderMemberList();
        updateDutyMember();
        
        showCustomAlert(`✅ 已從 Google Sheets 同步 ${Object.keys(scheduleData).length} 筆排班記錄`, 'success');
        showSyncNotification('📥 排班已從 Google Sheets 同步');
      }
    }
  );
}

// 首次自動載入標記
let isFirstAutoLoad = true;

// 自動從 Google Sheets 刷新排班（定時或手動）
async function autoRefreshFromSheets(showLoadingHint = false) {
  const ym = document.getElementById('monthPicker').value;
  
  if (showLoadingHint || isFirstAutoLoad) {
    console.log('🔄 正在從 Google Sheets 載入最新班表...');
  } else {
    console.log('🔄 自動刷新：檢查 Google Sheets 是否有更新...');
  }
  
  const scheduleData = await loadScheduleFromGoogleSheets(ym);
  
  if (scheduleData) {
    const allData = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    
    // 比較本地和 Sheets 的資料是否一致
    let hasChanges = false;
    const localMonthData = {};
    Object.keys(allData).forEach(key => {
      if (key.startsWith(ym + ':')) {
        localMonthData[key] = allData[key];
      }
    });
    
    // 檢查是否有差異
    const localKeys = Object.keys(localMonthData).sort();
    const sheetsKeys = Object.keys(scheduleData).sort();
    
    if (localKeys.length !== sheetsKeys.length) {
      hasChanges = true;
    } else {
      for (let i = 0; i < localKeys.length; i++) {
        if (localKeys[i] !== sheetsKeys[i] || localMonthData[localKeys[i]] !== scheduleData[sheetsKeys[i]]) {
          hasChanges = true;
          break;
        }
      }
    }
    
    if (hasChanges) {
      console.log('🔄 檢測到 Google Sheets 有更新，正在同步...');
      
      // 刪除本地該月份的舊排班
      Object.keys(allData).forEach(key => {
        if (key.startsWith(ym + ':')) {
          delete allData[key];
        }
      });
      
      // 合併 Google Sheets 的資料
      Object.assign(allData, scheduleData);
      
      localStorage.setItem(STORE_KEY, JSON.stringify(allData));
      
      // 重新渲染
      buildGrid();
      renderMemberList();
      updateDutyMember();
      
      if (isFirstAutoLoad) {
        const recordCount = Object.keys(scheduleData).length;
        if (recordCount > 0) {
          showSyncNotification(`✅ 已自動載入最新班表（${recordCount} 筆記錄）`);
        } else {
          showSyncNotification('✅ 已連線 Google Sheets（目前無排班記錄）');
        }
      } else {
        showSyncNotification('📥 已從 Google Sheets 同步最新排班');
      }
    } else {
      console.log('✅ 排班資料已是最新，無需更新');
      if (isFirstAutoLoad) {
        const recordCount = Object.keys(scheduleData).length;
        
        // ⭐ 首次載入時，即使資料一致也要重新渲染（確保顯示最新數據）
        if (recordCount > 0) {
          // 確保本地有最新資料
          Object.keys(allData).forEach(key => {
            if (key.startsWith(ym + ':')) {
              delete allData[key];
            }
          });
          Object.assign(allData, scheduleData);
          localStorage.setItem(STORE_KEY, JSON.stringify(allData));
          
          // 重新渲染
          buildGrid();
          renderMemberList();
          updateDutyMember();
          
          console.log(`📋 班表已載入完成（${recordCount} 筆記錄）`);
          showSyncNotification(`✅ 班表已同步（${recordCount} 筆記錄）`);
        } else {
          console.log('📋 Google Sheets 連線成功，目前無排班記錄');
          showSyncNotification('✅ 已連線 Google Sheets（目前無排班記錄）');
        }
      }
    }
    
    // 首次載入完成後重置標記
    if (isFirstAutoLoad) {
      isFirstAutoLoad = false;
    }
  }
}

// 添加動畫樣式
if (!document.getElementById('syncNotificationStyles')) {
  const style = document.createElement('style');
  style.id = 'syncNotificationStyles';
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes fadeOut {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// 快速填班功能
function quickFill(){
  const member=document.getElementById('memberInput').value;
  if(!member){
    showCustomAlert('請先選擇成員', 'error');
    return;
  }
  const memberObj = MEMBERS.find(m => m.id === member);
  if(memberObj && EXCLUDED_MEMBERS.includes(memberObj.id)){
    showCustomAlert(`『${memberObj.name}』不列入排班`, 'error');
    return;
  }
  
  const memberName = MEMBERS.find(m=>m.id===member)?.name || member;
  showConfirmModal(
    '⚡ 快速填班',
    `確定要為「${memberName}」快速填滿本月所有空班嗎？`,
    '此操作會覆蓋所有空班位置',
    () => {
      executeQuickFill();
    }
  );
}

function executeQuickFill(){
  const member=document.getElementById('memberInput').value;
  
  const ym=document.getElementById('monthPicker').value;
  const days=daysInMonth(ym);
  const data=JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
  
  for(let d=1;d<=days;d++){
    const wd=new Date(`${ym}-${String(d).padStart(2,'0')}`).getDay();
    const shifts = (wd===0||wd===6)? WEEKEND_SHIFTS : WEEKDAY_SHIFTS;
    for(const s of shifts){
      const key=`${ym}:${d}-${s.key}`;
      if(!data[key]){ // 只填空班
        data[key]=member;
      }
    }
  }
  
  localStorage.setItem(STORE_KEY,JSON.stringify(data));
  hydrate();
  renderMemberList(); // 更新成員統計
  updateDutyMember(); // 更新值班人員
  
  showCustomAlert(`✅ 已為「${memberName}」填滿本月空班`, 'success');
  
  // 同步到 Google Sheets（異步執行）
  (async () => {
    await syncCurrentMonthToGoogleSheets('快速填班');
    showSyncNotification('📊 排班已同步到 Google Sheets');
  })();
}

// 複製上週排班
function copyWeek(){
  const ym=document.getElementById('monthPicker').value;
  const [year, month] = ym.split('-').map(Number);
  
  // 計算上週的月份
  let lastMonth = month - 1;
  let lastYear = year;
  if(lastMonth === 0){
    lastMonth = 12;
    lastYear = year - 1;
  }
  
  const lastYm = `${lastYear}-${String(lastMonth).padStart(2,'0')}`;
  const lastData = JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
  
  // 檢查是否有上個月資料
  const hasLastMonthData = Object.keys(lastData).some(k => k.startsWith(lastYm+':'));
  if(!hasLastMonthData){
    showCustomAlert('上個月沒有排班資料可以複製', 'error');
    return;
  }
  
  showConfirmModal(
    '📋 複製上週排班',
    `確定要複製 ${lastYm} 的排班到 ${ym} 嗎？`,
    '此操作會覆蓋現有資料！',
    () => {
      executeCopyWeek();
    }
  );
}

function executeCopyWeek(){
  const ym=document.getElementById('monthPicker').value;
  const [year, month] = ym.split('-').map(Number);
  
  // 計算上週的月份
  let lastMonth = month - 1;
  let lastYear = year;
  if(lastMonth === 0){
    lastMonth = 12;
    lastYear = year - 1;
  }
  
  const lastYm = `${lastYear}-${String(lastMonth).padStart(2,'0')}`;
  const lastData = JSON.parse(localStorage.getItem(STORE_KEY)||'{}');
  
  const currentData = {};
  const days = daysInMonth(ym);
  
  // 複製上個月最後一週的排班模式
  for(let d=1;d<=days;d++){
    const wd=new Date(`${ym}-${String(d).padStart(2,'0')}`).getDay();
    const shifts = (wd===0||wd===6)? WEEKEND_SHIFTS : WEEKDAY_SHIFTS;
    
    for(const s of shifts){
      const key=`${ym}:${d}-${s.key}`;
      // 簡單複製：用日期對應（例如：本月1號對應上月最後一週的1號）
      const lastMonthDays = daysInMonth(lastYm);
      const copyDay = Math.min(d, lastMonthDays);
      const lastKey = `${lastYm}:${copyDay}-${s.key}`;
      
      if(lastData[lastKey]){
        currentData[key] = lastData[lastKey];
      }
    }
  }
  
  localStorage.setItem(STORE_KEY,JSON.stringify(currentData));
  hydrate();
  renderMemberList(); // 更新成員統計
  updateDutyMember(); // 更新值班人員
  showCustomAlert(`✅ 已複製 ${lastYm} 的排班到 ${ym}`, 'success');
}


// 處理公司選擇變更
function handleCompanyChange() {
  const companySelect = document.getElementById('colleagueCompany');
  const customInput = document.getElementById('colleagueCustomInput');
  const nameInput = document.getElementById('colleagueName');
  const historySelectDiv = document.getElementById('companyHistorySelect');
  
  if (companySelect.value === '其它') {
    customInput.style.display = 'block';
    historySelectDiv.style.display = 'none';
    document.getElementById('colleagueCustomCompany').focus();
  } else {
    customInput.style.display = 'none';
    
    if (companySelect.value) {
      // 顯示該品牌的歷史記錄下拉選單
      updateCompanyHistoryDropdown(companySelect.value);
      nameInput.focus();
    } else {
      historySelectDiv.style.display = 'none';
    }
  }
}

// 更新品牌歷史記錄下拉選單
function updateCompanyHistoryDropdown(companyName) {
  const historySelectDiv = document.getElementById('companyHistorySelect');
  const dropdown = document.getElementById('colleagueHistoryDropdown');
  
  if (!dropdown) return;
  
  // 獲取該品牌的歷史記錄
  const allHistory = JSON.parse(localStorage.getItem(COLLEAGUE_HISTORY_KEY) || '{}');
  const companyHistory = allHistory[companyName] || [];
  
  // 清空下拉選單
  dropdown.innerHTML = '<option value="">-- 選擇常用記錄 --</option>';
  
  if (companyHistory.length === 0) {
    historySelectDiv.style.display = 'none';
    return;
  }
  
  // 顯示該品牌的歷史記錄
  historySelectDiv.style.display = 'block';
  
  companyHistory.forEach(record => {
    const option = document.createElement('option');
    option.value = record;
    
    // 顯示格式：如果有電話就顯示（姓名 - 電話），否則只顯示姓名
    const parts = record.split('|');
    if (parts.length > 1 && parts[1]) {
      option.textContent = `${parts[0]} - ${parts[1]}`;
    } else {
      option.textContent = parts[0];
    }
    
    dropdown.appendChild(option);
  });
}

// 從歷史記錄下拉選單選擇
function selectFromHistoryDropdown() {
  const dropdown = document.getElementById('colleagueHistoryDropdown');
  const nameInput = document.getElementById('colleagueName');
  const phoneInput = document.getElementById('colleaguePhone');
  
  if (dropdown.value) {
    // 解析姓名和電話（格式：姓名|電話 或 姓名）
    const parts = dropdown.value.split('|');
    nameInput.value = parts[0].trim();
    if (parts.length > 1 && parts[1]) {
      phoneInput.value = parts[1].trim();
    }
    document.getElementById('keyItem').focus();
  }
}

// 切換借出類型
function switchBorrowType(type) {
  currentBorrowType = type;
  
  const memberSection = document.getElementById('memberBorrowSection');
  const colleagueSection = document.getElementById('colleagueBorrowSection');
  
  if (type === 'member') {
    memberSection.style.display = 'block';
    colleagueSection.style.display = 'none';
    document.getElementById('keyItem').focus();
  } else {
    memberSection.style.display = 'none';
    colleagueSection.style.display = 'block';
    document.getElementById('colleagueCompany').focus();
  }
}

// 保存同業到歷史記錄（按品牌分組，包含電話）
function saveColleagueToHistory(fullColleagueName, phone) {
  if (!fullColleagueName || fullColleagueName.trim() === '') return;
  
  // 解析公司名稱和姓名
  const companies = ['中信房屋', '21世紀', '有巢氏', '台灣房屋', '住商不動產', '永慶房屋', '信義房屋', '東森房屋'];
  let companyName = null;
  let personName = fullColleagueName;
  
  for (const company of companies) {
    if (fullColleagueName.startsWith(company)) {
      companyName = company;
      personName = fullColleagueName.substring(company.length).trim();
      break;
    }
  }
  
  // 如果沒有找到已知公司，嘗試用空格分隔
  if (!companyName) {
    const parts = fullColleagueName.split(' ');
    if (parts.length > 1) {
      companyName = parts[0];
      personName = parts.slice(1).join(' ');
    } else {
      companyName = '其它';
      personName = fullColleagueName;
    }
  }
  
  // 組合姓名和電話（格式：姓名|電話）
  const recordValue = phone ? `${personName}|${phone}` : personName;
  
  // 獲取所有歷史記錄
  let allHistory = JSON.parse(localStorage.getItem(COLLEAGUE_HISTORY_KEY) || '{}');
  
  // 確保該品牌有記錄數組
  if (!allHistory[companyName]) {
    allHistory[companyName] = [];
  }
  
  // 移除重複的姓名（不管電話）
  allHistory[companyName] = allHistory[companyName].filter(item => {
    const existingName = item.split('|')[0];
    return existingName.toLowerCase() !== personName.toLowerCase();
  });
  
  // 添加到開頭
  allHistory[companyName].unshift(recordValue);
  
  // 只保留最近10條記錄
  if (allHistory[companyName].length > 10) {
    allHistory[companyName] = allHistory[companyName].slice(0, 10);
  }
  
  localStorage.setItem(COLLEAGUE_HISTORY_KEY, JSON.stringify(allHistory));
}


// 選擇成員函數
function selectMember(member){
  // 檢查是否為主管（編號90以上）
  const isManager = parseInt(member.id) >= 90;
  
  // 如果是disabled但不是主管，則不能選擇
  if(member.disabled && !isManager) return;
  
  selectedMember = member;
  
  // 更新顯示 - 改為醒目的成功狀態
  const displayName = isManager ? `👔 ${member.name}` : `${member.id} ${member.name}`;
  const memberSection = document.getElementById('memberBorrowSection');
  memberSection.innerHTML = `
    <div style="text-align:center;padding:16px 20px;background:linear-gradient(135deg,#d4edda 0%,#c3e6cb 100%);border-radius:12px;border:2px solid #28a745;margin-bottom:10px;box-shadow:0 4px 12px rgba(40,167,69,0.2);cursor:pointer;transition:all 0.3s;" onclick="clearMemberSelection()" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 16px rgba(40,167,69,0.3)';" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 12px rgba(40,167,69,0.2)';">
      <div style="font-size:17px;font-weight:700;color:#155724;display:flex;align-items:center;justify-content:center;gap:10px;">
        <span style="font-size:26px;">✅</span>
        已選擇：${displayName}
        <span style="font-size:26px;">✅</span>
      </div>
    </div>
  `;
  
  // 重新渲染成員清單以更新選中狀態
  renderMemberList();
  
  // 自動聚焦到鑰匙輸入框
  document.getElementById('keyItem').focus();
}

// 清除成員選擇
function clearMemberSelection() {
  selectedMember = null;
  
  // 恢復原始提示
  const memberSection = document.getElementById('memberBorrowSection');
  memberSection.innerHTML = `
    <div style="text-align:center;padding:20px 25px;background:linear-gradient(135deg,#fff3e0 0%,#ffe0b2 100%);border-radius:12px;border:2px dashed #ff9800;margin-bottom:10px;">
      <span id="selectedMember" style="font-size:20px;font-weight:700;color:#f57c00;text-shadow:0 1px 2px rgba(245,124,0,0.2);display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:28px;animation:bounce 1s infinite;flex-shrink:0;">👆</span>
        <span style="flex-shrink:1;text-align:center;word-break:keep-all;">點擊上方成員選擇借用人</span>
        <span style="font-size:28px;animation:bounce 1s infinite;animation-delay:0.1s;flex-shrink:0;">👆</span>
      </span>
    </div>
  `;
  
  // 重新渲染成員清單
  renderMemberList();
}

// 檢查日期是否已經變更（跨日檢測）
function checkDateChange() {
  const now = new Date();
  
  // 如果當前查看的是今天的記錄，且日期已經變更
  if (isSameDay(currentViewDate, lastCheckedDate)) {
    if (!isSameDay(now, lastCheckedDate)) {
      // 日期已經變更（跨過午夜）
      console.log('檢測到日期變更，自動切換到新的一天');
      
      // 更新到新的日期
      currentViewDate = new Date();
      lastCheckedDate = new Date();
      
      // 刷新顯示
      renderKeyTable();
      updateDutyMember();
      
      // 自動從 Google Sheets 載入新一天的鑰匙記錄
      autoLoadTodayKeyRecords();
      
      // 顯示提示
      showCustomAlert('🌙 已自動切換到新的一天！', 'success');
    }
  } else {
    // 更新上次檢查的日期
    lastCheckedDate = new Date();
  }
}

// 啟動自動檢查日期變更的定時器
function startAutoDateCheck() {
  // 每分鐘檢查一次是否跨日
  setInterval(checkDateChange, 60000); // 60000ms = 1分鐘
  
  // 每3分鐘更新一次值班人員（檢查是否跨班別）
  setInterval(() => {
    updateDutyMember();
  }, 180000); // 180000ms = 3分鐘
  
  // 每5分鐘自動從 Google Sheets 同步鑰匙記錄
  setInterval(() => {
    console.log('⏰ 定期自動同步鑰匙記錄...');
    autoLoadTodayKeyRecords();
  }, 300000); // 300000ms = 5分鐘
  
  // 當頁面重新獲得焦點時也檢查一次
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      console.log('頁面重新獲得焦點，檢查日期是否變更');
      checkDateChange();
      updateDutyMember(); // 同時更新值班人員
      autoLoadTodayKeyRecords(); // 重新載入鑰匙記錄
    }
  });
  
  // 當視窗重新獲得焦點時也檢查一次
  window.addEventListener('focus', function() {
    console.log('視窗重新獲得焦點，檢查日期是否變更');
    checkDateChange();
    updateDutyMember(); // 同時更新值班人員
    autoLoadTodayKeyRecords(); // 重新載入鑰匙記錄
  });
  
  console.log('✅ 已啟動自動跨日檢測（每分鐘檢查 + 頁面/視窗焦點時檢查）');
  console.log('✅ 已啟動自動更新值班人員（每3分鐘檢查一次班別變更）');
  console.log('✅ 已啟動自動同步鑰匙記錄（每5分鐘 + 頁面/視窗焦點時同步）');
}

// 鑰匙借出表簿功能
function initKeyRecord(){
  // 清理超過30天的舊記錄
  cleanOldRecords();
  
  // 初始化當前查看日期為今天
  currentViewDate = new Date();
  lastCheckedDate = new Date();
  
  // 自動獲取當班值班人員
  updateDutyMember();
  
  renderKeyTable();
  renderKeyItemHistory(); // 渲染鑰匙項目歷史記錄
  
  // 自動從 Google Sheets 載入今天的鑰匙記錄
  autoLoadTodayKeyRecords();
  
  // 啟動自動跨日檢測
  startAutoDateCheck();
  
  // 添加Enter鍵快速登記功能
  document.getElementById('keyItem').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      borrowKey();
    }
  });
  
  // 同業名稱輸入框支援Enter鍵
  document.getElementById('colleagueName').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      document.getElementById('colleaguePhone').focus();
    }
  });
  
  // 同業電話輸入框支援Enter鍵
  document.getElementById('colleaguePhone').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      document.getElementById('keyItem').focus();
    }
  });
  
  // 同業自定義公司輸入框支援Enter鍵
  document.getElementById('colleagueCustomCompany').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      document.getElementById('colleagueName').focus();
    }
  });
  
  // 同業輸入框獲得焦點時顯示歷史記錄
  document.getElementById('colleagueName').addEventListener('focus', function() {
    if(currentBorrowType === 'colleague') {
      renderColleagueHistory();
    }
  });
  
  // 輸入框獲得焦點時顯示歷史記錄
  document.getElementById('keyItem').addEventListener('focus', function() {
    const historyContainer = document.getElementById('keyItemHistory');
    const historyList = getKeyItemHistory();
    if (historyList.length > 0) {
      historyContainer.style.display = 'block';
    }
  });
  
  // 輸入框輸入時過濾歷史記錄
  document.getElementById('keyItem').addEventListener('input', function() {
    filterKeyItemHistory(this.value);
  });
}

// 過濾鑰匙項目歷史記錄（保持多選功能）
function filterKeyItemHistory(searchText) {
  // 輸入時暫時隱藏歷史記錄（避免干擾）
  // 當輸入為空時重新渲染
  if (searchText.trim() === '') {
    renderKeyItemHistory();
  } else {
    const historyContainer = document.getElementById('keyItemHistory');
    historyContainer.style.display = 'none';
  }
}

// 獲取鑰匙項目歷史記錄
function getKeyItemHistory() {
  const history = JSON.parse(localStorage.getItem(KEY_HISTORY_KEY) || '[]');
  return history;
}

// 保存鑰匙項目到歷史記錄
function saveKeyItemToHistory(keyItem) {
  if (!keyItem || keyItem.trim() === '') return;
  
  let history = getKeyItemHistory();
  
  // 移除重複項目
  history = history.filter(item => item.toLowerCase() !== keyItem.toLowerCase());
  
  // 添加到開頭
  history.unshift(keyItem);
  
  // 只保留最近15條記錄
  if (history.length > 15) {
    history = history.slice(0, 15);
  }
  
  localStorage.setItem(KEY_HISTORY_KEY, JSON.stringify(history));
  renderKeyItemHistory();
}

// 渲染鑰匙項目歷史記錄（支持多選）
function renderKeyItemHistory() {
  const history = getKeyItemHistory();
  const historyList = document.getElementById('keyItemHistoryList');
  const historyContainer = document.getElementById('keyItemHistory');
  
  if (!historyList) return;
  
  historyList.innerHTML = '';
  
  if (history.length === 0) {
    historyContainer.style.display = 'none';
    return;
  }
  
  history.forEach((item, index) => {
    const badge = document.createElement('label');
    badge.className = 'key-history-badge';
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
      border: 2px solid #2196f3;
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
      color: #1565c0;
      font-weight: 500;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      user-select: none;
    `;
    
    // 創建復選框
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = item;
    checkbox.style.cssText = `
      width: 16px;
      height: 16px;
      cursor: pointer;
      accent-color: #2196f3;
    `;
    checkbox.onchange = () => toggleKeySelection(item, checkbox.checked, badge);
    
    // 如果已經被選中，設置狀態
    if (selectedKeyItems.has(item)) {
      checkbox.checked = true;
      badge.style.background = 'linear-gradient(135deg, #f44336 0%, #e53935 100%)';
      badge.style.color = '#fff';
      badge.style.borderColor = '#d32f2f';
      badge.style.boxShadow = '0 3px 8px rgba(244,67,54,0.4)';
    }
    
    const text = document.createElement('span');
    text.textContent = item;
    
    badge.appendChild(checkbox);
    badge.appendChild(text);
    
    // 懸停效果
    badge.onmouseenter = function() {
      if (!checkbox.checked) {
        this.style.background = 'linear-gradient(135deg, #bbdefb 0%, #90caf9 100%)';
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 3px 8px rgba(33,150,243,0.3)';
      }
    };
    
    badge.onmouseleave = function() {
      if (!checkbox.checked) {
        this.style.background = 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)';
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
      }
    };
    
    historyList.appendChild(badge);
  });
  
  // 更新選擇數量顯示
  updateSelectedKeysDisplay();
}

// 切換鑰匙選擇
function toggleKeySelection(item, isChecked, badge) {
  if (isChecked) {
    selectedKeyItems.add(item);
    // 選中時變紅色
    badge.style.background = 'linear-gradient(135deg, #f44336 0%, #e53935 100%)';
    badge.style.color = '#fff';
    badge.style.borderColor = '#d32f2f';
    badge.style.boxShadow = '0 3px 8px rgba(244,67,54,0.4)';
  } else {
    selectedKeyItems.delete(item);
    // 取消選中時恢復藍色
    badge.style.background = 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)';
    badge.style.color = '#1565c0';
    badge.style.borderColor = '#2196f3';
    badge.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
  }
  
  updateSelectedKeysDisplay();
}

// 更新已選擇鑰匙數量顯示
function updateSelectedKeysDisplay() {
  const count = selectedKeyItems.size;
  const countSpan = document.getElementById('selectedKeysCount');
  const clearBtn = document.getElementById('clearSelectionBtn');
  
  if (count > 0) {
    if (countSpan) {
      countSpan.textContent = `已選 ${count} 項`;
      countSpan.style.display = 'inline-block';
    }
    if (clearBtn) clearBtn.style.display = 'inline-block';
  } else {
    if (countSpan) countSpan.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'none';
  }
}

// 清除選擇
function clearKeySelection() {
  selectedKeyItems.clear();
  
  // 取消所有復選框的選中狀態
  const checkboxes = document.querySelectorAll('#keyItemHistoryList input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.checked = false;
    const badge = cb.closest('.key-history-badge');
    if (badge) {
      badge.style.background = 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)';
      badge.style.color = '#1565c0';
      badge.style.borderColor = '#2196f3';
      badge.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
    }
  });
  
  updateSelectedKeysDisplay();
}

// 執行批量借出
// 批量借出（從輸入框直接輸入多個項目）
function executeBatchBorrowWithItems(keyItems) {
  // 檢查借用人
  let borrowerInfo = {};
  
  if(currentBorrowType === 'member') {
    if(!selectedMember){
      showCustomAlert('請先點擊上方成員選擇借用人', 'error');
      return;
    }
    borrowerInfo = {
      type: 'member',
      memberId: selectedMember.id,
      memberName: selectedMember.name,
      displayName: `${selectedMember.id} ${selectedMember.name}`
    };
  } else {
    const companySelect = document.getElementById('colleagueCompany');
    const colleagueName = document.getElementById('colleagueName').value.trim();
    const colleaguePhone = document.getElementById('colleaguePhone').value.trim();
    const customCompany = document.getElementById('colleagueCustomCompany').value.trim();
    
    let companyName = companySelect.value;
    
    if (companyName === '其它') {
      if (!customCompany) {
        showCustomAlert('請輸入其它公司名稱', 'error');
        return;
      }
      companyName = customCompany;
    }
    
    if (!companyName) {
      showCustomAlert('請選擇公司', 'error');
      return;
    }
    
    if (!colleagueName) {
      showCustomAlert('請輸入姓名/分店', 'error');
      return;
    }
    
    const fullName = `${companyName} ${colleagueName}`;
    const displayWithPhone = colleaguePhone ? `${fullName} (${colleaguePhone})` : fullName;
    
    borrowerInfo = {
      type: 'colleague',
      colleagueName: fullName,
      colleaguePhone: colleaguePhone || '',
      displayName: displayWithPhone
    };
  }
  
  const now = new Date();
  const timeStr = `${now.getMonth()+1}/${now.getDate()} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
  const records = JSON.parse(localStorage.getItem(KEY_RECORD_KEY) || '[]');
  
  // 將所有項目合併成一筆記錄
  const allKeyItems = keyItems.join('、');
  const itemCount = keyItems.length;
  
  // 電話號碼加上單引號前綴，防止 Google Sheets 刪除前導零
  const phoneForSheets = borrowerInfo.colleaguePhone ? `'${borrowerInfo.colleaguePhone}` : null;
  
  const keyRecord = {
    id: Date.now(),
    time: timeStr,
    borrowerType: borrowerInfo.type,
    memberId: borrowerInfo.memberId || null,
    memberName: borrowerInfo.memberName || null,
    colleagueName: borrowerInfo.colleagueName || null,
    colleaguePhone: borrowerInfo.colleaguePhone || null,
    colleaguePhoneForSheets: phoneForSheets,
    displayName: borrowerInfo.displayName,
    keyItem: allKeyItems,
    itemCount: itemCount,
    status: 'borrowed',
    borrowTime: now.toISOString(),
    dutyConfirmed: false,
    dutyConfirmedBy: null,
    dutyConfirmedTime: null
  };
  
  records.push(keyRecord);
  localStorage.setItem(KEY_RECORD_KEY, JSON.stringify(records));
  
  // 發送記錄到 Google Sheets
  sendKeyRecordToGoogleSheets(keyRecord, 'borrow');
  
  // 保存所有項目到歷史記錄
  keyItems.forEach(item => saveKeyItemToHistory(item));
  
  // 更新顯示
  renderKeyTable();
  
  // 清空輸入
  document.getElementById('keyItem').value = '';
  
  showCustomAlert(`成功登記 ${itemCount} 個鑰匙項目的借出！`, 'success');
}

function executeBatchBorrow() {
  if (selectedKeyItems.size === 0) {
    showCustomAlert('請先選擇要借出的鑰匙項目', 'error');
    return;
  }
  
  // 檢查借用人
  let borrowerInfo = {};
  
  if(currentBorrowType === 'member') {
    if(!selectedMember){
      showCustomAlert('請先點擊上方成員選擇借用人', 'error');
      return;
    }
    borrowerInfo = {
      type: 'member',
      memberId: selectedMember.id,
      memberName: selectedMember.name,
      displayName: `${selectedMember.id} ${selectedMember.name}`
    };
  } else {
    const companySelect = document.getElementById('colleagueCompany');
    const colleagueName = document.getElementById('colleagueName').value.trim();
    const colleaguePhone = document.getElementById('colleaguePhone').value.trim();
    const customCompany = document.getElementById('colleagueCustomCompany').value.trim();
    
    let companyName = companySelect.value;
    
    if (companyName === '其它') {
      if (!customCompany) {
        showCustomAlert('請輸入其它公司名稱', 'error');
        return;
      }
      companyName = customCompany;
    }
    
    if (!companyName) {
      showCustomAlert('請選擇公司', 'error');
      return;
    }
    
    if (!colleagueName) {
      showCustomAlert('請輸入姓名/分店', 'error');
      return;
    }
    
    const fullName = `${companyName} ${colleagueName}`;
    const displayWithPhone = colleaguePhone ? `${fullName} (${colleaguePhone})` : fullName;
    
    borrowerInfo = {
      type: 'colleague',
      colleagueName: fullName,
      colleaguePhone: colleaguePhone || '',
      displayName: displayWithPhone
    };
  }
  const now = new Date();
  const timeStr = `${now.getMonth()+1}/${now.getDate()} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
  const records = JSON.parse(localStorage.getItem(KEY_RECORD_KEY) || '[]');
  
  // 將所有選中的鑰匙項目合併成一筆記錄
  const allKeyItems = Array.from(selectedKeyItems).join('、');
  const itemCount = selectedKeyItems.size;
  
  // 電話號碼加上單引號前綴，防止 Google Sheets 刪除前導零
  const phoneForSheets = borrowerInfo.colleaguePhone ? `'${borrowerInfo.colleaguePhone}` : null;
  
  const keyRecord = {
    id: Date.now(),
    time: timeStr,
    borrowerType: borrowerInfo.type,
    memberId: borrowerInfo.memberId || null,
    memberName: borrowerInfo.memberName || null,
    colleagueName: borrowerInfo.colleagueName || null,
    colleaguePhone: borrowerInfo.colleaguePhone || null,
    colleaguePhoneForSheets: phoneForSheets, // 用於 Google Sheets 的格式
    displayName: borrowerInfo.displayName,
    keyItem: allKeyItems, // 所有項目用頓號分隔
    itemCount: itemCount, // 記錄項目數量
    status: 'borrowed',
    borrowTime: now.toISOString(),
    dutyConfirmed: false,
    dutyConfirmedBy: null,
    dutyConfirmedTime: null
  };
  
  records.push(keyRecord);
  localStorage.setItem(KEY_RECORD_KEY, JSON.stringify(records));
  
  // 發送鑰匙借出記錄到 Google Sheets
  sendKeyRecordToGoogleSheets(keyRecord, 'borrow');
  
  // 保存所有鑰匙項目到歷史記錄
  selectedKeyItems.forEach(item => {
    saveKeyItemToHistory(item);
  });
  
  // 如果是同業借出，保存到歷史
  if(currentBorrowType === 'colleague' && borrowerInfo.colleagueName) {
    saveColleagueToHistory(borrowerInfo.colleagueName, borrowerInfo.colleaguePhone);
  }
  
  // 清除選擇
  clearKeySelection();
  
  // 清理舊記錄
  cleanOldRecords();
  
  // 切換到今天的記錄
  currentViewDate = new Date();
  renderKeyTable();
  
  showCustomAlert(`✅ 已為「${borrowerInfo.displayName}」登記 ${itemCount} 項鑰匙`, 'success');
}

// 選擇歷史記錄中的鑰匙項目（單個填入輸入框 - 已移除，改用多選）
function selectKeyItem(item) {
  // 此功能已整合到多選，不再使用
  // 現在通過勾選復選框來選擇項目
}

// 清除鑰匙項目歷史記錄
function clearKeyItemHistory() {
  showConfirmModal(
    '🗑️ 清除記錄',
    '確定要清除所有鑰匙項目記錄嗎？',
    '這不會影響借出記錄，只會清除快速選擇列表',
    () => {
      localStorage.removeItem(KEY_HISTORY_KEY);
      selectedKeyItems.clear(); // 同時清除選擇
      renderKeyItemHistory();
      showCustomAlert('✅ 已清除鑰匙項目記錄', 'success');
    }
  );
}

// 顯示調試信息
function showDebugInfo() {
  const today = new Date();
  const ym = document.getElementById('monthPicker').value;
  const data = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  const currentYear = today.getFullYear();
  const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
  const todayStr = String(today.getDate()).padStart(2, '0');
  
  // 獲取當前月份的所有排班
  const currentMonthData = {};
  Object.keys(data).forEach(key => {
    if(key.startsWith(ym + ':')) {
      currentMonthData[key] = data[key];
    }
  });
  
  // 獲取今日的排班
  const todayData = {};
  Object.keys(data).forEach(key => {
    if(key.includes(`:${todayStr}-`)) {
      todayData[key] = data[key];
    }
  });
  
  const currentShift = getCurrentShift();
  
  let debugHtml = `
    <div style="max-width:700px;margin:0 auto;text-align:left;">
      <h3 style="text-align:center;color:#495057;margin-bottom:20px;">🔍 排班數據檢查</h3>
      
      <div style="background:#f8f9fa;padding:15px;border-radius:6px;margin-bottom:15px;">
        <h4 style="color:#495057;margin:0 0 10px 0;">📅 當前時間信息</h4>
        <p style="margin:5px 0;"><strong>系統時間：</strong>${today.toLocaleString('zh-TW')}</p>
        <p style="margin:5px 0;"><strong>選擇月份：</strong>${ym}</p>
        <p style="margin:5px 0;"><strong>今日日期：</strong>${todayStr} 日</p>
        <p style="margin:5px 0;"><strong>當前班別：</strong>${currentShift ? currentShift.label : '非值班時間'}</p>
        ${currentShift ? `<p style="margin:5px 0;"><strong>查詢鍵值：</strong>${ym}:${todayStr}-${currentShift.key}</p>` : ''}
      </div>
      
      <div style="background:#fff3cd;padding:15px;border-radius:6px;margin-bottom:15px;border-left:4px solid #ffc107;">
        <h4 style="color:#856404;margin:0 0 10px 0;">📊 今日排班 (${Object.keys(todayData).length} 筆)</h4>
        ${Object.keys(todayData).length > 0 ? `
          <div style="font-family:monospace;font-size:13px;line-height:1.8;">
            ${Object.entries(todayData).map(([key, value]) => {
              const member = MEMBERS.find(m => m.id === value);
              return `<div style="padding:5px;background:#fff;margin:3px 0;border-radius:3px;">
                <strong style="color:#007bff;">${key}</strong> = 
                <strong style="color:#28a745;">${value}</strong>
                ${member ? `<span style="color:#6c757d;">(${member.name})</span>` : ''}
              </div>`;
            }).join('')}
          </div>
        ` : '<p style="color:#856404;margin:0;">❌ 今日無排班記錄</p>'}
      </div>
      
      <div style="background:#e3f2fd;padding:15px;border-radius:6px;margin-bottom:15px;border-left:4px solid #2196f3;">
        <h4 style="color:#1565c0;margin:0 0 10px 0;">📋 本月排班總數：${Object.keys(currentMonthData).length} 筆</h4>
        ${Object.keys(currentMonthData).length > 0 ? `
          <details style="cursor:pointer;">
            <summary style="color:#1565c0;font-weight:bold;padding:5px 0;">點擊查看所有排班</summary>
            <div style="font-family:monospace;font-size:12px;line-height:1.6;max-height:300px;overflow-y:auto;margin-top:10px;">
              ${Object.entries(currentMonthData).map(([key, value]) => {
                const member = MEMBERS.find(m => m.id === value);
                return `<div style="padding:3px;background:#fff;margin:2px 0;border-radius:3px;">
                  <strong style="color:#007bff;">${key}</strong> = 
                  <strong style="color:#28a745;">${value}</strong>
                  ${member ? `<span style="color:#6c757d;">(${member.name})</span>` : ''}
                </div>`;
              }).join('')}
            </div>
          </details>
        ` : '<p style="color:#1565c0;margin:0;">❌ 本月無排班記錄</p>'}
      </div>
      
      <div style="text-align:center;margin-top:20px;">
        <button onclick="closeModal(this.closest('.modal-overlay'))" style="padding:10px 20px;background:#6c757d;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">關閉</button>
      </div>
    </div>
  `;
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;
  
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    max-width: 800px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    padding: 30px;
  `;
  
  modal.innerHTML = debugHtml;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // 點擊遮罩關閉
  overlay.addEventListener('click', function(e) {
    if(e.target === overlay) {
      closeModal(overlay);
    }
  });
}

// 取消今日臨時代班設定
function clearTempDuty() {
  const today = new Date();
  const ym = document.getElementById('monthPicker').value;
  const currentYear = today.getFullYear();
  const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
  const todayStr = String(today.getDate()).padStart(2, '0');
  const dateKey = `${ym}:${todayStr}`;
  
  showConfirmModal(
    '❌ 取消臨時代班',
    '確定要取消今日的臨時代班設定嗎？',
    '取消後將恢復使用排班表的原定值班人員',
    () => {
      const tempDutyData = JSON.parse(localStorage.getItem(TEMP_DUTY_KEY) || '{}');
      delete tempDutyData[dateKey];
      localStorage.setItem(TEMP_DUTY_KEY, JSON.stringify(tempDutyData));
      
      updateDutyMember();
      showCustomAlert('✅ 已取消臨時代班設定，恢復使用排班表數據', 'success');
    }
  );
}

// 臨時代班設定
function quickSetTodayDuty() {
  const today = new Date();
  const ym = document.getElementById('monthPicker').value;
  const currentYear = today.getFullYear();
  const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
  const currentYearMonth = `${currentYear}-${currentMonth}`;
  
  if(ym !== currentYearMonth) {
    showCustomAlert('請先將月份選擇器切換到當前月份', 'error');
    return;
  }
  
  const todayStr = String(today.getDate()).padStart(2, '0');
  const wd = today.getDay();
  const shifts = (wd === 0 || wd === 6) ? WEEKEND_SHIFTS : WEEKDAY_SHIFTS;
  
  // 獲取排班表中的原定值班人員
  const scheduleData = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  const tempDutyData = JSON.parse(localStorage.getItem(TEMP_DUTY_KEY) || '{}');
  const dateKey = `${ym}:${todayStr}`;
  
  // 創建彈窗讓用戶選擇每個班別的值班人員
  let formHtml = `
    <div style="max-width:600px;margin:0 auto;">
      <h3 style="text-align:center;color:#495057;margin-bottom:10px;">👥 臨時代班設定</h3>
      <p style="text-align:center;color:#6c757d;margin-bottom:20px;">
        ${currentYear}年${parseInt(currentMonth)}月${parseInt(todayStr)}日 (星期${['日','一','二','三','四','五','六'][wd]})
      </p>
      <div style="background:#fff3cd;padding:12px;border-radius:6px;margin-bottom:15px;border-left:4px solid #ffc107;">
        <div style="font-size:13px;color:#856404;"><strong>💡 說明：</strong></div>
        <div style="font-size:12px;color:#856404;margin-top:5px;">
          • 系統會自動從排班表讀取值班人員<br>
          • 此功能僅用於臨時代班情況<br>
          • 設定後會優先使用代班人員<br>
          • 可隨時取消恢復原定排班
        </div>
      </div>
  `;
  
  shifts.forEach((shift, index) => {
    const originalKey = `${ym}:${todayStr}-${shift.key}`;
    const originalMemberId = scheduleData[originalKey];
    const originalMember = originalMemberId ? MEMBERS.find(m => m.id === originalMemberId) : null;
    const currentTempMemberId = (tempDutyData[dateKey] && tempDutyData[dateKey][shift.key]) || '';
    
    formHtml += `
      <div style="margin-bottom:15px;padding:15px;background:#f8f9fa;border-radius:6px;">
        <label style="display:block;font-weight:bold;color:#495057;margin-bottom:8px;">
          ${shift.label}
          ${originalMember ? `<span style="font-size:12px;color:#6c757d;font-weight:normal;margin-left:8px;">原定: ${originalMember.id} ${originalMember.name}</span>` : '<span style="font-size:12px;color:#dc3545;font-weight:normal;margin-left:8px;">原定: 無排班</span>'}
        </label>
        <select id="duty-${shift.key}" style="width:100%;padding:8px;border:1px solid #ced4da;border-radius:4px;">
          <option value="">-- 使用排班表數據 --</option>
  `;
    
    MEMBERS.filter(m => !m.disabled).forEach(member => {
      const selected = member.id === currentTempMemberId ? 'selected' : '';
      formHtml += `<option value="${member.id}" ${selected}>${member.id} ${member.name}</option>`;
    });
    
    formHtml += `
        </select>
      </div>
    `;
  });
  
  formHtml += `
      <div style="text-align:center;margin-top:20px;">
        <button onclick="saveQuickDuty()" style="padding:10px 20px;background:#ff9800;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;margin-right:10px;">✅ 確認代班設定</button>
        <button onclick="closeModal(this.closest('.modal-overlay'))" style="padding:10px 20px;background:#6c757d;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">取消</button>
      </div>
    </div>
  `;
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;
  
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    padding: 30px;
  `;
  
  modal.innerHTML = formHtml;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // 點擊遮罩關閉
  overlay.addEventListener('click', function(e) {
    if(e.target === overlay) {
      closeModal(overlay);
    }
  });
}

// 保存臨時代班設定
function saveQuickDuty() {
  const today = new Date();
  const ym = document.getElementById('monthPicker').value;
  const todayStr = String(today.getDate()).padStart(2, '0');
  const wd = today.getDay();
  const shifts = (wd === 0 || wd === 6) ? WEEKEND_SHIFTS : WEEKDAY_SHIFTS;
  const dateKey = `${ym}:${todayStr}`;
  
  const tempDutyData = JSON.parse(localStorage.getItem(TEMP_DUTY_KEY) || '{}');
  
  // 初始化今日的臨時代班數據
  if(!tempDutyData[dateKey]) {
    tempDutyData[dateKey] = {};
  }
  
  let hasChange = false;
  let assignedCount = 0;
  
  shifts.forEach(shift => {
    const select = document.getElementById(`duty-${shift.key}`);
    if(select) {
      if(select.value) {
        // 設定代班人員
        tempDutyData[dateKey][shift.key] = select.value;
        hasChange = true;
        assignedCount++;
      } else {
        // 清除代班設定（使用排班表數據）
        if(tempDutyData[dateKey][shift.key]) {
          delete tempDutyData[dateKey][shift.key];
          hasChange = true;
        }
      }
    }
  });
  
  // 如果今日的代班數據為空，刪除整個日期的記錄
  if(Object.keys(tempDutyData[dateKey]).length === 0) {
    delete tempDutyData[dateKey];
  }
  
  if(!hasChange) {
    showCustomAlert('未進行任何變更', 'error');
    return;
  }
  
  localStorage.setItem(TEMP_DUTY_KEY, JSON.stringify(tempDutyData));
  updateDutyMember();
  
  // 關閉彈窗
  const overlay = document.querySelector('.modal-overlay');
  if(overlay) {
    closeModal(overlay);
  }
  
  if(assignedCount > 0) {
    showCustomAlert(`✅ 已設定 ${assignedCount} 個班別的臨時代班`, 'success');
  } else {
    showCustomAlert(`✅ 已恢復使用排班表數據`, 'success');
  }
}

// 判斷當前時間屬於哪個班別
function getCurrentShift() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  const wd = now.getDay();
  const isWeekend = (wd === 0 || wd === 6);
  
  if(isWeekend) {
    // 假日班別：早班 09:30-13:30、中班 13:30-17:30、晚班 17:30-21:00
    if(timeInMinutes >= 9*60+30 && timeInMinutes < 13*60+30) {
      return {key: 'morning', label: '早班 09:30-13:30'};
    } else if(timeInMinutes >= 13*60+30 && timeInMinutes < 17*60+30) {
      return {key: 'noon', label: '中班 13:30-17:30'};
    } else if(timeInMinutes >= 17*60+30 && timeInMinutes < 21*60) {
      return {key: 'evening', label: '晚班 17:30-21:00'};
    }
  } else {
    // 平日班別：早班 09:30-15:30、晚班 15:30-21:00
    if(timeInMinutes >= 9*60+30 && timeInMinutes < 15*60+30) {
      return {key: 'morning', label: '早班 09:30-15:30'};
    } else if(timeInMinutes >= 15*60+30 && timeInMinutes < 21*60) {
      return {key: 'evening', label: '晚班 15:30-21:00'};
    }
  }
  
  return null; // 非值班時間
}

// 更新值班人員（自動從排班表讀取，支持臨時代班覆蓋）
function updateDutyMember(){
  const today = new Date();
  const ym = document.getElementById('monthPicker').value;
  const scheduleData = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); // 排班表數據
  const tempDutyData = JSON.parse(localStorage.getItem(TEMP_DUTY_KEY) || '{}'); // 臨時代班數據
  
  // 檢查是否為當前月份
  const currentYear = today.getFullYear();
  const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
  const currentYearMonth = `${currentYear}-${currentMonth}`;
  const isCurrentMonth = ym === currentYearMonth;
  
  let todayStr, wd;
  
  if(isCurrentMonth){
    // 如果是當前月份，使用今天的日期
    todayStr = String(today.getDate()).padStart(2, '0');
    wd = today.getDay();
  } else {
    // 如果不是當前月份，使用該月的第一天作為示例
    todayStr = '01';
    wd = new Date(`${ym}-01`).getDay();
  }
  
  const dutyMemberSpan = document.getElementById('dutyMember');
  const clearTempBtn = document.getElementById('clearTempBtn');
  const dateKey = `${ym}:${todayStr}`;
  
  // 檢查是否有今日的臨時代班設定
  const hasTempDuty = tempDutyData[dateKey] !== undefined;
  
  if(isCurrentMonth) {
    // 當前月份：根據當前時間判斷班別
    const currentShift = getCurrentShift();
    
    if(currentShift) {
      // 在值班時間內
      let memberId = null;
      let isFromTemp = false;
      
      // 優先檢查臨時代班數據
      if(hasTempDuty && tempDutyData[dateKey][currentShift.key]) {
        memberId = tempDutyData[dateKey][currentShift.key];
        isFromTemp = true;
      } else {
        // 從排班表讀取（排班表的日期不補零！）
        const todayDay = today.getDate(); // 不補零的日期
        const key1 = `${ym}:${todayDay}-${currentShift.key}`; // 不補零格式
        const key2 = `${ym}:${todayStr}-${currentShift.key}`; // 補零格式
        
        // 優先使用不補零格式（表格存儲格式），如果沒有就嘗試補零格式
        memberId = scheduleData[key1] || scheduleData[key2];
      }
      
      console.log('🔍 值班檢查：', {
        日期補零: todayStr,
        日期數字: today.getDate(),
        班別: currentShift.key,
        查詢鍵值1: `${ym}:${today.getDate()}-${currentShift.key}`,
        查詢鍵值2: `${ym}:${todayStr}-${currentShift.key}`,
        找到的成員: memberId || '❌ 無',
        數據來源: isFromTemp ? '臨時代班' : '排班表',
        有臨時代班: hasTempDuty,
        排班數據樣本: Object.keys(scheduleData).slice(0, 5)
      });
      
      if(memberId) {
        const member = MEMBERS.find(m => m.id === memberId);
        if(member) {
          const sourceTag = isFromTemp ? `<span style="background:#ff9800;color:#fff;padding:2px 6px;border-radius:10px;font-size:11px;margin-left:8px;">臨時代班</span>` : '';
          dutyMemberSpan.innerHTML = `<span style="color:#28a745;">🟢 當前值班人員：</span><span style="font-size:1.1em;color:#155724;">${member.id} ${member.name}</span>${sourceTag}<span style="color:#6c757d;font-size:0.9em;margin-left:8px;">(${currentShift.label})</span>`;
          dutyMemberSpan.style.fontWeight = 'bold';
          
          // 顯示取消代班按鈕
          if(hasTempDuty && clearTempBtn) {
            clearTempBtn.style.display = 'inline-block';
          }
          return;
        }
      } else {
        dutyMemberSpan.innerHTML = `<span style="color:#dc3545;">⚠️ 當前時段無排班：</span><span style="color:#6c757d;">${currentShift.label}</span><br><small style="color:#6c757d;font-size:0.85em;">請使用「隨機平均排班」或「臨時代班設定」</small>`;
        dutyMemberSpan.style.fontWeight = 'normal';
        if(clearTempBtn) clearTempBtn.style.display = 'none';
        return;
      }
    } else {
      // 非值班時間，顯示今日所有班別
      const shifts = (wd === 0 || wd === 6) ? WEEKEND_SHIFTS : WEEKDAY_SHIFTS;
      const todayDutyMembers = [];
      const todayDay = today.getDate(); // 不補零的日期
      
      shifts.forEach(shift => {
        let memberId = null;
        
        // 優先檢查臨時代班
        if(hasTempDuty && tempDutyData[dateKey][shift.key]) {
          memberId = tempDutyData[dateKey][shift.key];
        } else {
          // 從排班表讀取（嘗試兩種格式）
          const key1 = `${ym}:${todayDay}-${shift.key}`; // 不補零格式
          const key2 = `${ym}:${todayStr}-${shift.key}`; // 補零格式
          memberId = scheduleData[key1] || scheduleData[key2];
        }
        
        if(memberId){
          const member = MEMBERS.find(m => m.id === memberId);
          if(member){
            todayDutyMembers.push(`${member.id} ${member.name}`);
          }
        }
      });
      
      if(todayDutyMembers.length > 0) {
        const sourceTag = hasTempDuty ? '<span style="background:#ff9800;color:#fff;padding:2px 6px;border-radius:10px;font-size:11px;margin-left:8px;">臨時代班</span>' : '';
        dutyMemberSpan.innerHTML = `<span style="color:#6c757d;">今日值班人員：</span><span style="color:#495057;">${todayDutyMembers.join('、')}</span>${sourceTag}`;
        dutyMemberSpan.style.fontWeight = 'normal';
        
        if(hasTempDuty && clearTempBtn) {
          clearTempBtn.style.display = 'inline-block';
        }
      } else {
        dutyMemberSpan.textContent = '今日值班人員：無排班';
        dutyMemberSpan.style.color = '#6c757d';
        dutyMemberSpan.style.fontWeight = 'normal';
        if(clearTempBtn) clearTempBtn.style.display = 'none';
      }
    }
  } else {
    // 非當前月份，顯示該月第一天的值班人員
    const shifts = (wd === 0 || wd === 6) ? WEEKEND_SHIFTS : WEEKDAY_SHIFTS;
    const todayDutyMembers = [];
    
    shifts.forEach(shift => {
      const key = `${ym}:${todayStr}-${shift.key}`;
      const memberId = scheduleData[key];
      if(memberId){
        const member = MEMBERS.find(m => m.id === memberId);
        if(member){
          todayDutyMembers.push(`${member.id} ${member.name}`);
        }
      }
    });
    
    if(todayDutyMembers.length > 0) {
      dutyMemberSpan.textContent = `${ym}月${todayStr}日值班人員：${todayDutyMembers.join('、')}`;
      dutyMemberSpan.style.color = '#495057';
      dutyMemberSpan.style.fontWeight = 'normal';
    } else {
      dutyMemberSpan.textContent = `${ym}月${todayStr}日值班人員：無排班`;
      dutyMemberSpan.style.color = '#6c757d';
      dutyMemberSpan.style.fontWeight = 'normal';
    }
    
    if(clearTempBtn) clearTempBtn.style.display = 'none';
  }
}


// 值班確認歸還
function dutyConfirm(recordId){
  const records = JSON.parse(localStorage.getItem(KEY_RECORD_KEY) || '[]');
  const record = records.find(r => r.id === recordId);
  
  if(!record){
    showCustomAlert('找不到該記錄', 'error');
    return;
  }
  
  // 獲取當前值班人員
  const today = new Date();
  const ym = document.getElementById('monthPicker').value;
  const scheduleData = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); // 排班表數據
  const tempDutyData = JSON.parse(localStorage.getItem(TEMP_DUTY_KEY) || '{}'); // 臨時代班數據
  
  // 檢查是否為當前月份
  const currentYear = today.getFullYear();
  const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
  const currentYearMonth = `${currentYear}-${currentMonth}`;
  const isCurrentMonth = ym === currentYearMonth;
  
  let currentDutyMember = null;
  
  if(isCurrentMonth) {
    // 當前月份：根據當前時間判斷當前班別的值班人員
    const currentShift = getCurrentShift();
    
    if(currentShift) {
      const todayDay = today.getDate(); // 不補零的日期
      const todayStr = String(todayDay).padStart(2, '0');
      const dateKey = `${ym}:${todayStr}`;
      let memberId = null;
      
      // 優先檢查臨時代班數據
      if(tempDutyData[dateKey] && tempDutyData[dateKey][currentShift.key]) {
        memberId = tempDutyData[dateKey][currentShift.key];
      } else {
        // 從排班表讀取（嘗試兩種格式）
        const key1 = `${ym}:${todayDay}-${currentShift.key}`; // 不補零格式
        const key2 = `${ym}:${todayStr}-${currentShift.key}`; // 補零格式
        memberId = scheduleData[key1] || scheduleData[key2];
      }
      
      if(memberId) {
        currentDutyMember = MEMBERS.find(m => m.id === memberId);
      }
    }
  } else {
    // 非當前月份，取第一天的第一個班別
    const todayStr = '01';
    const wd = new Date(`${ym}-01`).getDay();
    const shifts = (wd === 0 || wd === 6) ? WEEKEND_SHIFTS : WEEKDAY_SHIFTS;
    
    for(const shift of shifts) {
      const key = `${ym}:${todayStr}-${shift.key}`;
      const memberId = scheduleData[key];
      if(memberId){
        currentDutyMember = MEMBERS.find(m => m.id === memberId);
        if(currentDutyMember) break;
      }
    }
  }
  
  if(!currentDutyMember){
    showCustomAlert('找不到當前值班人員，無法確認', 'error');
    return;
  }
  
  showConfirmModal(
    '✅ 值班確認歸還',
    `確定要確認「${record.keyItem}」已歸還嗎？`,
    `值班人員：${currentDutyMember.id} ${currentDutyMember.name}`,
    () => {
      const now = new Date();
      record.dutyConfirmed = true;
      record.dutyConfirmedBy = `${currentDutyMember.id} ${currentDutyMember.name}`;
      record.dutyConfirmedTime = now.toISOString();
      
      localStorage.setItem(KEY_RECORD_KEY, JSON.stringify(records));
      
      // 發送值班確認記錄到 Google Sheets
      sendKeyRecordToGoogleSheets(record, 'confirm');
      
      renderKeyTable();
      showCustomAlert(`✅ ${currentDutyMember.name} 已確認「${record.keyItem}」歸還`, 'success');
    }
  );
}

// 更新日期顯示
function updateDateDisplay(recordCount) {
  const dateDisplay = document.getElementById('currentDateDisplay');
  const countDisplay = document.getElementById('currentDateRecordCount');
  
  if (!dateDisplay || !countDisplay) return;
  
  const year = currentViewDate.getFullYear();
  const month = currentViewDate.getMonth() + 1;
  const day = currentViewDate.getDate();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = weekdays[currentViewDate.getDay()];
  
  const today = new Date();
  const isToday = isSameDay(currentViewDate, today);
  
  let dateText = `${year}年${month}月${day}日 (星期${weekday})`;
  if (isToday) {
    dateText += ' 📅 今天';
  }
  
  dateDisplay.textContent = dateText;
  countDisplay.textContent = `共 ${recordCount} 筆記錄`;
}

// 切換查看日期
function changeViewDate(direction) {
  if (direction === 0) {
    // 今天
    currentViewDate = new Date();
  } else {
    // 前一天或下一天
    currentViewDate.setDate(currentViewDate.getDate() + direction);
  }
  renderKeyTable();
}

// 獲取日期字符串 (YYYY-MM-DD)
function getDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 清理電話號碼格式（去除可能的單引號前綴，確保完整十碼）
function cleanPhoneNumber(phone) {
  if (!phone) return phone;
  
  // 轉換為字符串
  let cleaned = String(phone).trim();
  
  // 去除前面的單引號（如果有的話）
  if (cleaned.startsWith("'")) {
    cleaned = cleaned.substring(1);
  }
  
  // 去除所有非數字和破折號的字符（保留格式）
  const digitsOnly = cleaned.replace(/[^\d-]/g, '');
  
  // 計算純數字的數量（不含破折號）
  const digits = digitsOnly.replace(/-/g, '');
  
  // ⭐ 如果只有9碼數字，自動補0
  if (digits.length === 9 && /^\d+$/.test(digits)) {
    // 檢查是否有破折號格式
    if (digitsOnly.includes('-')) {
      // 有破折號：在第一個數字前補0
      // 例如：912-345-678 -> 0912-345-678
      cleaned = '0' + digitsOnly;
    } else {
      // 沒有破折號：直接在前面補0
      // 例如：912345678 -> 0912345678
      cleaned = '0' + digits;
    }
    console.log(`📱 自動補0：${digitsOnly} → ${cleaned}`);
  }
  
  return cleaned;
}

// 檢查兩個日期是否是同一天
function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

// 清理30天前的記錄
function cleanOldRecords() {
  const records = JSON.parse(localStorage.getItem(KEY_RECORD_KEY) || '[]');
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const filteredRecords = records.filter(record => {
    const recordDate = new Date(record.borrowTime);
    return recordDate >= thirtyDaysAgo;
  });
  
  if (filteredRecords.length !== records.length) {
    localStorage.setItem(KEY_RECORD_KEY, JSON.stringify(filteredRecords));
    console.log(`已清理 ${records.length - filteredRecords.length} 條超過30天的記錄`);
  }
}

function borrowKey(){
  // 檢查是否有選中的鑰匙項目（批量模式）
  if(selectedKeyItems.size > 0) {
    executeBatchBorrow();
    return;
  }
  
  // 獲取輸入的鑰匙項目
  const keyItemInput = document.getElementById('keyItem').value.trim();
  
  if(!keyItemInput){
    showCustomAlert('請輸入鑰匙項目或勾選常用項目', 'error');
    return;
  }
  
  // 檢測是否有多個項目（用逗號、分號、換行符或頓號分隔）
  const separators = /[,，;；\n、]/;
  const keyItems = keyItemInput.split(separators)
    .map(item => item.trim())
    .filter(item => item.length > 0);
  
  // 如果有多個項目，使用批量借出邏輯
  if(keyItems.length > 1) {
    executeBatchBorrowWithItems(keyItems);
    return;
  }
  
  // 單個項目邏輯
  const keyItem = keyItems[0] || keyItemInput;
  
  let borrowerInfo = {};
  
  if(currentBorrowType === 'member') {
    // 成員借出
    if(!selectedMember){
      showCustomAlert('請先點擊上方成員選擇借用人', 'error');
      return;
    }
    borrowerInfo = {
      type: 'member',
      memberId: selectedMember.id,
      memberName: selectedMember.name,
      displayName: `${selectedMember.id} ${selectedMember.name}`
    };
  } else {
    // 同業借出
    const companySelect = document.getElementById('colleagueCompany');
    const colleagueName = document.getElementById('colleagueName').value.trim();
    const colleaguePhone = document.getElementById('colleaguePhone').value.trim();
    const customCompany = document.getElementById('colleagueCustomCompany').value.trim();
    
    let companyName = companySelect.value;
    
    // 如果選擇"其它"，使用自定義公司名稱
    if (companyName === '其它') {
      if (!customCompany) {
        showCustomAlert('請輸入其它公司名稱', 'error');
        return;
      }
      companyName = customCompany;
    }
    
    if (!companyName) {
      showCustomAlert('請選擇公司', 'error');
      return;
    }
    
    if (!colleagueName) {
      showCustomAlert('請輸入姓名/分店', 'error');
      return;
    }
    
    const fullName = `${companyName} ${colleagueName}`;
    const displayWithPhone = colleaguePhone ? `${fullName} (${colleaguePhone})` : fullName;
    
    borrowerInfo = {
      type: 'colleague',
      colleagueName: fullName,
      colleaguePhone: colleaguePhone || '',
      displayName: displayWithPhone
    };
  }
  
  const now = new Date();
  const timeStr = `${now.getMonth()+1}/${now.getDate()} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
  
  // 電話號碼加上單引號前綴，防止 Google Sheets 刪除前導零
  const phoneForSheets = borrowerInfo.colleaguePhone ? `'${borrowerInfo.colleaguePhone}` : null;
  
  const keyRecord = {
    id: Date.now(),
    time: timeStr,
    borrowerType: borrowerInfo.type,
    memberId: borrowerInfo.memberId || null,
    memberName: borrowerInfo.memberName || null,
    colleagueName: borrowerInfo.colleagueName || null,
    colleaguePhone: borrowerInfo.colleaguePhone || null,
    colleaguePhoneForSheets: phoneForSheets, // 用於 Google Sheets 的格式
    displayName: borrowerInfo.displayName,
    keyItem: keyItem,
    status: 'borrowed',
    borrowTime: now.toISOString(),
    dutyConfirmed: false,
    dutyConfirmedBy: null,
    dutyConfirmedTime: null
  };
  
  const records = JSON.parse(localStorage.getItem(KEY_RECORD_KEY) || '[]');
  records.push(keyRecord);
  localStorage.setItem(KEY_RECORD_KEY, JSON.stringify(records));
  
  // 發送鑰匙借出記錄到 Google Sheets
  sendKeyRecordToGoogleSheets(keyRecord, 'borrow');
  
  // 保存鑰匙項目到歷史記錄
  saveKeyItemToHistory(keyItem);
  
  // 如果是同業借出，保存同業名稱和電話到歷史
  if(currentBorrowType === 'colleague' && borrowerInfo.colleagueName) {
    saveColleagueToHistory(borrowerInfo.colleagueName, borrowerInfo.colleaguePhone);
  }
  
  // 清空輸入欄位
  document.getElementById('keyItem').value = '';
  if(currentBorrowType === 'colleague') {
    document.getElementById('colleagueCompany').value = '';
    document.getElementById('colleagueName').value = '';
    document.getElementById('colleaguePhone').value = '';
    document.getElementById('colleagueCustomCompany').value = '';
    document.getElementById('colleagueCustomInput').style.display = 'none';
    document.getElementById('companyHistorySelect').style.display = 'none';
  }
  
  // 清除選擇的鑰匙項目（如果有）
  if(selectedKeyItems.size > 0) {
    clearKeySelection();
  }
  
  // 清理舊記錄
  cleanOldRecords();
  
  // 切換到今天的記錄
  currentViewDate = new Date();
  renderKeyTable();
  showCustomAlert(`✅ ${borrowerInfo.displayName} 已借出「${keyItem}」`, 'success');
}


function deleteKeyRecord(recordId){
  showConfirmModal(
    '🗑️ 刪除記錄',
    '確定要刪除此記錄嗎？',
    '此操作無法復原！',
    () => {
      const records = JSON.parse(localStorage.getItem(KEY_RECORD_KEY) || '[]');
      const filteredRecords = records.filter(r => r.id !== recordId);
      localStorage.setItem(KEY_RECORD_KEY, JSON.stringify(filteredRecords));
      
      renderKeyTable();
      showCustomAlert('✅ 記錄已刪除', 'success');
    }
  );
}

function renderKeyTable(){
  const allRecords = JSON.parse(localStorage.getItem(KEY_RECORD_KEY) || '[]');
  const tbody = document.getElementById('keyTableBody');
  tbody.innerHTML = '';
  
  // 過濾出當前查看日期的記錄
  const records = allRecords.filter(record => {
    const recordDate = new Date(record.borrowTime);
    return isSameDay(recordDate, currentViewDate);
  });
  
  // 按時間倒序排列（最新的在上面）
  records.sort((a, b) => new Date(b.borrowTime) - new Date(a.borrowTime));
  
  // 更新日期顯示
  updateDateDisplay(records.length);
  
  // 如果沒有記錄，顯示提示
  if (records.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.textContent = '當天沒有鑰匙借出記錄';
    cell.style.textAlign = 'center';
    cell.style.padding = '20px';
    cell.style.color = '#6c757d';
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }
  
  records.forEach(record => {
    const row = document.createElement('tr');
    
    const timeCell = document.createElement('td');
    timeCell.className = 'auto-size';
    if(record.status === 'returned' && record.returnTimeStr){
      timeCell.innerHTML = `
        <div style="font-size:12px;line-height:1.4;margin-bottom:3px;">
          <span style="color:#2196f3;font-weight:600;">借:</span>
          <span style="color:#2196f3;">${record.time}</span>
        </div>
        <div style="font-size:12px;line-height:1.4;">
          <span style="color:#28a745;font-weight:600;">還:</span>
          <span style="color:#28a745;">${record.returnTimeStr}</span>
        </div>
      `;
    }else{
      timeCell.innerHTML = `
        <div style="font-size:12px;line-height:1.4;">
          <span style="color:#2196f3;font-weight:600;">借:</span>
          <span style="color:#2196f3;">${record.time}</span>
        </div>
      `;
    }
    
    const memberCell = document.createElement('td');
    memberCell.className = 'auto-size';
    // 處理新舊格式的兼容
    const borrowerType = record.borrowerType || 'member';
    
    if(borrowerType === 'colleague') {
      // 同業借出
      const colleagueName = record.colleagueName || record.displayName;
      const colleaguePhone = record.colleaguePhone;
      let displayHtml = `<div><span style="background:linear-gradient(135deg,#ff9800 0%,#f57c00 100%);color:#fff;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:bold;display:inline-block;margin-bottom:2px;">同業</span>`;
      displayHtml += `<div style="color:#495057;word-break:break-word;">${colleagueName}</div>`;
      
      if(colleaguePhone) {
        displayHtml += `<div style="color:#ff9800;margin-top:2px;cursor:pointer;" onclick="showColleaguePhone('${colleaguePhone}', '${colleagueName}')">📞 ${colleaguePhone}</div>`;
      }
      
      displayHtml += `</div>`;
      memberCell.innerHTML = displayHtml;
    } else {
      // 成員借出
      const memberId = record.memberId;
      const memberName = record.memberName || record.displayName;
      const phone = CONTACT_PHONES[memberId];
      
      // 檢查是否為主管（編號90以上）
      const isManager = parseInt(memberId) >= 90;
      const displayName = isManager ? `👔 ${memberName}` : `${memberId} ${memberName}`;
      
      if(phone){
        memberCell.innerHTML = `<div><span style="cursor:pointer;color:#007bff;text-decoration:underline;" onclick="showPhone('${memberId}', '${memberName}')">${displayName}</span></div>`;
      }else{
        memberCell.innerHTML = `<div>${displayName}</div>`;
      }
    }
    
    const keyCell = document.createElement('td');
    keyCell.className = 'auto-size';
    const itemCount = record.itemCount || 0;
    
    // 檢查鑰匙項目是否過長（超過50個字符）
    const keyItemText = record.keyItem || '';
    const isLongText = keyItemText.length > 50;
    const displayText = isLongText ? keyItemText.substring(0, 50) + '...' : keyItemText;
    
    // 創建鑰匙項目顯示區域
    const keyDiv = document.createElement('div');
    keyDiv.style.cssText = 'word-break:break-word;line-height:1.5;cursor:pointer;color:#007bff;text-decoration:' + (isLongText ? 'underline' : 'none') + ';';
    keyDiv.title = '點擊查看完整內容';
    keyDiv.textContent = displayText;
    
    // 添加數量標籤
    if(itemCount > 1) {
      const badge = document.createElement('span');
      badge.style.cssText = 'background:#17a2b8;color:#fff;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:bold;margin-left:4px;white-space:nowrap;';
      badge.textContent = '×' + itemCount;
      keyDiv.appendChild(badge);
    }
    
    // 添加點擊事件
    keyDiv.addEventListener('click', function() {
      showFullKeyItem(keyItemText, itemCount);
    });
    
    keyCell.appendChild(keyDiv);
    
    const statusCell = document.createElement('td');
    statusCell.className = 'auto-size';
    statusCell.innerHTML = `<div style="font-weight:bold;">${record.status === 'borrowed' ? '借出中' : '已歸還'}</div>`;
    statusCell.className += ` status-${record.status}`;
    
    const dutyCell = document.createElement('td');
    dutyCell.className = 'auto-size';
    const isColleague = borrowerType === 'colleague';
    
    if(record.status === 'returned' && record.dutyConfirmed){
      dutyCell.innerHTML = `<div>✅ 已確認</div><div style="color:#666;margin-top:2px;">${record.dutyConfirmedBy}</div>`;
      dutyCell.style.background = '#d4edda';
    }else if(record.status === 'returned' && !record.dutyConfirmed){
      const buttonStyle = isColleague ? 
        'background:linear-gradient(135deg,#ff9800 0%,#f57c00 100%);color:#fff;font-weight:bold;' : 
        '';
      dutyCell.innerHTML = `<button class="key-action-btn confirm" style="${buttonStyle}" onclick="dutyConfirm(${record.id})">${isColleague ? '🏢 確認' : '確認'}</button>`;
      if(isColleague) {
        dutyCell.style.background = '#fff3e0';
      }
    }else{
      if(isColleague && record.status === 'borrowed') {
        dutyCell.innerHTML = '<div style="color:#ff9800;font-weight:bold;">待歸還</div>';
        dutyCell.style.background = '#fff3e0';
      } else {
        dutyCell.innerHTML = '<div style="color:#999;">-</div>';
      }
    }
    
    const actionCell = document.createElement('td');
    if(record.status === 'borrowed'){
      const returnBtn = document.createElement('button');
      if(isColleague) {
        returnBtn.textContent = '🏢 歸還';
        returnBtn.className = 'key-action-btn return';
        returnBtn.style.cssText = 'background:linear-gradient(135deg,#ff9800 0%,#f57c00 100%);color:#fff;font-weight:bold;';
      } else {
        returnBtn.textContent = '歸還';
        returnBtn.className = 'key-action-btn return';
      }
      returnBtn.onclick = () => quickReturn(record.id);
      actionCell.appendChild(returnBtn);
    }
    
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '刪除';
    deleteBtn.className = 'key-action-btn delete';
    deleteBtn.onclick = () => deleteKeyRecord(record.id);
    actionCell.appendChild(deleteBtn);
    
    row.appendChild(timeCell);
    row.appendChild(memberCell);
    row.appendChild(keyCell);
    row.appendChild(statusCell);
    row.appendChild(dutyCell);
    row.appendChild(actionCell);
    
    tbody.appendChild(row);
  });
  
  // 渲染完成後自動調整文字大小
  setTimeout(() => {
    optimizeKeyTableTextSize();
  }, 100);
}

// 優化鑰匙表格文字大小 - 智能自適應算法
function optimizeKeyTableTextSize() {
  const table = document.getElementById('keyTable');
  if (!table) return;
  
  const rows = table.querySelectorAll('tbody tr');
  const windowWidth = window.innerWidth;
  
  // 根據視窗大小設定基礎字體範圍
  let baseMin, baseMax;
  if (windowWidth >= 1200) {
    baseMin = 11; baseMax = 16;
  } else if (windowWidth >= 768) {
    baseMin = 10; baseMax = 14;
  } else if (windowWidth >= 480) {
    baseMin = 9; baseMax = 12;
  } else {
    baseMin = 8; baseMax = 10;
  }
  
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    
    cells.forEach((cell, index) => {
      // 跳過操作按鈕欄位（最後一欄）
      if (index === cells.length - 1) return;
      
      const contentDiv = cell.querySelector('div');
      if (!contentDiv) return;
      
      const cellWidth = cell.offsetWidth;
      const cellHeight = cell.offsetHeight;
      
      // 根據視窗大小動態調整padding
      let padding;
      if (windowWidth >= 768) {
        padding = 8;
      } else if (windowWidth >= 480) {
        padding = 6;
      } else if (windowWidth >= 360) {
        padding = 4;
      } else {
        padding = 2;
      }
      
      const availableWidth = Math.max(20, cellWidth - padding);
      
      // 獲取純文字內容（不含HTML標籤和符號）
      const text = contentDiv.textContent || contentDiv.innerText || '';
      const textLength = text.length;
      const hasMultipleLines = contentDiv.children.length > 1;
      
      // 計算理想字體大小：根據可用寬度和字數
      // 假設每個字符平均寬度約為字體大小的 0.6-0.8 倍（中文）
      const estimatedCharWidth = 0.7;
      
      let fontSize;
      
      if (index === 0) {
        // 時間欄位 - 固定格式
        if (hasMultipleLines) {
          // 兩行時間，每行約10字符
          fontSize = Math.max(baseMin - 1, Math.min(baseMax - 2, availableWidth / (10 * estimatedCharWidth)));
        } else {
          // 單行時間
          fontSize = Math.max(baseMin, Math.min(baseMax - 1, availableWidth / (10 * estimatedCharWidth)));
        }
      } else if (index === 1) {
        // 借用人欄位 - 內容少時放大，多時縮小
        const effectiveLength = Math.max(6, textLength);
        fontSize = Math.max(baseMin, Math.min(baseMax + 1, availableWidth / (effectiveLength * estimatedCharWidth)));
        
        // 確保單行短文字可以顯示大字體
        if (textLength <= 8 && !hasMultipleLines) {
          fontSize = Math.min(baseMax + 2, fontSize);
        }
      } else if (index === 2) {
        // 鑰匙項目欄位 - 根據字數精確計算
        const itemCount = text.split('、').length;
        
        // 根據總字數計算最佳字體大小
        const effectiveLength = Math.max(5, textLength);
        fontSize = Math.max(baseMin - 1, Math.min(baseMax, availableWidth / (effectiveLength * estimatedCharWidth * 1.1)));
        
        // 根據項目數量微調
        if (itemCount === 1 && textLength <= 6) {
          // 單項且很短：使用大字體
          fontSize = Math.min(baseMax + 1, fontSize * 1.2);
        } else if (itemCount >= 5) {
          // 多項：適當縮小
          fontSize = fontSize * 0.85;
        }
      } else if (index === 3) {
        // 狀態欄位 - 固定3-4字
        fontSize = Math.max(baseMin, Math.min(baseMax, availableWidth / (4 * estimatedCharWidth)));
      } else if (index === 4) {
        // 值班確認欄位
        const effectiveLength = Math.max(4, textLength);
        fontSize = Math.max(baseMin - 1, Math.min(baseMax - 1, availableWidth / (effectiveLength * estimatedCharWidth * 0.9)));
        
        if (hasMultipleLines) {
          fontSize = fontSize * 0.9; // 多行時稍微縮小
        }
      }
      
      // 應用字體大小
      if (fontSize) {
        contentDiv.style.fontSize = `${Math.round(fontSize)}px`;
        
        // 子元素使用稍小的字體
        const childDivs = contentDiv.querySelectorAll('div');
        childDivs.forEach(child => {
          child.style.fontSize = `${Math.round(fontSize * 0.9)}px`;
        });
        
        // 特殊標籤保持固定小尺寸
        const badges = contentDiv.querySelectorAll('span[style*="background"]');
        badges.forEach(badge => {
          const badgeSize = Math.max(9, Math.min(11, fontSize * 0.75));
          badge.style.fontSize = `${Math.round(badgeSize)}px`;
        });
      }
    });
  });
}

function quickReturn(recordId){
  const records = JSON.parse(localStorage.getItem(KEY_RECORD_KEY) || '[]');
  const record = records.find(r => r.id === recordId);
  
  if(!record){
    showCustomAlert('❌ 找不到該記錄', 'error');
    return;
  }
  
  // 獲取借用人顯示名稱
  const borrowerType = record.borrowerType || 'member';
  let borrowerDisplay = '';
  
  if(borrowerType === 'colleague') {
    borrowerDisplay = `同業: ${record.colleagueName || record.displayName}`;
  } else {
    borrowerDisplay = record.displayName || `${record.memberId} ${record.memberName}`;
  }
  
  // 顯示確認彈窗
  showConfirmModal(
    '🔑 確認歸還',
    `確定要歸還「${record.keyItem}」嗎？`,
    `借用人：${borrowerDisplay}`,
    () => {
      const now = new Date();
      record.status = 'returned';
      record.returnTime = now.toISOString();
      record.returnTimeStr = `${now.getMonth()+1}/${now.getDate()} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
      
      localStorage.setItem(KEY_RECORD_KEY, JSON.stringify(records));
      
      // 發送歸還記錄到 Google Sheets
      sendKeyRecordToGoogleSheets(record, 'return');
      
      cleanOldRecords(); // 清理舊記錄
      renderKeyTable();
      showCustomAlert(`✅ ${borrowerDisplay} 已歸還「${record.keyItem}」`, 'success');
    }
  );
}

function clearKeyHistory(){
  // 顯示密碼驗證彈窗
  showPasswordModal(
    '🔒 管理員驗證',
    '清除所有鑰匙借出記錄需要管理員權限',
    '⚠️ 此操作無法復原！',
    () => {
      // 密碼驗證成功後，再次確認
      showConfirmModal(
        '🗑️ 確認清除記錄',
        '確定要清除所有鑰匙借出記錄嗎？',
        '此操作無法復原！',
        () => {
          localStorage.removeItem(KEY_RECORD_KEY);
          renderKeyTable();
          showCustomAlert('✅ 已清除所有鑰匙借出記錄', 'success');
        }
      );
    }
  );
}

// 顯示同業電話
function showColleaguePhone(phone, name) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'modal-content';
  
  // 提取電話號碼並格式化
  const phoneMatch = phone.match(/\d{4}-\d{3}-\d{3}/);
  const phoneNumber = phoneMatch ? phoneMatch[0] : phone;
  const telLink = phoneNumber.replace(/-/g, '');
  
  modal.innerHTML = `
    <button class="modal-close" onclick="closeModal(this)">&times;</button>
    <div class="modal-title">📞 同業聯絡電話</div>
    <div style="font-size: 18px; color: #495057; margin: 15px 0;">${name}</div>
    <div class="modal-phone">
      <a href="tel:${telLink}" style="color:#ff9800;text-decoration:none;font-size:28px;font-weight:bold;display:inline-block;margin-top:10px;padding:10px 20px;background:#fff3e0;border-radius:10px;transition:all 0.3s;" onmouseover="this.style.background='#ffe0b2'" onmouseout="this.style.background='#fff3e0'">
        📱 ${phoneNumber}
      </a>
      <div style="font-size:12px;color:#6c757d;margin-top:10px;">點擊號碼可直接撥打</div>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  overlay.addEventListener('click', function(e) {
    if(e.target === overlay) {
      closeModal(overlay);
    }
  });
  
  const escHandler = function(e) {
    if(e.key === 'Escape') {
      closeModal(overlay);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// 顯示聯絡電話
function showPhone(memberId, memberName){
  const phone = CONTACT_PHONES[memberId];
  
  // 創建彈窗遮罩
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  // 創建彈窗內容
  const modal = document.createElement('div');
  modal.className = 'modal-content';
  
  if(phone){
    // 提取電話號碼（去掉姓名）
    const phoneMatch = phone.match(/\d{4}-\d{3}-\d{3}/);
    const phoneNumber = phoneMatch ? phoneMatch[0] : '';
    const telLink = phoneNumber ? phoneNumber.replace(/-/g, '') : '';
    
    modal.innerHTML = `
      <button class="modal-close" onclick="closeModal(this)">&times;</button>
      <div class="modal-title">📞 聯絡電話</div>
      <div class="modal-phone">
        ${phone.split(' ')[0]}<br>
        <a href="tel:${telLink}" style="color:#007bff;text-decoration:none;font-size:28px;font-weight:bold;display:inline-block;margin-top:10px;padding:10px 20px;background:#e7f3ff;border-radius:10px;transition:all 0.3s;" onmouseover="this.style.background='#cce5ff'" onmouseout="this.style.background='#e7f3ff'">
          📱 ${phoneNumber}
        </a>
        <div style="font-size:12px;color:#6c757d;margin-top:10px;">點擊號碼可直接撥打</div>
      </div>
    `;
  }else{
    modal.innerHTML = `
      <button class="modal-close" onclick="closeModal(this)">&times;</button>
      <div class="modal-title">❌ 找不到聯絡電話</div>
      <div style="font-size: 18px; color: #666; margin: 20px 0;">${memberName} 的聯絡電話尚未建檔</div>
    `;
  }
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // 點擊遮罩關閉彈窗
  overlay.addEventListener('click', function(e) {
    if(e.target === overlay) {
      closeModal(overlay);
    }
  });
  
  // ESC鍵關閉彈窗
  const escHandler = function(e) {
    if(e.key === 'Escape') {
      closeModal(overlay);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// 關閉彈窗
function closeModal(element) {
  const overlay = element.closest ? element.closest('.modal-overlay') : element;
  if(overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
}

// 顯示新增鑰匙名稱彈窗
function showAddKeyNameModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.75);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.3s;
  `;
  
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    max-width: 500px;
    width: 90%;
    padding: 0;
    position: relative;
    animation: slideIn 0.3s;
  `;
  
  // 成員名單（開發業務下拉選單）- 包含所有成員和主管
  const regularMembers = MEMBERS
    .filter(m => !m.id.startsWith('9')) // 一般成員（01-26）
    .map(m => `<option value="${m.name}">${m.id} ${m.name}</option>`)
    .join('');
  
  const managers = MEMBERS
    .filter(m => m.id.startsWith('9')) // 主管（90-94）
    .map(m => `<option value="${m.name}">${m.id} ${m.name}</option>`)
    .join('');
  
  const memberOptions = `
    <optgroup label="一般成員">
      ${regularMembers}
    </optgroup>
    <optgroup label="主管">
      ${managers}
    </optgroup>
  `;
  
  modal.innerHTML = `
    <div style="background:rgba(255,255,255,0.95);padding:30px;border-radius:20px;">
      <h3 style="margin:0 0 20px;font-size:24px;color:#667eea;font-weight:bold;text-align:center;display:flex;align-items:center;justify-content:center;gap:10px;">
        <span style="font-size:28px;">🔑</span>
        <span>新增鑰匙名稱</span>
      </h3>
      
      <div style="margin-bottom:20px;">
        <label style="display:block;margin-bottom:8px;font-size:14px;font-weight:bold;color:#495057;">
          <span style="color:#dc3545;">*</span> 鑰匙案件名稱
        </label>
        <input type="text" id="newKeyName" placeholder="請輸入鑰匙案件名稱" 
          style="width:100%;padding:12px 15px;border:2px solid #dee2e6;border-radius:8px;font-size:16px;transition:all 0.3s;box-sizing:border-box;"
          onfocus="this.style.borderColor='#667eea';this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)'"
          onblur="this.style.borderColor='#dee2e6';this.style.boxShadow='none'">
      </div>
      
      <div style="margin-bottom:20px;">
        <label style="display:block;margin-bottom:8px;font-size:14px;font-weight:bold;color:#495057;">
          <span style="color:#dc3545;">*</span> 開發業務
        </label>
        <select id="newKeyDeveloper" 
          style="width:100%;padding:12px 15px;border:2px solid #dee2e6;border-radius:8px;font-size:16px;transition:all 0.3s;box-sizing:border-box;background:#fff;"
          onfocus="this.style.borderColor='#667eea';this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)'"
          onblur="this.style.borderColor='#dee2e6';this.style.boxShadow='none'">
          <option value="">-- 請選擇開發業務 --</option>
          ${memberOptions}
        </select>
      </div>
      
      <div style="margin-bottom:25px;">
        <label style="display:block;margin-bottom:8px;font-size:14px;font-weight:bold;color:#495057;">
          備註
        </label>
        <textarea id="newKeyNote" placeholder="選填：其他備註資訊" rows="3"
          style="width:100%;padding:12px 15px;border:2px solid #dee2e6;border-radius:8px;font-size:16px;transition:all 0.3s;box-sizing:border-box;resize:vertical;"
          onfocus="this.style.borderColor='#667eea';this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)'"
          onblur="this.style.borderColor='#dee2e6';this.style.boxShadow='none'"></textarea>
      </div>
      
      <div style="display:flex;gap:10px;justify-content:center;">
        <button onclick="submitAddKeyName()" 
          style="padding:12px 30px;background:linear-gradient(135deg,#28a745 0%,#20c997 100%);color:#fff;border:none;border-radius:25px;cursor:pointer;font-size:16px;font-weight:bold;box-shadow:0 4px 12px rgba(40,167,69,0.3);transition:all 0.3s;flex:1;max-width:200px;"
          onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(40,167,69,0.4)'"
          onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 12px rgba(40,167,69,0.3)'">
          ✅ 確認新增
        </button>
        <button onclick="closeModal(this.closest('.modal-overlay'))" 
          style="padding:12px 30px;background:#6c757d;color:#fff;border:none;border-radius:25px;cursor:pointer;font-size:16px;font-weight:bold;box-shadow:0 4px 12px rgba(108,117,125,0.3);transition:all 0.3s;flex:1;max-width:200px;"
          onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(108,117,125,0.4)'"
          onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 12px rgba(108,117,125,0.3)'">
          取消
        </button>
      </div>
      
      <p style="margin:15px 0 0;font-size:12px;color:#6c757d;text-align:center;">
        <span style="color:#dc3545;">*</span> 為必填欄位
      </p>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // 自動聚焦到第一個輸入框
  setTimeout(() => {
    document.getElementById('newKeyName')?.focus();
  }, 100);
  
  // ESC 鍵關閉
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal(overlay);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// 提交新增鑰匙名稱
async function submitAddKeyName() {
  const keyName = document.getElementById('newKeyName')?.value.trim();
  const developer = document.getElementById('newKeyDeveloper')?.value;
  const note = document.getElementById('newKeyNote')?.value.trim();
  
  // 驗證必填欄位
  if (!keyName) {
    alert('❌ 請輸入鑰匙案件名稱');
    document.getElementById('newKeyName')?.focus();
    return;
  }
  
  if (!developer) {
    alert('❌ 請選擇開發業務');
    document.getElementById('newKeyDeveloper')?.focus();
    return;
  }
  
  // 準備數據
  const data = {
    dataType: 'addKeyName',
    keyName: keyName,
    developer: developer,
    note: note
  };
  
  try {
    // 顯示載入中
    const submitBtn = event.target;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '⏳ 提交中...';
    submitBtn.disabled = true;
    
    // 發送到 Google Sheets
    const response = await fetch(GOOGLE_SHEETS_WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    // no-cors 模式下無法讀取響應，假設成功
    console.log('✅ 鑰匙名稱已提交到 Google Sheets');
    
    // 關閉彈窗
    const overlay = submitBtn.closest('.modal-overlay');
    closeModal(overlay);
    
    // 顯示成功訊息
    alert(`✅ 新增成功！\n\n鑰匙案件名稱：${keyName}\n開發業務：${developer}\n備註：${note || '無'}`);
    
    // 重新載入鑰匙名稱清單
    setTimeout(() => {
      loadAndCacheKeyList();
    }, 1000);
    
  } catch (error) {
    console.error('提交失敗:', error);
    alert('❌ 提交失敗，請檢查網路連線或稍後再試');
    
    // 恢復按鈕
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

// 自定義確認彈窗
function showConfirmModal(title, message, detail, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'modal-content';
  
  modal.innerHTML = `
    <button class="modal-close" onclick="closeModal(this)">&times;</button>
    <div class="modal-title">${title}</div>
    <div class="modal-message">${message}</div>
    <div style="font-size: 16px; color: #666; margin: 10px 0;">${detail}</div>
    <div class="modal-buttons">
      <button class="modal-btn confirm" onclick="confirmAction(this)">確認</button>
      <button class="modal-btn cancel" onclick="closeModal(this)">取消</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // 點擊遮罩關閉彈窗
  overlay.addEventListener('click', function(e) {
    if(e.target === overlay) {
      closeModal(overlay);
    }
  });
  
  // ESC鍵關閉彈窗
  const escHandler = function(e) {
    if(e.key === 'Escape') {
      closeModal(overlay);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  
  // 確認按鈕功能
  window.confirmAction = function(btn) {
    closeModal(overlay);
    if(onConfirm) onConfirm();
    document.removeEventListener('keydown', escHandler);
  };
}

// 換班密碼驗證彈窗
function showPasswordForShiftChange(date, shift, fromMember, toMember, onSuccess) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.75);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.3s;
  `;
  
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    max-width: 500px;
    width: 100%;
    padding: 0;
    overflow: hidden;
    animation: slideIn 0.3s;
  `;
  
  // 格式化日期顯示
  const dateObj = new Date(date);
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekDay = weekDays[dateObj.getDay()];
  const displayDate = `${dateObj.getFullYear()}年${dateObj.getMonth()+1}月${dateObj.getDate()}日 (${weekDay})`;
  
  modal.innerHTML = `
    <div style="background:#fff;padding:40px 30px;">
      <div style="text-align:center;margin-bottom:30px;">
        <div style="width:80px;height:80px;margin:0 auto 20px;background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(245,87,108,0.3);">
          <span style="font-size:40px;">🔄</span>
        </div>
        <h3 style="margin:0 0 10px;font-size:24px;color:#333;font-weight:bold;">換班驗證</h3>
        <p style="margin:0 0 20px;color:#6c757d;font-size:14px;">請由秘書/主管輸入密碼</p>
        
        <div style="background:#e3f2fd;padding:15px;border-radius:10px;margin-bottom:15px;border-left:4px solid #2196f3;">
          <div style="font-size:14px;color:#1565c0;text-align:left;">
            <div style="margin-bottom:8px;">
              <strong>📅 日期：</strong>
              <span style="font-size:15px;font-weight:bold;">${displayDate}</span>
            </div>
            <div style="margin-bottom:8px;">
              <strong>⏰ 班別：</strong>
              <span style="font-size:15px;font-weight:bold;">${shift}</span>
            </div>
          </div>
        </div>
        
        <div style="background:#fff3cd;padding:15px;border-radius:10px;border-left:4px solid #ffc107;">
          <div style="font-size:14px;color:#856404;text-align:left;">
            <strong>👥 換班內容：</strong><br>
            <div style="margin-top:10px;font-size:15px;text-align:center;">
              <span style="color:#dc3545;font-weight:bold;">「${fromMember}」</span> 
              <br>
              <span style="font-size:20px;margin:5px 0;display:inline-block;">⬇️</span>
              <br>
              <span style="color:#28a745;font-weight:bold;">「${toMember}」</span>
            </div>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom:25px;">
        <input type="password" id="shiftChangePasswordInput" placeholder="請輸入密碼" 
          style="width:100%;padding:15px 20px;border:2px solid #e9ecef;border-radius:12px;font-size:18px;text-align:center;letter-spacing:4px;transition:all 0.3s;box-sizing:border-box;"
          maxlength="10"
          onkeypress="if(event.key==='Enter') verifyShiftChangePassword(this.closest('.modal-overlay'))"
          onfocus="this.style.borderColor='#f5576c';this.style.boxShadow='0 0 0 4px rgba(245,87,108,0.1)';"
          onblur="this.style.borderColor='#e9ecef';this.style.boxShadow='none';"
        >
      </div>
      
      <div style="display:flex;gap:12px;">
        <button onclick="verifyShiftChangePassword(this.closest('.modal-overlay'))" 
          style="flex:1;padding:14px;background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:bold;cursor:pointer;transition:all 0.3s;box-shadow:0 4px 15px rgba(245,87,108,0.4);"
          onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(245,87,108,0.5)';"
          onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 15px rgba(245,87,108,0.4)';">
          ✓ 確認換班
        </button>
        <button onclick="closeModal(this.closest('.modal-overlay'))" 
          style="flex:1;padding:14px;background:#f8f9fa;color:#495057;border:none;border-radius:12px;font-size:16px;font-weight:bold;cursor:pointer;transition:all 0.3s;"
          onmouseover="this.style.background='#e9ecef';"
          onmouseout="this.style.background='#f8f9fa';">
          ✕ 取消
        </button>
      </div>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // 保存回調函數
  window._shiftChangeCallback = onSuccess;
  
  // 自動聚焦到密碼輸入框
  setTimeout(() => {
    const input = document.getElementById('shiftChangePasswordInput');
    if (input) input.focus();
  }, 100);
  
  // 點擊遮罩關閉
  overlay.addEventListener('click', function(e) {
    if(e.target === overlay) {
      closeModal(overlay);
      window._shiftChangeCallback = null;
    }
  });
  
  // ESC鍵關閉
  const escHandler = function(e) {
    if(e.key === 'Escape') {
      closeModal(overlay);
      window._shiftChangeCallback = null;
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// 驗證換班密碼
function verifyShiftChangePassword(overlay) {
  const input = document.getElementById('shiftChangePasswordInput');
  const password = input ? input.value : '';
  
  if (password === ADMIN_PASSWORD) {
    closeModal(overlay);
    
    // 執行換班回調
    if (window._shiftChangeCallback) {
      window._shiftChangeCallback();
      window._shiftChangeCallback = null;
    }
  } else {
    // 密碼錯誤動畫
    if (input) {
      input.style.borderColor = '#dc3545';
      input.style.background = '#fff5f5';
      input.value = '';
      input.placeholder = '❌ 密碼錯誤，請重試';
      
      // 抖動動畫
      input.style.animation = 'shake 0.5s';
      
      setTimeout(() => {
        input.style.borderColor = '#e9ecef';
        input.style.background = '#fff';
        input.placeholder = '請輸入密碼';
        input.style.animation = '';
        input.focus();
      }, 500);
    }
  }
}

// 密碼驗證彈窗
function requirePassword(functionName) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.75);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.3s;
  `;
  
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    max-width: 450px;
    width: 100%;
    padding: 0;
    overflow: hidden;
    animation: slideIn 0.3s;
  `;
  
  const functionNames = {
    'autoAssign': '隨機平均排班',
    'clearData': '清除本月資料',
    'exportCsv': '匯出 CSV',
    'quickFill': '快速填班',
    'showStatistics': '排班統計',
    'syncFromSheets': '從 Sheets 同步',
    'openSheets': '開啟 Sheets'
  };
  
  modal.innerHTML = `
    <div style="background:#fff;padding:40px 30px;">
      <div style="text-align:center;margin-bottom:30px;">
        <div style="width:80px;height:80px;margin:0 auto 20px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(102,126,234,0.3);">
          <span style="font-size:40px;">🔐</span>
        </div>
        <h3 style="margin:0 0 10px;font-size:24px;color:#333;font-weight:bold;">管理員驗證</h3>
        <p style="margin:0;color:#6c757d;font-size:14px;">請輸入密碼以使用「${functionNames[functionName]}」功能</p>
      </div>
      
      <div style="margin-bottom:25px;">
        <input type="password" id="adminPasswordInput" placeholder="請輸入密碼" 
          style="width:100%;padding:15px 20px;border:2px solid #e9ecef;border-radius:12px;font-size:18px;text-align:center;letter-spacing:4px;transition:all 0.3s;box-sizing:border-box;"
          maxlength="10"
          onkeypress="if(event.key==='Enter') verifyPassword('${functionName}', this.closest('.modal-overlay'))"
          onfocus="this.style.borderColor='#667eea';this.style.boxShadow='0 0 0 4px rgba(102,126,234,0.1)';"
          onblur="this.style.borderColor='#e9ecef';this.style.boxShadow='none';"
        >
      </div>
      
      <div style="display:flex;gap:12px;">
        <button onclick="verifyPassword('${functionName}', this.closest('.modal-overlay'))" 
          style="flex:1;padding:14px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:bold;cursor:pointer;transition:all 0.3s;box-shadow:0 4px 15px rgba(102,126,234,0.4);"
          onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 20px rgba(102,126,234,0.5)';"
          onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 15px rgba(102,126,234,0.4)';">
          ✓ 確認
        </button>
        <button onclick="closeModal(this.closest('.modal-overlay'))" 
          style="flex:1;padding:14px;background:#f8f9fa;color:#495057;border:none;border-radius:12px;font-size:16px;font-weight:bold;cursor:pointer;transition:all 0.3s;"
          onmouseover="this.style.background='#e9ecef';"
          onmouseout="this.style.background='#f8f9fa';">
          ✕ 取消
        </button>
      </div>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // 自動聚焦到密碼輸入框
  setTimeout(() => {
    const input = document.getElementById('adminPasswordInput');
    if (input) input.focus();
  }, 100);
  
  // 點擊遮罩關閉
  overlay.addEventListener('click', function(e) {
    if(e.target === overlay) {
      closeModal(overlay);
    }
  });
  
  // ESC鍵關閉
  const escHandler = function(e) {
    if(e.key === 'Escape') {
      closeModal(overlay);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// 驗證密碼
function verifyPassword(functionName, overlay) {
  const input = document.getElementById('adminPasswordInput');
  const password = input ? input.value : '';
  
  if (password === ADMIN_PASSWORD) {
    closeModal(overlay);
    
    // 執行對應的功能
    switch(functionName) {
      case 'autoAssign':
        autoAssign();
        break;
      case 'clearData':
        clearData();
        break;
      case 'exportCsv':
        exportCsv();
        break;
      case 'quickFill':
        quickFill();
        break;
      case 'showStatistics':
        showStatistics();
        break;
      case 'syncFromSheets':
        syncScheduleFromSheets();
        break;
      case 'openSheets':
        openGoogleSheets();
        break;
    }
  } else {
    // 密碼錯誤動畫
    if (input) {
      input.style.borderColor = '#dc3545';
      input.style.background = '#fff5f5';
      input.value = '';
      input.placeholder = '❌ 密碼錯誤，請重試';
      
      // 抖動動畫
      input.style.animation = 'shake 0.5s';
      
      setTimeout(() => {
        input.style.borderColor = '#e9ecef';
        input.style.background = '#fff';
        input.placeholder = '請輸入密碼';
        input.style.animation = '';
        input.focus();
      }, 500);
    }
  }
}

// 通用密碼驗證彈窗（支援自定義回調）
function showPasswordModal(title, message, warning, onSuccess) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'display:flex;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;align-items:center;justify-content:center;animation:fadeIn 0.3s;';
  
  const modal = document.createElement('div');
  modal.className = 'modal-content';
  modal.style.cssText = 'background:#fff;padding:30px;border-radius:15px;box-shadow:0 10px 40px rgba(0,0,0,0.3);max-width:450px;width:90%;position:relative;animation:slideIn 0.3s;';
  
  modal.innerHTML = `
    <button class="modal-close" onclick="closeModal(this)" style="position:absolute;top:15px;right:15px;background:none;border:none;font-size:28px;cursor:pointer;color:#999;line-height:1;padding:0;width:30px;height:30px;display:flex;align-items:center;justify-content:center;transition:all 0.3s;" onmouseover="this.style.color='#333';this.style.transform='rotate(90deg)'" onmouseout="this.style.color='#999';this.style.transform='rotate(0deg)'">&times;</button>
    
    <div style="text-align:center;margin-bottom:25px;">
      <h3 style="margin:0 0 10px;font-size:24px;color:#333;font-weight:bold;">${title}</h3>
      <p style="margin:0 0 5px;color:#666;font-size:16px;line-height:1.5;">${message}</p>
      ${warning ? `<p style="margin:8px 0 0;color:#dc3545;font-size:14px;font-weight:500;">${warning}</p>` : ''}
    </div>
    
    <div style="margin-bottom:20px;">
      <input type="password" id="generalPasswordInput" placeholder="請輸入管理員密碼" 
        style="width:100%;padding:12px 15px;border:2px solid #dee2e6;border-radius:8px;font-size:16px;transition:all 0.3s;box-sizing:border-box;"
        onfocus="this.style.borderColor='#667eea';this.style.boxShadow='0 0 0 3px rgba(102,126,234,0.1)'"
        onblur="this.style.borderColor='#dee2e6';this.style.boxShadow='none'"
        onkeypress="if(event.key==='Enter') verifyGeneralPassword(this.closest('.modal-overlay'))">
    </div>
    
    <div style="display:flex;gap:10px;justify-content:center;">
      <button onclick="verifyGeneralPassword(this.closest('.modal-overlay'))" 
        style="flex:1;padding:12px 20px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:16px;font-weight:bold;transition:all 0.3s;"
        onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 5px 15px rgba(102,126,234,0.4)'"
        onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'">
        ✓ 確認
      </button>
      <button onclick="closeModal(this)" 
        style="flex:1;padding:12px 20px;background:#f8f9fa;color:#666;border:1px solid #dee2e6;border-radius:8px;cursor:pointer;font-size:16px;font-weight:500;transition:all 0.3s;"
        onmouseover="this.style.background='#e9ecef'"
        onmouseout="this.style.background='#f8f9fa'">
        ✕ 取消
      </button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // 保存回調函數
  window._generalPasswordCallback = onSuccess;
  
  // 自動聚焦到密碼輸入框
  setTimeout(() => {
    const input = document.getElementById('generalPasswordInput');
    if (input) input.focus();
  }, 100);
  
  // 點擊遮罩關閉
  overlay.addEventListener('click', function(e) {
    if(e.target === overlay) {
      closeModal(overlay);
      window._generalPasswordCallback = null;
    }
  });
  
  // ESC鍵關閉
  const escHandler = function(e) {
    if(e.key === 'Escape') {
      closeModal(overlay);
      window._generalPasswordCallback = null;
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

// 驗證通用密碼
function verifyGeneralPassword(overlay) {
  const input = document.getElementById('generalPasswordInput');
  const password = input ? input.value : '';
  
  if (password === ADMIN_PASSWORD) {
    closeModal(overlay);
    
    // 執行回調
    if (window._generalPasswordCallback) {
      window._generalPasswordCallback();
      window._generalPasswordCallback = null;
    }
  } else {
    // 密碼錯誤動畫
    if (input) {
      input.style.borderColor = '#dc3545';
      input.style.background = '#fff5f5';
      input.value = '';
      input.placeholder = '❌ 密碼錯誤，請重試';
      
      // 抖動動畫
      input.style.animation = 'shake 0.5s';
      
      setTimeout(() => {
        input.style.borderColor = '#dee2e6';
        input.style.background = '#fff';
        input.placeholder = '請輸入管理員密碼';
        input.style.animation = '';
        input.focus();
      }, 500);
    }
  }
}

// 自定義提示彈窗
// HTML 特殊字符轉義函數
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 顯示完整鑰匙項目內容的彈窗
function showFullKeyItem(keyItem, itemCount) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'modal-content';
  modal.style.maxWidth = '600px';
  
  // 創建關閉按鈕
  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = function() { closeModal(overlay); };
  modal.appendChild(closeBtn);
  
  // 創建標題
  const titleDiv = document.createElement('div');
  titleDiv.className = 'modal-title';
  titleDiv.style.cssText = 'display:flex;align-items:center;gap:8px;';
  titleDiv.textContent = '🔑 鑰匙項目詳情';
  
  // 添加數量標籤
  if(itemCount > 1) {
    const badge = document.createElement('span');
    badge.style.cssText = 'background:#17a2b8;color:#fff;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:bold;margin-left:8px;white-space:nowrap;';
    badge.textContent = '×' + itemCount + ' 項目';
    titleDiv.appendChild(badge);
  }
  modal.appendChild(titleDiv);
  
  // 創建內容區域
  const contentWrapper = document.createElement('div');
  contentWrapper.style.cssText = 'padding:20px;background:#f8f9fa;border-radius:8px;margin:15px 0;max-height:400px;overflow-y:auto;';
  
  const contentDiv = document.createElement('div');
  contentDiv.style.cssText = 'font-size:16px;line-height:1.8;color:#212529;word-break:break-word;white-space:pre-wrap;';
  contentDiv.textContent = keyItem;
  contentWrapper.appendChild(contentDiv);
  modal.appendChild(contentWrapper);
  
  // 創建按鈕區域
  const buttonsDiv = document.createElement('div');
  buttonsDiv.className = 'modal-buttons';
  
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'modal-btn confirm';
  confirmBtn.textContent = '關閉';
  confirmBtn.onclick = function() { closeModal(overlay); };
  buttonsDiv.appendChild(confirmBtn);
  modal.appendChild(buttonsDiv);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // 點擊遮罩關閉彈窗
  overlay.addEventListener('click', function(e) {
    if(e.target === overlay) {
      closeModal(overlay);
    }
  });
  
  // ESC鍵關閉彈窗
  const escHandler = function(e) {
    if(e.key === 'Escape') {
      closeModal(overlay);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}

function showCustomAlert(message, type = 'info') {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'modal-content';
  
  const typeClass = type === 'success' ? 'modal-success' : type === 'error' ? 'modal-error' : '';
  
  modal.innerHTML = `
    <button class="modal-close" onclick="closeModal(this)">&times;</button>
    <div class="modal-title">${type === 'success' ? '✅ 成功' : type === 'error' ? '❌ 錯誤' : 'ℹ️ 提示'}</div>
    <div class="modal-message ${typeClass}">${message}</div>
    <div class="modal-buttons">
      <button class="modal-btn confirm" onclick="closeModal(this)">確定</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // 點擊遮罩關閉彈窗
  overlay.addEventListener('click', function(e) {
    if(e.target === overlay) {
      closeModal(overlay);
    }
  });
  
  // ESC鍵關閉彈窗
  const escHandler = function(e) {
    if(e.key === 'Escape') {
      closeModal(overlay);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  
  // 3秒後自動關閉
  setTimeout(() => {
    if(overlay.parentNode) {
      closeModal(overlay);
      document.removeEventListener('keydown', escHandler);
    }
  }, 3000);
}

// 排班統計功能
function showStatistics() {
  const ym = document.getElementById('monthPicker').value;
  const data = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  const days = daysInMonth(ym);
  
  // 統計數據
  const stats = {
    totalShifts: 0,
    memberStats: {},
    shiftStats: { morning: 0, noon: 0, evening: 0 },
    weekdayStats: { weekday: 0, weekend: 0 },
    dateStats: {}
  };
  
  // 初始化成員統計
  MEMBERS.filter(m => !m.disabled).forEach(member => {
    stats.memberStats[member.id] = {
      name: member.name,
      total: 0,
      morning: 0,
      noon: 0,
      evening: 0,
      weekday: 0,
      weekend: 0
    };
  });
  
  // 分析排班數據
  for (let d = 1; d <= days; d++) {
    const wd = new Date(`${ym}-${String(d).padStart(2,'0')}`).getDay();
    const isWeekend = (wd === 0 || wd === 6);
    const shifts = isWeekend ? WEEKEND_SHIFTS : WEEKDAY_SHIFTS;
    
    stats.dateStats[d] = { weekday: !isWeekend, shifts: [] };
    
    shifts.forEach(shift => {
      const key = `${ym}:${d}-${shift.key}`;
      if (data[key]) {
        stats.totalShifts++;
        stats.shiftStats[shift.key]++;
        
        if (isWeekend) {
          stats.weekdayStats.weekend++;
        } else {
          stats.weekdayStats.weekday++;
        }
        
        stats.memberStats[data[key]].total++;
        stats.memberStats[data[key]][shift.key]++;
        stats.memberStats[data[key]][isWeekend ? 'weekend' : 'weekday']++;
        
        stats.dateStats[d].shifts.push({
          shift: shift.key,
          member: data[key],
          memberName: MEMBERS.find(m => m.id === data[key])?.name || data[key]
        });
      }
    });
  }
  
  // 生成統計報表HTML
  let reportHtml = `
    <div class="stats-container">
      <h2>📊 ${ym} 排班統計報表</h2>
      
      <div class="stats-section">
        <div class="stats-title">總體統計</div>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">${stats.totalShifts}</div>
            <div class="stat-label">總班數</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${Object.keys(stats.memberStats).length}</div>
            <div class="stat-label">參與成員</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${Math.round(stats.totalShifts / Object.keys(stats.memberStats).length * 10) / 10}</div>
            <div class="stat-label">平均班數</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${days}</div>
            <div class="stat-label">本月天數</div>
          </div>
        </div>
      </div>
      
      <div class="stats-section">
        <div class="stats-title">班別分布</div>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">${stats.shiftStats.morning}</div>
            <div class="stat-label">早班</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.shiftStats.noon}</div>
            <div class="stat-label">中班</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.shiftStats.evening}</div>
            <div class="stat-label">晚班</div>
          </div>
        </div>
      </div>
      
      <div class="stats-section">
        <div class="stats-title">平日/假日分布</div>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">${stats.weekdayStats.weekday}</div>
            <div class="stat-label">平日班</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.weekdayStats.weekend}</div>
            <div class="stat-label">假日班</div>
          </div>
        </div>
      </div>
      
      <div class="stats-section">
        <div class="stats-title">成員班數統計</div>
        <div class="chart-container">
          <div class="bar-chart">
  `;
  
  // 生成成員班數圖表
  const sortedMembers = Object.entries(stats.memberStats)
    .sort((a, b) => b[1].total - a[1].total);
  
  const maxShifts = Math.max(...sortedMembers.map(([_, stats]) => stats.total));
  
  sortedMembers.forEach(([memberId, memberStats]) => {
    const height = memberStats.total > 0 ? (memberStats.total / maxShifts * 180) + 20 : 20;
    reportHtml += `
      <div class="bar" style="height: ${height}px;">
        <div class="bar-value">${memberStats.total}</div>
      </div>
    `;
  });
  
  reportHtml += `
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 30px;">
  `;
  
  sortedMembers.forEach(([memberId, memberStats]) => {
    reportHtml += `
      <div class="bar-label">${memberId}</div>
    `;
  });
  
  reportHtml += `
          </div>
        </div>
      </div>
      
      <div class="stats-section">
        <div class="stats-title">詳細成員統計</div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <thead>
            <tr style="background: #f8f9fa;">
              <th style="padding: 10px; border: 1px solid #dee2e6;">成員</th>
              <th style="padding: 10px; border: 1px solid #dee2e6;">總班數</th>
              <th style="padding: 10px; border: 1px solid #dee2e6;">早班</th>
              <th style="padding: 10px; border: 1px solid #dee2e6;">中班</th>
              <th style="padding: 10px; border: 1px solid #dee2e6;">晚班</th>
              <th style="padding: 10px; border: 1px solid #dee2e6;">平日</th>
              <th style="padding: 10px; border: 1px solid #dee2e6;">假日</th>
            </tr>
          </thead>
          <tbody>
  `;
  
  sortedMembers.forEach(([memberId, memberStats]) => {
    reportHtml += `
      <tr>
        <td style="padding: 8px; border: 1px solid #dee2e6;">${memberId} ${memberStats.name}</td>
        <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center; font-weight: bold;">${memberStats.total}</td>
        <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">${memberStats.morning}</td>
        <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">${memberStats.noon}</td>
        <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">${memberStats.evening}</td>
        <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">${memberStats.weekday}</td>
        <td style="padding: 8px; border: 1px solid #dee2e6; text-align: center;">${memberStats.weekend}</td>
      </tr>
    `;
  });
  
  reportHtml += `
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  // 顯示統計報表專用模態視窗
  showStatisticsModal(reportHtml);
}

// 統計報表專用模態視窗
function showStatisticsModal(content) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
  `;
  
  const modal = document.createElement('div');
  modal.className = 'modal-content';
  modal.style.cssText = `
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    max-width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    padding: 0;
  `;
  
  modal.innerHTML = `
    <button class="modal-close" onclick="closeModal(this.parentElement.parentElement)" style="
      position: absolute;
      top: 15px;
      right: 20px;
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
      z-index: 1001;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s;
    ">&times;</button>
    <div style="padding: 20px;">
      ${content}
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <button onclick="exportStatistics()" style="
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          margin-right: 10px;
          box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
        ">📄 匯出報表</button>
        <button onclick="closeModal(this.closest('.modal-overlay'))" style="
          background: linear-gradient(135deg, #6c757d 0%, #495057 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(108, 117, 125, 0.3);
        ">關閉</button>
      </div>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // 點擊遮罩關閉
  overlay.addEventListener('click', function(e) {
    if(e.target === overlay) {
      closeModal(overlay);
    }
  });
  
  // ESC鍵關閉
  const escHandler = function(e) {
    if(e.key === 'Escape') {
      closeModal(overlay);
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
  
  // 關閉時移除事件監聽器
  const originalCloseModal = window.closeModal;
  window.closeModal = function(element) {
    if (element === overlay) {
      document.removeEventListener('keydown', escHandler);
    }
    originalCloseModal(element);
  };
}

// 匯出統計報表
function exportStatistics() {
  const ym = document.getElementById('monthPicker').value;
  const data = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  const days = daysInMonth(ym);
  
  // 統計數據
  const stats = {
    totalShifts: 0,
    memberStats: {},
    shiftStats: { morning: 0, noon: 0, evening: 0 },
    weekdayStats: { weekday: 0, weekend: 0 }
  };
  
  // 初始化成員統計
  MEMBERS.filter(m => !m.disabled).forEach(member => {
    stats.memberStats[member.id] = {
      name: member.name,
      total: 0,
      morning: 0,
      noon: 0,
      evening: 0,
      weekday: 0,
      weekend: 0
    };
  });
  
  // 分析排班數據
  for (let d = 1; d <= days; d++) {
    const wd = new Date(`${ym}-${String(d).padStart(2,'0')}`).getDay();
    const isWeekend = (wd === 0 || wd === 6);
    const shifts = isWeekend ? WEEKEND_SHIFTS : WEEKDAY_SHIFTS;
    
    shifts.forEach(shift => {
      const key = `${ym}:${d}-${shift.key}`;
      if (data[key]) {
        stats.totalShifts++;
        stats.shiftStats[shift.key]++;
        
        if (isWeekend) {
          stats.weekdayStats.weekend++;
        } else {
          stats.weekdayStats.weekday++;
        }
        
        stats.memberStats[data[key]].total++;
        stats.memberStats[data[key]][shift.key]++;
        stats.memberStats[data[key]][isWeekend ? 'weekend' : 'weekday']++;
      }
    });
  }
  
  // 生成CSV內容
  let csvContent = `排班統計報表 - ${ym}\n\n`;
  csvContent += `總班數,${stats.totalShifts}\n`;
  csvContent += `參與成員,${Object.keys(stats.memberStats).length}\n`;
  csvContent += `平均班數,${Math.round(stats.totalShifts / Object.keys(stats.memberStats).length * 10) / 10}\n`;
  csvContent += `本月天數,${days}\n\n`;
  
  csvContent += `班別分布\n`;
  csvContent += `早班,${stats.shiftStats.morning}\n`;
  csvContent += `中班,${stats.shiftStats.noon}\n`;
  csvContent += `晚班,${stats.shiftStats.evening}\n\n`;
  
  csvContent += `平日/假日分布\n`;
  csvContent += `平日班,${stats.weekdayStats.weekday}\n`;
  csvContent += `假日班,${stats.weekdayStats.weekend}\n\n`;
  
  csvContent += `成員詳細統計\n`;
  csvContent += `成員編號,姓名,總班數,早班,中班,晚班,平日,假日\n`;
  
  const sortedMembers = Object.entries(stats.memberStats)
    .sort((a, b) => b[1].total - a[1].total);
  
  sortedMembers.forEach(([memberId, memberStats]) => {
    csvContent += `${memberId},${memberStats.name},${memberStats.total},${memberStats.morning},${memberStats.noon},${memberStats.evening},${memberStats.weekday},${memberStats.weekend}\n`;
  });
  
  // 下載CSV
  const blob = new Blob([csvContent], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `排班統計報表-${ym}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  showCustomAlert('✅ 統計報表已匯出', 'success');
}

// 調班申請功能
function showShiftChangeRequests() {
  const ym = document.getElementById('monthPicker').value;
  const requests = JSON.parse(localStorage.getItem(SHIFT_CHANGE_KEY) || '[]');
  const currentMonthRequests = requests.filter(req => req.month === ym);
  
  let content = `
    <div class="shift-change-container">
      <h2>🔄 調班申請管理 - ${ym}</h2>
      
      <div class="shift-change-form">
        <h3>新增調班申請</h3>
        <form id="shiftChangeForm">
          <div class="form-group">
            <label class="form-label">申請人：</label>
            <select class="form-select" id="applicantMember" required onchange="updateMemberShifts('${ym}')">
              <option value="">-- 請選擇申請人 --</option>
  `;
  
  MEMBERS.filter(m => !m.disabled).forEach(member => {
    content += `<option value="${member.id}">${member.id} ${member.name}</option>`;
  });
  
  content += `
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">原班別：</label>
            <div id="memberShiftsDisplay" style="min-height: 100px; border: 1px solid #dee2e6; border-radius: 4px; padding: 10px; background: #f8f9fa;">
              <p style="text-align: center; color: #6c757d; margin: 20px 0;">請先選擇申請人</p>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">目標班別：</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <select class="form-select" id="targetDay" required>
                <option value="">-- 選擇日期 --</option>
  `;
  
  for (let d = 1; d <= days; d++) {
    const wd = new Date(`${ym}-${String(d).padStart(2,'0')}`).getDay();
    const isWeekend = (wd === 0 || wd === 6);
    content += `<option value="${d}" data-weekend="${isWeekend}">${d}日 ${isWeekend ? '(假日)' : '(平日)'}</option>`;
  }
  
  content += `
              </select>
              <select class="form-select" id="targetShift" required>
                <option value="">-- 選擇班別 --</option>
                <option value="morning">早班</option>
                <option value="noon">中班</option>
                <option value="evening">晚班</option>
              </select>
            </div>
          </div>
          
          <div class="form-group">
            <label class="form-label">申請原因：</label>
            <textarea class="form-textarea" id="reason" placeholder="請說明調班原因..." required></textarea>
          </div>
          
          <div class="form-buttons">
            <button type="submit" class="form-btn form-btn-primary">提交申請</button>
            <button type="button" class="form-btn form-btn-secondary" onclick="closeModal(this.closest('.modal-overlay'))">取消</button>
          </div>
        </form>
      </div>
      
      <div class="requests-list">
        <h3>申請記錄 (${currentMonthRequests.length} 筆)</h3>
  `;
  
  if (currentMonthRequests.length === 0) {
    content += '<p style="text-align: center; color: #6c757d; padding: 20px;">目前沒有調班申請記錄</p>';
  } else {
    currentMonthRequests
      .sort((a, b) => new Date(b.submitTime) - new Date(a.submitTime))
      .forEach(request => {
        const applicant = MEMBERS.find(m => m.id === request.applicant);
        const statusClass = request.status === 'pending' ? 'status-pending' : 
                           request.status === 'approved' ? 'status-approved' : 'status-rejected';
        const statusText = request.status === 'pending' ? '待審核' : 
                          request.status === 'approved' ? '已核准' : '已拒絕';
        
        content += `
          <div class="request-item">
            <div class="request-header">
              <strong>${request.applicant} ${applicant ? applicant.name : ''}</strong>
              <span class="request-status ${statusClass}">${statusText}</span>
            </div>
            <div class="request-details">
              <strong>調班內容：</strong><br>
              從 ${request.originalDay}日 ${getShiftName(request.originalShift)} 調至 ${request.targetDay}日 ${getShiftName(request.targetShift)}<br>
              <strong>申請原因：</strong>${request.reason}<br>
              <strong>申請時間：</strong>${new Date(request.submitTime).toLocaleString('zh-TW')}
              ${request.status !== 'pending' ? `<br><strong>處理時間：</strong>${new Date(request.processTime).toLocaleString('zh-TW')}` : ''}
            </div>
            ${request.status === 'pending' ? `
              <div class="request-actions">
                <button class="action-btn btn-approve" onclick="processShiftChange('${request.id}', 'approved')">核准</button>
                <button class="action-btn btn-reject" onclick="processShiftChange('${request.id}', 'rejected')">拒絕</button>
              </div>
            ` : ''}
          </div>
        `;
      });
  }
  
  content += `
      </div>
    </div>
  `;
  
  showStatisticsModal(content);
  
  // 綁定表單提交事件
  setTimeout(() => {
    const form = document.getElementById('shiftChangeForm');
    if (form) {
      form.addEventListener('submit', handleShiftChangeSubmit);
    }
  }, 100);
}

// 處理調班申請提交
function handleShiftChangeSubmit(e) {
  e.preventDefault();
  
  const ym = document.getElementById('monthPicker').value;
  const applicant = document.getElementById('applicantMember').value;
  const selectedOriginal = document.getElementById('selectedOriginalShift');
  const targetDay = document.getElementById('targetDay').value;
  const targetShift = document.getElementById('targetShift').value;
  const reason = document.getElementById('reason').value;
  
  // 驗證申請
  if (!applicant || !selectedOriginal || !selectedOriginal.value || !targetDay || !targetShift || !reason) {
    showCustomAlert('請填寫所有必填欄位並選擇原班別', 'error');
    return;
  }
  
  // 解析原班別
  const [originalDay, originalShift] = selectedOriginal.value.split('-');
  
  // 檢查是否為同一天同一班別
  if (originalDay === targetDay && originalShift === targetShift) {
    showCustomAlert('原班別與目標班別不能相同', 'error');
    return;
  }
  
  // 檢查原班別是否存在
  const data = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  const originalKey = `${ym}:${originalDay}-${originalShift}`;
  if (!data[originalKey] || data[originalKey] !== applicant) {
    showCustomAlert('您在原班別沒有排班記錄', 'error');
    return;
  }
  
  // 檢查目標班別是否已被佔用
  const targetKey = `${ym}:${targetDay}-${targetShift}`;
  if (data[targetKey]) {
    showCustomAlert('目標班別已被其他人排班', 'error');
    return;
  }
  
  // 檢查平日中班限制
  const targetWeekend = document.querySelector(`#targetDay option[value="${targetDay}"]`).dataset.weekend === 'true';
  
  if (!targetWeekend && targetShift === 'noon') {
    showCustomAlert('平日不能申請中班', 'error');
    return;
  }
  
  // 創建申請記錄
  const request = {
    id: Date.now().toString(),
    month: ym,
    applicant: applicant,
    originalDay: parseInt(originalDay),
    originalShift: originalShift,
    targetDay: parseInt(targetDay),
    targetShift: targetShift,
    reason: reason,
    status: 'pending',
    submitTime: new Date().toISOString()
  };
  
  // 儲存申請
  const requests = JSON.parse(localStorage.getItem(SHIFT_CHANGE_KEY) || '[]');
  requests.push(request);
  localStorage.setItem(SHIFT_CHANGE_KEY, JSON.stringify(requests));
  
  showCustomAlert('✅ 調班申請已提交，等待審核', 'success');
  
  // 重新顯示申請列表
  setTimeout(() => {
    showShiftChangeRequests();
  }, 1000);
}

// 處理調班申請（核准/拒絕）
function processShiftChange(requestId, action) {
  const requests = JSON.parse(localStorage.getItem(SHIFT_CHANGE_KEY) || '[]');
  const requestIndex = requests.findIndex(req => req.id === requestId);
  
  if (requestIndex === -1) {
    showCustomAlert('找不到申請記錄', 'error');
    return;
  }
  
  const request = requests[requestIndex];
  
  if (action === 'approved') {
    // 執行調班
    const data = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    const ym = request.month;
    
    // 移除原班別
    const originalKey = `${ym}:${request.originalDay}-${request.originalShift}`;
    delete data[originalKey];
    
    // 添加新班別
    const targetKey = `${ym}:${request.targetDay}-${request.targetShift}`;
    data[targetKey] = request.applicant;
    
    // 儲存更新後的排班資料
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    
    // 更新頁面顯示
    hydrate();
    renderMemberList();
    updateDutyMember();
    
    showCustomAlert('✅ 調班申請已核准並執行', 'success');
    
    // 同步到 Google Sheets（異步執行）
    (async () => {
      await syncCurrentMonthToGoogleSheets('調班申請核准');
      showSyncNotification('📊 調班已同步到 Google Sheets');
    })();
  } else {
    showCustomAlert('❌ 調班申請已拒絕', 'error');
  }
  
  // 更新申請狀態
  requests[requestIndex].status = action;
  requests[requestIndex].processTime = new Date().toISOString();
  localStorage.setItem(SHIFT_CHANGE_KEY, JSON.stringify(requests));
  
  // 重新顯示申請列表
  setTimeout(() => {
    showShiftChangeRequests();
  }, 1000);
}

// 取得班別名稱
function getShiftName(shiftKey) {
  switch(shiftKey) {
    case 'morning': return '早班';
    case 'noon': return '中班';
    case 'evening': return '晚班';
    default: return shiftKey;
  }
}

// 更新成員班別顯示
function updateMemberShifts(month) {
  const memberSelect = document.getElementById('applicantMember');
  const shiftsDisplay = document.getElementById('memberShiftsDisplay');
  
  if (!memberSelect || !shiftsDisplay) return;
  
  const selectedMemberId = memberSelect.value;
  
  if (!selectedMemberId) {
    shiftsDisplay.innerHTML = '<p style="text-align: center; color: #6c757d; margin: 20px 0;">請先選擇申請人</p>';
    return;
  }
  
  // 獲取排班數據
  const data = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  const days = daysInMonth(month);
  const memberShifts = [];
  
  // 查找該成員的所有班別
  for (let d = 1; d <= days; d++) {
    const wd = new Date(`${month}-${String(d).padStart(2,'0')}`).getDay();
    const isWeekend = (wd === 0 || wd === 6);
    const shifts = isWeekend ? WEEKEND_SHIFTS : WEEKDAY_SHIFTS;
    
    shifts.forEach(shift => {
      const key = `${month}:${d}-${shift.key}`;
      if (data[key] === selectedMemberId) {
        memberShifts.push({
          day: d,
          shift: shift.key,
          shiftName: getShiftName(shift.key),
          isWeekend: isWeekend,
          key: key
        });
      }
    });
  }
  
  if (memberShifts.length === 0) {
    shiftsDisplay.innerHTML = '<p style="text-align: center; color: #dc3545; margin: 20px 0;">該成員本月沒有排班</p>';
    return;
  }
  
  // 生成班別選擇界面
  let shiftsHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">';
  
  memberShifts.forEach(shift => {
    const dayType = shift.isWeekend ? '(假日)' : '(平日)';
    shiftsHtml += `
      <div class="shift-option" data-day="${shift.day}" data-shift="${shift.shift}" style="
        padding: 10px;
        border: 2px solid #007bff;
        border-radius: 6px;
        text-align: center;
        cursor: pointer;
        background: #fff;
        transition: all 0.2s;
      " onclick="selectOriginalShift('${shift.day}', '${shift.shift}', '${shift.shiftName}')">
        <div style="font-weight: bold; color: #007bff;">${shift.day}日 ${dayType}</div>
        <div style="font-size: 14px; color: #495057;">${shift.shiftName}</div>
      </div>
    `;
  });
  
  shiftsHtml += '</div>';
  shiftsHtml += '<div id="selectedShiftInfo" style="margin-top: 15px; padding: 10px; background: #e7f3ff; border-radius: 4px; display: none;">';
  shiftsHtml += '<strong>已選擇：</strong><span id="selectedShiftText"></span>';
  shiftsHtml += '</div>';
  
  shiftsDisplay.innerHTML = shiftsHtml;
}

// 選擇原班別
function selectOriginalShift(day, shift, shiftName) {
  // 移除其他選中狀態
  document.querySelectorAll('.shift-option').forEach(option => {
    option.style.background = '#fff';
    option.style.borderColor = '#007bff';
  });
  
  // 標記選中的班別
  const selectedOption = document.querySelector(`[data-day="${day}"][data-shift="${shift}"]`);
  if (selectedOption) {
    selectedOption.style.background = '#007bff';
    selectedOption.style.color = '#fff';
  }
  
  // 顯示選中資訊
  const selectedInfo = document.getElementById('selectedShiftInfo');
  const selectedText = document.getElementById('selectedShiftText');
  if (selectedInfo && selectedText) {
    selectedInfo.style.display = 'block';
    selectedText.textContent = `${day}日 ${shiftName}`;
  }
  
  // 儲存選中的班別到隱藏欄位
  let hiddenInput = document.getElementById('selectedOriginalShift');
  if (!hiddenInput) {
    hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.id = 'selectedOriginalShift';
    document.getElementById('shiftChangeForm').appendChild(hiddenInput);
  }
  hiddenInput.value = `${day}-${shift}`;
}

// 自適應縮放優化
function optimizeScale() {
  const windowWidth = window.innerWidth;
  const rootElement = document.documentElement;
  
  // 根據視窗寬度動態調整縮放
  let scaleFactor, tableScale;
  
  if (windowWidth >= 1400) {
    scaleFactor = 1.05;
    tableScale = 1;
  } else if (windowWidth >= 1200) {
    scaleFactor = 1;
    tableScale = 0.95;
  } else if (windowWidth >= 992) {
    scaleFactor = 0.9;
    tableScale = 0.85;
  } else if (windowWidth >= 768) {
    scaleFactor = 0.85;
    tableScale = 0.75;
  } else if (windowWidth >= 576) {
    scaleFactor = 0.8;
    tableScale = 0.65;
  } else if (windowWidth >= 480) {
    scaleFactor = 0.75;
    tableScale = 0.6;
  } else if (windowWidth >= 360) {
    scaleFactor = 0.7;
    tableScale = 0.55;
  } else {
    scaleFactor = 0.65;
    tableScale = 0.5;
  }
  
  rootElement.style.setProperty('--scale-factor', scaleFactor);
  rootElement.style.setProperty('--table-scale', tableScale);
  
  // 確保表格完全適應視窗
  adjustTableToFit();
}

// 動態調整表格以適應視窗
function adjustTableToFit() {
  const tables = document.querySelectorAll('.table-container table');
  
  tables.forEach(table => {
    const container = table.closest('.table-container');
    if (!container) return;
    
    const containerWidth = container.clientWidth;
    const tableWidth = table.scrollWidth;
    
    // 如果表格寬度超過容器，進一步縮小
    if (tableWidth > containerWidth) {
      const currentScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--table-scale'));
      const ratio = containerWidth / tableWidth;
      const newScale = currentScale * ratio * 0.95; // 留一點邊距
      
      document.documentElement.style.setProperty('--table-scale', Math.max(0.4, newScale));
    }
  });
}

// 防抖函數
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 視窗大小改變時重新計算縮放
window.addEventListener('resize', debounce(() => {
  optimizeScale();
  // 同時重新調整鑰匙表格文字大小
  optimizeKeyTableTextSize();
}, 200));

// 頁面加載時優化縮放
window.addEventListener('load', () => {
  optimizeScale();
  // 表格渲染後再次調整
  setTimeout(() => {
    adjustTableToFit();
  }, 500);
});

// 跨視窗同步監聽器 - 實現多視窗即時同步
window.addEventListener('storage', function(e) {
  // 當其他視窗修改 localStorage 時觸發
  if (e.key === KEY_RECORD_KEY) {
    // 鑰匙借還記錄變更，重新渲染鑰匙表格
    renderKeyTable();
    console.log('🔄 檢測到其他視窗更新鑰匙記錄，已同步');
  } else if (e.key === STORE_KEY) {
    // 排班表數據變更，重新渲染排班表及相關資訊
    buildGrid();
    renderMemberList(); // 更新成員統計
    updateDutyMember(); // 更新值班人員
    console.log('🔄 檢測到其他視窗更新排班表，已同步');
  } else if (e.key === TEMP_DUTY_KEY) {
    // 臨時代班數據變更，重新渲染排班表及相關資訊
    buildGrid();
    updateDutyMember(); // 更新值班人員
    console.log('🔄 檢測到其他視窗更新臨時代班，已同步');
  } else if (e.key === SHIFT_CHANGE_KEY) {
    // 班別變更請求變更，重新渲染排班表及相關資訊
    buildGrid();
    renderMemberList(); // 更新成員統計
    updateDutyMember(); // 更新值班人員
    console.log('🔄 檢測到其他視窗更新班別變更請求，已同步');
  } else if (e.key === KEY_HISTORY_KEY) {
    // 鑰匙歷史記錄變更
    console.log('🔄 檢測到其他視窗更新鑰匙歷史記錄，已同步');
  } else if (e.key === COLLEAGUE_HISTORY_KEY) {
    // 同業電話歷史變更
    console.log('🔄 檢測到其他視窗更新同業電話記錄，已同步');
  } else if (e.key === HISTORY_KEY) {
    // 排班歷史記錄變更
    console.log('🔄 檢測到其他視窗更新排班歷史記錄，已同步');
  }
});

// 月份選擇器變更時自動從 Sheets 同步
document.getElementById('monthPicker').addEventListener('change', function() {
  console.log('📅 月份已切換，自動從 Google Sheets 同步最新排班...');
  setTimeout(() => {
    autoRefreshFromSheets();
  }, 500);
});

// 初始化
renderMemberList();
buildGrid();
initKeyRecord();
optimizeScale();

// 表格渲染後確保適應視窗
setTimeout(() => {
  optimizeScale();
  adjustTableToFit();
}, 300);

// 自動從 Google Sheets 載入資料（頁面載入時）
console.log('🔄 正在自動從 Google Sheets 載入資料...');
setTimeout(() => {
  autoRefreshFromSheets(); // 載入班表
  loadAndCacheKeyList();   // 載入鑰匙名稱清單
}, 1000);

// 定時自動刷新（每5分鐘檢查一次是否有更新）
setInterval(() => {
  autoRefreshFromSheets();
}, 5 * 60 * 1000);

console.log('💾 使用 localStorage + Google Sheets 雲端備份模式');
console.log('✅ 自動載入功能已啟用：頁面載入時自動同步，每5分鐘檢查更新');
