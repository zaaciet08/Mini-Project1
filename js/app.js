/**
 * app.js - Main Application Orchestrator for VKU Field Survey PWA
 * Coordinates Service Worker lifecycle, IndexedDB persistence,
 * Sync Manager, and UI components.
 */

import { openDatabase, seedSampleDataIfEmpty } from './db.js';
import { SyncManager } from './sync.js';
import {
  initNavigation,
  initGeolocationWidget,
  initPhotoCaptureWidget,
  initSeveritySelector,
  initSurveyForm,
  initFilterToolbar,
  initExportHandlers,
  initModalClosers,
  loadSavedInspectorProfile,
  updateSyncHeaderBadge,
  showToast
} from './ui.js';

let deferredInstallPrompt = null;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[App] Bootstrapping VKU Field Survey PWA...');

  // 1. Initialize IndexedDB
  try {
    await openDatabase();
    await seedSampleDataIfEmpty();
  } catch (err) {
    console.error('[App] Database initialization failed:', err);
    showToast('Lỗi khởi tạo cơ sở dữ liệu IndexedDB: ' + err.message, 'error');
  }

  // 2. Initialize Sync Manager
  const syncManager = new SyncManager({ autoSync: true });

  // 3. Register Service Worker for Offline-First PWA
  registerServiceWorker(syncManager);

  // 4. Bind Network & Sync Status UI
  setupNetworkAndSyncUI(syncManager);

  // 5. Initialize UI Modules
  initNavigation();
  initGeolocationWidget();
  initPhotoCaptureWidget();
  initSeveritySelector();
  initSurveyForm(syncManager);
  initFilterToolbar();
  initExportHandlers();
  initModalClosers();
  loadSavedInspectorProfile();
  updateSyncHeaderBadge();

  // 6. Setup PWA Install Prompt
  setupPWAInstallation();
});

/**
 * Register Service Worker
 */
function registerServiceWorker(syncManager) {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service Worker is not supported in this browser.');
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      console.log('[SW] Registered successfully with scope:', registration.scope);

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW] New version available! Prompting user.');
            showToast('Phiên bản mới đã sẵn sàng! Đang cập nhật ứng dụng...', 'info', 4000);
          }
        });
      });
    } catch (err) {
      console.error('[SW] Service Worker registration failed:', err);
    }
  });
}

/**
 * Connect Sync Manager events to UI elements
 */
function setupNetworkAndSyncUI(syncManager) {
  const statusPill = document.getElementById('connection-status-pill');
  const statusText = document.getElementById('status-text');
  const offlineBanner = document.getElementById('offline-banner');
  const btnHeaderSync = document.getElementById('btn-header-sync');

  // Network State Listener
  syncManager.subscribe((state) => {
    if (statusPill && statusText) {
      if (state.isOnline) {
        statusPill.className = 'status-pill online';
        statusText.textContent = 'Trực tuyến (Online)';
      } else {
        statusPill.className = 'status-pill offline';
        statusText.textContent = 'Ngoại tuyến (Offline)';
      }
    }

    if (offlineBanner) {
      offlineBanner.classList.toggle('visible', !state.isOnline);
    }

    // Sync Event handling
    if (state.type === 'SYNC_STARTED') {
      if (btnHeaderSync) {
        btnHeaderSync.disabled = true;
        btnHeaderSync.innerHTML = `<span>🔄</span> <span>Đang đồng bộ...</span>`;
      }
      showToast('Đang tiến hành đồng bộ dữ liệu lên VKU Cloud...', 'info', 2000);
    } else if (state.type === 'SYNC_COMPLETED') {
      if (btnHeaderSync) {
        btnHeaderSync.disabled = false;
        btnHeaderSync.innerHTML = `<span>☁️</span> <span>Đồng bộ</span> <span id="sync-counter-badge" class="sync-badge-counter" style="display:none;">0</span>`;
      }
      updateSyncHeaderBadge();
      showToast(`Đã đồng bộ thành công ${state.count} biên bản lên Cloud!`, 'success', 3000);
    } else if (state.type === 'SYNC_EMPTY') {
      if (btnHeaderSync) {
        btnHeaderSync.disabled = false;
        btnHeaderSync.innerHTML = `<span>☁️</span> <span>Đồng bộ</span> <span id="sync-counter-badge" class="sync-badge-counter" style="display:none;">0</span>`;
      }
    } else if (state.type === 'SYNC_FAILED') {
      if (btnHeaderSync) {
        btnHeaderSync.disabled = false;
        btnHeaderSync.innerHTML = `<span>☁️</span> <span>Đồng bộ</span> <span id="sync-counter-badge" class="sync-badge-counter" style="display:none;">0</span>`;
      }
      showToast(`Lỗi đồng bộ: ${state.error}`, 'error', 3000);
    }
  });

  // Manual Header Sync Button Click
  if (btnHeaderSync) {
    btnHeaderSync.addEventListener('click', async () => {
      if (!syncManager.isOnline) {
        showToast('Thiết bị đang ngắt kết nối mạng. Dữ liệu tiếp tục được bảo vệ an toàn trên IndexedDB.', 'warning', 3500);
        return;
      }
      const res = await syncManager.syncPendingData();
      if (res.count === 0) {
        showToast('Tất cả biên bản khảo sát đã được đồng bộ mới nhất!', 'success');
      }
    });
  }
}

/**
 * Handle PWA BeforeInstallPrompt for installation banner
 */
function setupPWAInstallation() {
  const installBanner = document.getElementById('install-pwa-banner');
  const installBtn = document.getElementById('btn-install-pwa');

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent mini-infobar on mobile
    e.preventDefault();
    deferredInstallPrompt = e;

    if (installBanner) {
      installBanner.classList.add('visible');
    }
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;

      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      console.log(`[PWA] User response to install prompt: ${outcome}`);

      if (outcome === 'accepted') {
        showToast('Cảm ơn bạn đã cài đặt ứng dụng VKU Field Survey!', 'success');
      }
      deferredInstallPrompt = null;
      if (installBanner) {
        installBanner.classList.remove('visible');
      }
    });
  }

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] VKU Field Survey PWA was installed successfully.');
    if (installBanner) {
      installBanner.classList.remove('visible');
    }
    showToast('Ứng dụng đã được cài đặt vào màn hình chính!', 'success');
  });
}
