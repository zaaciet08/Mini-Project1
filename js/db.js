/**
 * db.js - Robust IndexedDB Database Layer for VKU Field Survey PWA
 * Operates 100% locally with zero network connectivity.
 * Manages Inspections, Photos (Blob/Base64), Geolocation, and Sync Queue.
 */

const DB_NAME = 'VKU_FieldSurvey_DB';
const DB_VERSION = 1;

let dbInstance = null;

/**
 * Open and initialize the IndexedDB database
 */
export function openDatabase() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Object store for inspections
      if (!db.objectStoreNames.contains('inspections')) {
        const store = db.createObjectStore('inspections', { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('building', 'building', { unique: false });
        store.createIndex('facilityCategory', 'facilityCategory', { unique: false });
        store.createIndex('severity', 'severity', { unique: false });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
      }

      // Object store for audit logs
      if (!db.objectStoreNames.contains('audit_logs')) {
        const logStore = db.createObjectStore('audit_logs', { keyPath: 'id', autoIncrement: true });
        logStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Object store for app settings
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      console.log('[DB] IndexedDB connected successfully');
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('[DB] IndexedDB connection failed:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Generate a unique inspection record ID
 */
export function generateInspectionId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `VKU-${timestamp}-${randomStr}`;
}

/**
 * Add or update an inspection record
 */
export async function saveInspection(record) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['inspections', 'audit_logs'], 'readwrite');
    const store = transaction.objectStore('inspections');
    const logStore = transaction.objectStore('audit_logs');

    if (!record.id) {
      record.id = generateInspectionId();
    }

    const now = new Date().toISOString();
    if (!record.createdAt) {
      record.createdAt = now;
    }
    record.updatedAt = now;

    if (!record.syncStatus) {
      record.syncStatus = 'pending_sync';
    }

    const putRequest = store.put(record);

    putRequest.onsuccess = () => {
      logStore.add({
        action: 'SAVE_INSPECTION',
        inspectionId: record.id,
        severity: record.severity,
        building: record.building,
        timestamp: now
      });
      resolve(record);
    };

    putRequest.onerror = (event) => {
      console.error('[DB] Error saving inspection:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Retrieve all inspections, sorted newest first
 */
export async function getAllInspections(filter = {}) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['inspections'], 'readonly');
    const store = transaction.objectStore('inspections');
    const request = store.getAll();

    request.onsuccess = () => {
      let results = request.result || [];

      // Apply in-memory filters
      if (filter.building && filter.building !== 'all') {
        results = results.filter((item) => item.building === filter.building);
      }
      if (filter.severity && filter.severity !== 'all') {
        results = results.filter((item) => item.severity === filter.severity);
      }
      if (filter.syncStatus && filter.syncStatus !== 'all') {
        results = results.filter((item) => item.syncStatus === filter.syncStatus);
      }
      if (filter.category && filter.category !== 'all') {
        results = results.filter((item) => item.facilityCategory === filter.category);
      }
      if (filter.search && filter.search.trim()) {
        const q = filter.search.toLowerCase().trim();
        results = results.filter((item) =>
          (item.room && item.room.toLowerCase().includes(q)) ||
          (item.facilityName && item.facilityName.toLowerCase().includes(q)) ||
          (item.description && item.description.toLowerCase().includes(q)) ||
          (item.inspectorName && item.inspectorName.toLowerCase().includes(q)) ||
          (item.id && item.id.toLowerCase().includes(q))
        );
      }

      // Sort newest first
      results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(results);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Get single inspection by ID
 */
export async function getInspectionById(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['inspections'], 'readonly');
    const store = transaction.objectStore('inspections');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Delete an inspection
 */
export async function deleteInspection(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['inspections', 'audit_logs'], 'readwrite');
    const store = transaction.objectStore('inspections');
    const logStore = transaction.objectStore('audit_logs');

    const request = store.delete(id);

    request.onsuccess = () => {
      logStore.add({
        action: 'DELETE_INSPECTION',
        inspectionId: id,
        timestamp: new Date().toISOString()
      });
      resolve(true);
    };
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Get all records pending cloud sync
 */
export async function getPendingSyncInspections() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['inspections'], 'readonly');
    const store = transaction.objectStore('inspections');
    const index = store.index('syncStatus');
    const request = index.getAll('pending_sync');

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Mark a record as synced
 */
export async function markAsSynced(id, remoteId = null) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['inspections'], 'readwrite');
    const store = transaction.objectStore('inspections');
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) {
        return resolve(null);
      }
      record.syncStatus = 'synced';
      record.syncedAt = new Date().toISOString();
      if (remoteId) record.remoteId = remoteId;

      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror = (err) => reject(err);
    };

    getReq.onerror = (err) => reject(err);
  });
}

/**
 * Get statistics summary
 */
export async function getStatistics() {
  const all = await getAllInspections();
  const stats = {
    total: all.length,
    pendingSync: 0,
    synced: 0,
    critical: 0, // Hỏng hóc khẩn cấp
    warning: 0,  // Cần bảo trì
    good: 0,     // Bình thường
    byBuilding: {},
    byCategory: {}
  };

  all.forEach((item) => {
    // Sync counts
    if (item.syncStatus === 'pending_sync') stats.pendingSync++;
    else if (item.syncStatus === 'synced') stats.synced++;

    // Severity counts
    if (item.severity === 'critical') stats.critical++;
    else if (item.severity === 'warning') stats.warning++;
    else if (item.severity === 'good') stats.good++;

    // Building counts
    const b = item.building || 'Khác';
    stats.byBuilding[b] = (stats.byBuilding[b] || 0) + 1;

    // Category counts
    const c = item.facilityCategory || 'Khác';
    stats.byCategory[c] = (stats.byCategory[c] || 0) + 1;
  });

  return stats;
}

/**
 * Export all data to JSON
 */
export async function exportDataJSON() {
  const all = await getAllInspections();
  return JSON.stringify({
    appName: 'VKU Field Survey PWA',
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    totalRecords: all.length,
    inspections: all
  }, null, 2);
}

/**
 * Export data to Excel-compatible CSV with UTF-8 BOM
 */
export async function exportDataCSV() {
  const all = await getAllInspections();
  const headers = [
    'Mã Biên Bản (ID)',
    'Thời Gian Tạo',
    'Tòa Nhà / Khu Vực',
    'Phòng / Vị Trí Cụ Thể',
    'Hạng Mục Thiết Bị',
    'Tên Thiết Bị',
    'Mức Độ Tình Trạng',
    'Mô Tả Hỏng Hóc / Chi Tiết',
    'Đề Xuất Xử Lý',
    'Người Kiểm Tra',
    'Mã Số Giảng Viên/Sinh Viên',
    'Tọa Độ GPS (Vĩ độ, Kinh độ)',
    'Sai Số GPS (m)',
    'Có Đính Kèm Ảnh',
    'Trạng Thái Đồng Bộ',
    'Thời Gian Đồng Bộ'
  ];

  const escapeCSV = (str) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = all.map((item) => [
    escapeCSV(item.id),
    escapeCSV(new Date(item.createdAt).toLocaleString('vi-VN')),
    escapeCSV(item.buildingName || item.building),
    escapeCSV(item.room),
    escapeCSV(item.facilityCategoryName || item.facilityCategory),
    escapeCSV(item.facilityName),
    escapeCSV(
      item.severity === 'critical' ? 'Khẩn cấp / Hỏng nặng' :
      item.severity === 'warning' ? 'Cần bảo trì / sửa chữa' : 'Bình thường / Tốt'
    ),
    escapeCSV(item.description),
    escapeCSV(item.recommendation || 'Kiểm tra định kỳ'),
    escapeCSV(item.inspectorName),
    escapeCSV(item.inspectorId || 'N/A'),
    escapeCSV(item.geo ? `${item.geo.latitude}, ${item.geo.longitude}` : 'Không có'),
    escapeCSV(item.geo ? item.geo.accuracy : 'N/A'),
    escapeCSV(item.photos && item.photos.length > 0 ? `Có (${item.photos.length} ảnh)` : 'Không'),
    escapeCSV(item.syncStatus === 'synced' ? 'Đã đồng bộ Cloud' : 'Chờ đồng bộ (Offline)'),
    escapeCSV(item.syncedAt ? new Date(item.syncedAt).toLocaleString('vi-VN') : 'Chưa')
  ].join(','));

  // UTF-8 BOM (\uFEFF) ensures Excel displays Vietnamese accents properly
  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

/**
 * Settings helpers
 */
export async function getSetting(key, defaultValue = null) {
  const db = await openDatabase();
  return new Promise((resolve) => {
    const tx = db.transaction(['settings'], 'readonly');
    const store = tx.objectStore('settings');
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
    req.onerror = () => resolve(defaultValue);
  });
}

export async function setSetting(key, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['settings'], 'readwrite');
    const store = tx.objectStore('settings');
    const req = store.put({ key, value });
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e);
  });
}

/**
 * Seed realistic VKU Campus inspection sample records if DB is empty
 */
export async function seedSampleDataIfEmpty() {
  const existing = await getAllInspections();
  if (existing.length > 0) return;

  const samples = [
    {
      id: 'VKU-2026-A101',
      building: 'khu_a',
      buildingName: 'Khu Giảng đường A (Hành chính & Lý thuyết)',
      room: 'A.101 - Phòng học thông minh',
      facilityCategory: 'it_projector',
      facilityCategoryName: 'Máy chiếu & Thiết bị CNTT',
      facilityName: 'Máy chiếu Panasonic PT-LB300',
      severity: 'critical',
      description: 'Máy chiếu nhấp nháy đèn Lamp đỏ, mở 2 phút tự tắt, quạt kêu to bất thường.',
      recommendation: 'Cần thay bóng đèn máy chiếu và vệ sinh lọc bụi tản nhiệt gấp trước ca học chiều.',
      inspectorName: 'Nguyễn Văn An',
      inspectorId: 'VKU-GV-2024',
      inspectorRole: 'Cán bộ kỹ thuật phòng máy',
      geo: {
        latitude: 15.975412,
        longitude: 108.252631,
        accuracy: 8,
        zoneName: 'Khu Giảng đường A - VKU Campus'
      },
      photos: [
        {
          id: 'photo-1',
          dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%231E293B"/><rect x="80" y="80" width="240" height="120" rx="10" fill="%23475569"/><circle cx="150" cy="140" r="30" fill="%230284C7"/><circle cx="280" cy="110" r="10" fill="%23EF4444"/><text x="200" y="240" fill="%23FFFFFF" font-family="sans-serif" font-size="14" text-anchor="middle">Ảnh chụp: Đèn báo đỏ máy chiếu A.101</text></svg>',
          name: 'projector_lamp_error.jpg',
          timestamp: new Date(Date.now() - 3600000 * 5).toISOString()
        }
      ],
      syncStatus: 'synced',
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      syncedAt: new Date(Date.now() - 3600000 * 4).toISOString()
    },
    {
      id: 'VKU-2026-V203',
      building: 'khu_v',
      buildingName: 'Tòa nhà V - Viện Khoa học & Công nghệ số',
      room: 'V.203 - Lab Thực hành Đa nền tảng',
      facilityCategory: 'hvac_cooling',
      facilityCategoryName: 'Máy lạnh & Điều hòa không khí',
      facilityName: 'Điều hòa Casper Inverter 18000BTU',
      severity: 'warning',
      description: 'Điều hòa số 02 chảy nước ở máng thoát phía góc phải, làm ướt sàn gần dãy bàn máy tính.',
      recommendation: 'Thông tắc đường ống thoát nước ngưng và kiểm tra gas.',
      inspectorName: 'Trần Thị Mai',
      inspectorId: '21IT089',
      inspectorRole: 'Sinh viên khảo sát cơ sở vật chất',
      geo: {
        latitude: 15.976105,
        longitude: 108.251940,
        accuracy: 12,
        zoneName: 'Tòa nhà V (Digital Science Institute)'
      },
      photos: [],
      syncStatus: 'pending_sync',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
    },
    {
      id: 'VKU-2026-KTX1',
      building: 'ktx_k1',
      buildingName: 'Ký túc xá Sinh viên K1',
      room: 'K1.304 - Phòng ở sinh viên',
      facilityCategory: 'electrical_lighting',
      facilityCategoryName: 'Điện chiếu sáng & Ổ cắm',
      facilityName: 'Bóng đèn LED tuýp 1.2m',
      severity: 'warning',
      description: '1 bóng đèn LED bàn học bị chập chờn, phát ra tiếng vo ve khi bật công tắc.',
      recommendation: 'Thay thế máng đèn hoặc bóng LED mới.',
      inspectorName: 'Lê Hoàng Nam',
      inspectorId: '22IT145',
      inspectorRole: 'Trưởng ban tự quản KTX',
      geo: {
        latitude: 15.974890,
        longitude: 108.254120,
        accuracy: 15,
        zoneName: 'Khu Ký túc xá Sinh viên K1'
      },
      photos: [],
      syncStatus: 'pending_sync',
      createdAt: new Date(Date.now() - 3600000 * 1).toISOString()
    },
    {
      id: 'VKU-2026-LIB01',
      building: 'thu_vien',
      buildingName: 'Trung tâm Học liệu & Thư viện số',
      room: 'Tầng 2 - Không gian đọc mở & Co-working',
      facilityCategory: 'furniture',
      facilityCategoryName: 'Bàn ghế & Nội thất phòng học',
      facilityName: 'Cụm bàn ghế tự học nhóm số 14',
      severity: 'good',
      description: 'Toàn bộ 8 ghế đệm và bàn học nhóm đạt tiêu chuẩn, sạch sẽ, ổ cắm điện sàn hoạt động tốt.',
      recommendation: 'Duy trì bảo dưỡng định kỳ.',
      inspectorName: 'Phạm Thu Trang',
      inspectorId: 'VKU-CB-309',
      inspectorRole: 'Cán bộ quản lý thư viện',
      geo: {
        latitude: 15.975780,
        longitude: 108.253010,
        accuracy: 6,
        zoneName: 'Thư viện & Không gian Học liệu số VKU'
      },
      photos: [],
      syncStatus: 'synced',
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      syncedAt: new Date(Date.now() - 3600000 * 23).toISOString()
    }
  ];

  for (const sample of samples) {
    await saveInspection(sample);
  }
  console.log('[DB] Seeded VKU Campus sample data successfully');
}
