# 專案命名規範 (shun1010)

| 項目 | 值 |
|------|-----|
| **project_key** | shun1010 |
| **ns** | ns |
| **schema** | app_shun1010 |
| **storage_prefix** | app/shun1010/ |

## 標籤格式

```
ns.<key>.<value>
```

範例：`ns.role.admin`、`ns.page.roster`

## 事件格式

```
ns.<event_name>
```

範例：`ns.roster_published`、`ns.lending_created`

## 角色 (Role)

- `admin`
- `editor`
- `staff`
- `member`

## 使用方式

```ts
import { PROJECT_NAMING, ROLES } from '@/lib/constants';

// 標籤
PROJECT_NAMING.tag('role', 'admin');  // "ns.role.admin"

// 事件
PROJECT_NAMING.event('roster_published');  // "ns.roster_published"

// schema（例如 Supabase）
PROJECT_NAMING.schema;  // "app_shun1010"

// localStorage 鍵（已套用 storage_prefix）
// 例：app/shun1010/duty_members, app/shun1010/duty_roster_slots, ...
```

## localStorage 鍵一覽

前綴 `app/shun1010/`：

- `duty_members`
- `duty_roster_slots`
- `duty_rules`
- `duty_balance`
- `duty_fairness_settings`
- `duty_keys`
- `duty_lendings`
- `duty_lending_items`
- `duty_app_versions`
- `duty_external_links`

---

## Storage 規範（object storage，建議共用 bucket: public）

**prefix（固定）**：`app/shun1010/`

### 子目錄結構

```
app/shun1010/
├── site/
│   ├── hero/
│   └── icons/
├── articles/<article_id>/
│   ├── cover/
│   └── assets/
├── works/<work_id>/
├── listings/<listing_id>/
└── members/<user_id>/
```

### 後台上傳規則

- **BASE_PATH** 固定為 `app/shun1010/`
- 上傳成功後：
  - 原圖/檔案 **public URL** → `app_shun1010.media_assets.url`
  - **thumbnail** → `app_shun1010.media_assets.thumbnail_url`

### 使用方式

```ts
import { STORAGE_CONVENTION } from '@/lib/constants';

// bucket、BASE_PATH
STORAGE_CONVENTION.bucket;    // 'public'
STORAGE_CONVENTION.BASE_PATH; // 'app/shun1010/'

// 子目錄路徑（相對 BASE_PATH，含末尾 /）
STORAGE_CONVENTION.paths.site.hero();           // 'site/hero/'
STORAGE_CONVENTION.paths.site.icons();          // 'site/icons/'
STORAGE_CONVENTION.paths.article('art-1');      // 'articles/art-1/cover/'
STORAGE_CONVENTION.paths.articleAssets('art-1'); // 'articles/art-1/assets/'
STORAGE_CONVENTION.paths.work('w-1');           // 'works/w-1/'
STORAGE_CONVENTION.paths.listing('l-1');        // 'listings/l-1/'
STORAGE_CONVENTION.paths.member('u-1');         // 'members/u-1/'

// 完整路徑（上傳時：fullPath( paths.xxx(id) + filename )）
STORAGE_CONVENTION.fullPath('site/hero/banner.png');
// → 'app/shun1010/site/hero/banner.png'

// media_assets 對應欄位（寫入 DB 用）
STORAGE_CONVENTION.media_assets.url;          // 'url'
STORAGE_CONVENTION.media_assets.thumbnail_url; // 'thumbnail_url'
```
