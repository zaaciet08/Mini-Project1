/**
 * ui.js - Presentation & View Controller for VKU Field Survey PWA
 * Handles DOM rendering, form management, photo gallery, modal, dashboard stats,
 * and user interactions.
 */

import {
  saveInspection,
  getAllInspections,
  getInspectionById,
  deleteInspection,
  getStatistics,
  exportDataCSV,
  exportDataJSON,
  seedSampleDataIfEmpty,
  getSetting,
  setSetting
} from './db.js';
import { compressImageFile } from './camera.js';
import { getCurrentCoordinates } from './geo.js';

// Local State
let currentPhotos = [];
let currentGeo = null;
let currentFilters = {
  search: '',
  building: 'all',
  severity: 'all',
  syncStatus: 'all'
};

/**
 * Toast Notification System
 */
export function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconMap = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  toast.innerHTML = `
    <span style="font-size: 1.1rem; font-weight: bold;">${iconMap[type] || 'ℹ'}</span>
    <div style="flex: 1; line-height: 1.35;">${message}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Tab Navigation Router
 */
export function initNavigation() {
  const tabs = ['new-survey', 'surveys-list', 'stats', 'settings'];

  function switchTab(targetTab) {
    if (!tabs.includes(targetTab)) targetTab = 'new-survey';

    // Update section visibility
    document.querySelectorAll('.app-view-section').forEach((sec) => {
      sec.classList.remove('active');
    });
    const activeSection = document.getElementById(`view-${targetTab}`);
    if (activeSection) activeSection.classList.add('active');

    // Update desktop tabs
    document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === targetTab);
    });

    // Update mobile nav
    document.querySelectorAll('.mobile-nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === targetTab);
    });

    // Hash navigation
    window.location.hash = targetTab;

    // View specific refresh
    if (targetTab === 'surveys-list') {
      renderInspectionsList();
    } else if (targetTab === 'stats') {
      renderDashboardStats();
    }
  }

  // Desktop click handlers
  document.querySelectorAll('.nav-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Mobile click handlers
  document.querySelectorAll('.mobile-nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Initial tab from hash or default
  const hash = window.location.hash.replace('#', '');
  switchTab(tabs.includes(hash) ? hash : 'new-survey');

  window.addEventListener('hashchange', () => {
    const newHash = window.location.hash.replace('#', '');
    if (tabs.includes(newHash)) {
      switchTab(newHash);
    }
  });
}

/**
 * Initialize Geolocation for Form
 */
export async function initGeolocationWidget() {
  const zoneEl = document.getElementById('geo-zone-text');
  const coordsEl = document.getElementById('geo-coords-text');
  const refreshBtn = document.getElementById('btn-refresh-geo');

  async function updateLocation() {
    if (zoneEl) zoneEl.textContent = 'Đang định vị GPS khuôn viên...';
    if (refreshBtn) refreshBtn.disabled = true;

    try {
      const geo = await getCurrentCoordinates(7000);
      currentGeo = geo;

      if (zoneEl) zoneEl.textContent = geo.zoneName;
      if (coordsEl) {
        coordsEl.textContent = `Tọa độ: ${geo.latitude}, ${geo.longitude} (±${geo.accuracy}m)`;
      }
    } catch (err) {
      if (zoneEl) zoneEl.textContent = 'Khuôn viên VKU (Chưa bắt được GPS)';
    } finally {
      if (refreshBtn) refreshBtn.disabled = false;
    }
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', (e) => {
      e.preventDefault();
      updateLocation();
      showToast('Đang quét lại tọa độ GPS vệ tinh...', 'info', 2000);
    });
  }

  // Initial location fetch
  updateLocation();
}

/**
 * Initialize Photo Capture / Upload
 */
export function initPhotoCaptureWidget() {
  const photoInput = document.getElementById('photo-input');
  const previewGrid = document.getElementById('photo-preview-grid');

  if (!photoInput || !previewGrid) return;

  photoInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    showToast(`Đang nén và xử lý ${files.length} ảnh chụp...`, 'info', 2000);

    for (const file of files) {
      try {
        const compressed = await compressImageFile(file);
        currentPhotos.push(compressed);
      } catch (err) {
        console.error('Lỗi nén ảnh:', err);
        showToast(`Lỗi khi tải ảnh ${file.name}: ${err.message}`, 'error');
      }
    }

    renderPhotoThumbnails();
    photoInput.value = ''; // Reset input to allow re-uploading same file
  });
}

function renderPhotoThumbnails() {
  const previewGrid = document.getElementById('photo-preview-grid');
  if (!previewGrid) return;

  previewGrid.innerHTML = '';
  currentPhotos.forEach((photo, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'photo-thumb-wrap';

    const img = document.createElement('img');
    img.src = photo.dataUrl;
    img.alt = photo.name || 'Ảnh khảo sát';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove-photo';
    removeBtn.innerHTML = '×';
    removeBtn.title = 'Xóa ảnh';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      currentPhotos.splice(index, 1);
      renderPhotoThumbnails();
    });

    wrap.appendChild(img);
    wrap.appendChild(removeBtn);

    // Click to preview large
    wrap.addEventListener('click', () => {
      openImagePreviewModal(photo.dataUrl, photo.name);
    });

    previewGrid.appendChild(wrap);
  });
}

/**
 * Image Viewer Modal
 */
function openImagePreviewModal(dataUrl, title) {
  const modal = document.getElementById('modal-image-preview');
  const modalImg = document.getElementById('preview-modal-img');
  const modalTitle = document.getElementById('preview-modal-title');
  if (!modal || !modalImg) return;

  modalImg.src = dataUrl;
  if (modalTitle) modalTitle.textContent = title || 'Xem ảnh khảo sát';
  modal.classList.add('open');
}

/**
 * Severity Selection logic
 */
export function initSeveritySelector() {
  const cards = document.querySelectorAll('.severity-card');
  cards.forEach((card) => {
    card.addEventListener('click', () => {
      cards.forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });
}

/**
 * Inspection Form Handler
 */
export function initSurveyForm(syncManager) {
  const form = document.getElementById('survey-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const buildingSelect = document.getElementById('field-building');
    const roomInput = document.getElementById('field-room');
    const categorySelect = document.getElementById('field-category');
    const facilityNameInput = document.getElementById('field-facility-name');
    const severityRadio = form.querySelector('input[name="severity"]:checked');
    const descriptionText = document.getElementById('field-description');
    const recommendationText = document.getElementById('field-recommendation');
    const inspectorNameInput = document.getElementById('field-inspector-name');
    const inspectorIdInput = document.getElementById('field-inspector-id');

    // Validation
    if (!buildingSelect.value) {
      showToast('Vui lòng chọn Tòa nhà / Khu vực khảo sát.', 'warning');
      buildingSelect.focus();
      return;
    }
    if (!roomInput.value.trim()) {
      showToast('Vui lòng nhập Phòng / Vị trí cụ thể.', 'warning');
      roomInput.focus();
      return;
    }
    if (!categorySelect.value) {
      showToast('Vui lòng chọn Hạng mục thiết bị.', 'warning');
      categorySelect.focus();
      return;
    }
    if (!facilityNameInput.value.trim()) {
      showToast('Vui lòng nhập Tên thiết bị / CSVC.', 'warning');
      facilityNameInput.focus();
      return;
    }
    if (!descriptionText.value.trim()) {
      showToast('Vui lòng nhập mô tả hiện trạng / hỏng hóc.', 'warning');
      descriptionText.focus();
      return;
    }

    const buildingName = buildingSelect.options[buildingSelect.selectedIndex].text;
    const categoryName = categorySelect.options[categorySelect.selectedIndex].text;

    const record = {
      building: buildingSelect.value,
      buildingName,
      room: roomInput.value.trim(),
      facilityCategory: categorySelect.value,
      facilityCategoryName: categoryName,
      facilityName: facilityNameInput.value.trim(),
      severity: severityRadio ? severityRadio.value : 'warning',
      description: descriptionText.value.trim(),
      recommendation: recommendationText ? recommendationText.value.trim() : '',
      inspectorName: inspectorNameInput.value.trim() || 'Cán bộ khảo sát VKU',
      inspectorId: inspectorIdInput ? inspectorIdInput.value.trim() : '',
      geo: currentGeo || {
        latitude: 15.975260,
        longitude: 108.253170,
        accuracy: 10,
        zoneName: 'Khuôn viên VKU'
      },
      photos: [...currentPhotos],
      syncStatus: 'pending_sync',
      createdAt: new Date().toISOString()
    };

    try {
      const saved = await saveInspection(record);
      showToast(`Đã lưu biên bản [${saved.id}] vào bộ nhớ Offline an toàn!`, 'success', 3500);

      // Save inspector profile for future convenience
      if (record.inspectorName) {
        setSetting('saved_inspector_name', record.inspectorName);
      }
      if (record.inspectorId) {
        setSetting('saved_inspector_id', record.inspectorId);
      }

      // Reset form fields
      roomInput.value = '';
      facilityNameInput.value = '';
      descriptionText.value = '';
      if (recommendationText) recommendationText.value = '';
      currentPhotos = [];
      renderPhotoThumbnails();

      // Trigger sync if online and sync manager available
      if (syncManager && syncManager.isOnline) {
        syncManager.syncPendingData();
      }

      // Update sync count on badge
      updateSyncHeaderBadge();

      // Redirect to list
      window.location.hash = 'surveys-list';
    } catch (err) {
      console.error('Lỗi khi lưu khảo sát:', err);
      showToast(`Lỗi lưu dữ liệu: ${err.message}`, 'error');
    }
  });
}

/**
 * Render Inspections History List with Filters
 */
export async function renderInspectionsList() {
  const container = document.getElementById('inspections-list-container');
  if (!container) return;

  const records = await getAllInspections(currentFilters);

  if (records.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">Không tìm thấy biên bản khảo sát nào</div>
        <div class="empty-desc">
          Chưa có dữ liệu phù hợp với bộ lọc hiện tại hoặc chưa có khảo sát nào được ghi nhận.
        </div>
        <button class="btn btn-primary" onclick="window.location.hash='new-survey'">
          + Tạo khảo sát mới
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  records.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'inspection-card';

    const severityMap = {
      good: { label: 'Bình thường', class: 'good' },
      warning: { label: 'Cần bảo trì', class: 'warning' },
      critical: { label: 'Khẩn cấp', class: 'critical' }
    };
    const sev = severityMap[item.severity] || severityMap.warning;

    const syncPill = item.syncStatus === 'synced'
      ? `<span class="badge-sync synced">✓ Đã đồng bộ</span>`
      : `<span class="badge-sync pending">⏳ Chờ đồng bộ</span>`;

    const photoBadge = item.photos && item.photos.length > 0
      ? `<span style="font-size: 0.75rem; color: var(--vku-gold);">📷 ${item.photos.length} ảnh</span>`
      : '';

    const createdTime = new Date(item.createdAt).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    card.innerHTML = `
      <div class="card-top-row">
        <div class="card-meta-main">
          <span class="card-building-pill">${item.buildingName || item.building}</span>
          <h3 class="card-room-title">${item.room} - ${item.facilityName}</h3>
        </div>
        <div class="card-badges-row">
          <span class="badge-severity ${sev.class}">${sev.label}</span>
          ${syncPill}
        </div>
      </div>

      <div class="card-description">
        <strong>${item.facilityCategoryName || 'Hạng mục'}:</strong> ${item.description}
      </div>

      <div class="card-footer-row">
        <div class="card-inspector-info">
          <span>👤 ${item.inspectorName || 'VKU Inspector'}</span>
          <span>•</span>
          <span>🕒 ${createdTime}</span>
          ${photoBadge ? '<span>•</span> ' + photoBadge : ''}
        </div>

        <div class="card-actions">
          <button class="btn-card-action btn-view-detail" data-id="${item.id}">Xem chi tiết</button>
          <button class="btn-card-action btn-delete-item" data-id="${item.id}" style="color: #F87171;">Xóa</button>
        </div>
      </div>
    `;

    // Bind event listeners
    card.querySelector('.btn-view-detail').addEventListener('click', () => {
      openInspectionDetailModal(item.id);
    });

    card.querySelector('.btn-delete-item').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Bạn có chắc chắn muốn xóa biên bản kiểm tra [${item.id}] không?`)) {
        await deleteInspection(item.id);
        showToast('Đã xóa biên bản kiểm tra.', 'info');
        renderInspectionsList();
        updateSyncHeaderBadge();
      }
    });

    container.appendChild(card);
  });
}

/**
 * Filter Toolbar Event Listeners
 */
export function initFilterToolbar() {
  const searchInput = document.getElementById('filter-search');
  const buildingSelect = document.getElementById('filter-building');
  const severitySelect = document.getElementById('filter-severity');
  const syncSelect = document.getElementById('filter-sync');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentFilters.search = e.target.value;
      renderInspectionsList();
    });
  }

  if (buildingSelect) {
    buildingSelect.addEventListener('change', (e) => {
      currentFilters.building = e.target.value;
      renderInspectionsList();
    });
  }

  if (severitySelect) {
    severitySelect.addEventListener('change', (e) => {
      currentFilters.severity = e.target.value;
      renderInspectionsList();
    });
  }

  if (syncSelect) {
    syncSelect.addEventListener('change', (e) => {
      currentFilters.syncStatus = e.target.value;
      renderInspectionsList();
    });
  }
}

/**
 * Detail Modal Logic
 */
export async function openInspectionDetailModal(id) {
  const record = await getInspectionById(id);
  if (!record) return;

  const modal = document.getElementById('modal-inspection-detail');
  const content = document.getElementById('modal-detail-content');
  if (!modal || !content) return;

  const severityText =
    record.severity === 'critical' ? '🔴 Khẩn cấp / Hỏng hóc nặng' :
    record.severity === 'warning' ? '🟡 Cần bảo trì / sửa chữa' : '🟢 Bình thường / Đạt chuẩn';

  let photosHtml = '';
  if (record.photos && record.photos.length > 0) {
    photosHtml = `
      <div style="margin-top: 16px;">
        <h4 style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 8px;">Hình ảnh thực địa (${record.photos.length} ảnh)</h4>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          ${record.photos.map((p) => `
            <div style="width: 140px; aspect-ratio: 4/3; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2); cursor: pointer;" onclick="window.openImagePreview('${p.dataUrl}', '${record.facilityName}')">
              <img src="${p.dataUrl}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  content.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <span style="font-size: 0.75rem; color: var(--vku-gold); font-weight: bold; text-transform: uppercase;">${record.buildingName || record.building}</span>
          <h2 style="font-size: 1.3rem; color: #FFFFFF; margin-top: 2px;">${record.room} - ${record.facilityName}</h2>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">Mã số: <strong>${record.id}</strong></div>
        </div>
        <span class="badge-severity ${record.severity}">${severityText}</span>
      </div>

      <div style="background: var(--bg-surface); padding: 14px; border-radius: 8px; font-size: 0.88rem; line-height: 1.5;">
        <div style="margin-bottom: 8px;">
          <strong>Hạng mục kiểm định:</strong> ${record.facilityCategoryName || record.facilityCategory}
        </div>
        <div style="margin-bottom: 8px;">
          <strong>Mô tả hiện trạng:</strong> ${record.description}
        </div>
        ${record.recommendation ? `
          <div style="margin-bottom: 8px; color: var(--vku-gold);">
            <strong>Đề xuất giải pháp:</strong> ${record.recommendation}
          </div>
        ` : ''}
        <div>
          <strong>Người thực hiện:</strong> ${record.inspectorName} ${record.inspectorId ? `(MS: ${record.inspectorId})` : ''}
        </div>
      </div>

      <div style="background: var(--bg-input); padding: 12px; border-radius: 8px; font-size: 0.8rem; color: var(--text-muted);">
        <div><strong>📍 Tọa độ GPS:</strong> ${record.geo ? `${record.geo.latitude}, ${record.geo.longitude} (Khu vực: ${record.geo.zoneName})` : 'Chưa có dữ liệu'}</div>
        <div style="margin-top: 4px;"><strong>🕒 Thời gian ghi nhận:</strong> ${new Date(record.createdAt).toLocaleString('vi-VN')}</div>
        <div style="margin-top: 4px;"><strong>☁️ Trạng thái Cloud:</strong> ${record.syncStatus === 'synced' ? `Đã đồng bộ (${new Date(record.syncedAt).toLocaleString('vi-VN')})` : 'Lưu trữ cục bộ Offline (Chờ kết nối mạng)'}</div>
      </div>

      ${photosHtml}
    </div>
  `;

  // Attach print button handler
  const printBtn = document.getElementById('btn-print-inspection');
  if (printBtn) {
    printBtn.onclick = () => {
      window.print();
    };
  }

  modal.classList.add('open');
}

window.openImagePreview = openImagePreviewModal;

/**
 * Statistics Dashboard Renderer
 */
export async function renderDashboardStats() {
  const stats = await getStatistics();

  const totalEl = document.getElementById('stat-total');
  const criticalEl = document.getElementById('stat-critical');
  const pendingEl = document.getElementById('stat-pending');
  const syncedEl = document.getElementById('stat-synced');

  if (totalEl) totalEl.textContent = stats.total;
  if (criticalEl) criticalEl.textContent = stats.critical;
  if (pendingEl) pendingEl.textContent = stats.pendingSync;
  if (syncedEl) syncedEl.textContent = stats.synced;

  // Distribution progress bar
  const progGood = document.getElementById('prog-good');
  const progWarning = document.getElementById('prog-warning');
  const progCritical = document.getElementById('prog-critical');

  if (stats.total > 0) {
    const goodPct = ((stats.good / stats.total) * 100).toFixed(1);
    const warnPct = ((stats.warning / stats.total) * 100).toFixed(1);
    const critPct = ((stats.critical / stats.total) * 100).toFixed(1);

    if (progGood) { progGood.style.width = `${goodPct}%`; progGood.title = `Bình thường: ${goodPct}%`; }
    if (progWarning) { progWarning.style.width = `${warnPct}%`; progWarning.title = `Cần bảo trì: ${warnPct}%`; }
    if (progCritical) { progCritical.style.width = `${critPct}%`; progCritical.title = `Hỏng khẩn cấp: ${critPct}%`; }
  }

  // Building breakdown list
  const breakdownList = document.getElementById('building-breakdown-list');
  if (breakdownList) {
    breakdownList.innerHTML = '';
    const buildingNames = {
      khu_a: 'Khu Giảng đường A',
      khu_v: 'Tòa nhà V - Viện Công nghệ số',
      khu_k: 'Tòa nhà K - Kỹ thuật MT & ĐT',
      thu_vien: 'Thư viện & Không gian Học liệu số',
      ktx_k1: 'Ký túc xá Sinh viên K1/K2',
      san_vd: 'Nhà thi đấu & Sân thể thao',
      hoi_truong: 'Hội trường lớn VKU'
    };

    const entries = Object.entries(stats.byBuilding);
    if (entries.length === 0) {
      breakdownList.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">Chưa có dữ liệu thống kê.</div>';
    } else {
      entries.forEach(([key, count]) => {
        const row = document.createElement('div');
        row.className = 'breakdown-row';
        row.innerHTML = `
          <span class="breakdown-name">${buildingNames[key] || key}</span>
          <span class="breakdown-count">${count} biên bản</span>
        `;
        breakdownList.appendChild(row);
      });
    }
  }
}

/**
 * Header Sync Counter Badge Updater
 */
export async function updateSyncHeaderBadge() {
  const badge = document.getElementById('sync-counter-badge');
  if (!badge) return;

  const stats = await getStatistics();
  badge.textContent = stats.pendingSync;
  badge.style.display = stats.pendingSync > 0 ? 'inline-block' : 'none';
}

/**
 * Export and Data Management Actions
 */
export function initExportHandlers() {
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnSeedData = document.getElementById('btn-seed-data');
  const btnClearData = document.getElementById('btn-clear-data');

  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', async () => {
      try {
        const csvContent = await exportDataCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `VKU_Survey_Export_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        showToast('Đã xuất file báo cáo CSV cho Excel thành công!', 'success');
      } catch (err) {
        showToast(`Lỗi xuất CSV: ${err.message}`, 'error');
      }
    });
  }

  if (btnExportJson) {
    btnExportJson.addEventListener('click', async () => {
      try {
        const jsonContent = await exportDataJSON();
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `VKU_Survey_Export_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        showToast('Đã xuất file cơ sở dữ liệu JSON thành công!', 'success');
      } catch (err) {
        showToast(`Lỗi xuất JSON: ${err.message}`, 'error');
      }
    });
  }

  if (btnSeedData) {
    btnSeedData.addEventListener('click', async () => {
      await seedSampleDataIfEmpty();
      showToast('Đã nạp bộ dữ liệu mẫu khuôn viên VKU!', 'success');
      renderInspectionsList();
      renderDashboardStats();
      updateSyncHeaderBadge();
    });
  }

  if (btnClearData) {
    btnClearData.addEventListener('click', async () => {
      if (confirm('CẢNH BÁO: Thao tác này sẽ xóa toàn bộ dữ liệu khảo sát offline trên thiết bị này. Bạn có chắc chắn?')) {
        const db = await (await import('./db.js')).openDatabase();
        const tx = db.transaction(['inspections', 'audit_logs'], 'readwrite');
        tx.objectStore('inspections').clear();
        tx.objectStore('audit_logs').clear();
        tx.oncomplete = () => {
          showToast('Đã xóa toàn bộ dữ liệu cục bộ.', 'info');
          renderInspectionsList();
          renderDashboardStats();
          updateSyncHeaderBadge();
        };
      }
    });
  }
}

/**
 * Pre-populate saved inspector details in form
 */
export async function loadSavedInspectorProfile() {
  const name = await getSetting('saved_inspector_name');
  const id = await getSetting('saved_inspector_id');

  const nameInput = document.getElementById('field-inspector-name');
  const idInput = document.getElementById('field-inspector-id');

  if (name && nameInput && !nameInput.value) nameInput.value = name;
  if (id && idInput && !idInput.value) idInput.value = id;
}

/**
 * Close modal handlers
 */
export function initModalClosers() {
  document.querySelectorAll('.modal-backdrop').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('open');
      }
    });

    const closeBtn = modal.querySelector('.modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('open');
      });
    }
  });
}
