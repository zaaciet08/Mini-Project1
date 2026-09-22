/**
 * sync.js - Offline-First Sync & Connectivity Management
 * Monitors real-time network states, manages the pending inspection queue,
 * and handles background or on-demand cloud synchronization.
 */

import { getPendingSyncInspections, markAsSynced } from './db.js';

export class SyncManager {
  constructor(options = {}) {
    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    this.listeners = new Set();
    this.autoSyncEnabled = options.autoSync !== false;
    this.init();
  }

  init() {
    window.addEventListener('online', () => this.handleConnectionChange(true));
    window.addEventListener('offline', () => this.handleConnectionChange(false));

    // Listen for Service Worker background sync messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TRIGGER_BACKGROUND_SYNC') {
          console.log('[Sync] Received SW background sync trigger');
          this.syncPendingData();
        }
      });
    }
  }

  /**
   * Subscribe to network and sync state changes
   */
  subscribe(callback) {
    this.listeners.add(callback);
    // Send immediate initial state
    callback({
      isOnline: this.isOnline,
      isSyncing: this.isSyncing
    });
    return () => this.listeners.delete(callback);
  }

  notify(extraData = {}) {
    for (const listener of this.listeners) {
      listener({
        isOnline: this.isOnline,
        isSyncing: this.isSyncing,
        ...extraData
      });
    }
  }

  async handleConnectionChange(onlineStatus) {
    this.isOnline = onlineStatus;
    console.log(`[Sync] Network status changed: ${onlineStatus ? 'ONLINE' : 'OFFLINE'}`);

    this.notify({ statusChanged: true });

    if (onlineStatus && this.autoSyncEnabled) {
      console.log('[Sync] Connection restored. Auto-syncing pending survey records...');
      // Wait a small delay to ensure connection stability
      setTimeout(() => {
        this.syncPendingData();
      }, 1500);
    }
  }

  /**
   * Request Service Worker background sync registration if available
   */
  async requestBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.sync.register('sync-inspections');
        console.log('[Sync] Background sync registered with Service Worker');
      } catch (err) {
        console.warn('[Sync] Background sync registration failed or unsupported:', err);
      }
    }
  }

  /**
   * Process all pending records in IndexedDB and synchronize to cloud
   */
  async syncPendingData() {
    if (this.isSyncing) {
      console.log('[Sync] Synchronization already in progress. Skipping.');
      return { success: false, reason: 'ALREADY_SYNCING' };
    }

    if (!this.isOnline) {
      console.warn('[Sync] Cannot sync while offline.');
      return { success: false, reason: 'OFFLINE' };
    }

    this.isSyncing = true;
    this.notify({ type: 'SYNC_STARTED' });

    try {
      const pendingItems = await getPendingSyncInspections();
      console.log(`[Sync] Found ${pendingItems.length} records pending synchronization.`);

      if (pendingItems.length === 0) {
        this.isSyncing = false;
        this.notify({ type: 'SYNC_EMPTY', count: 0 });
        return { success: true, count: 0 };
      }

      let syncedCount = 0;
      for (const item of pendingItems) {
        // Simulate remote server POST /api/inspections/sync with latency
        await this.simulateCloudUpload(item);

        const remoteId = 'CLOUD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        await markAsSynced(item.id, remoteId);
        syncedCount++;
        this.notify({ type: 'SYNC_PROGRESS', syncedCount, total: pendingItems.length });
      }

      console.log(`[Sync] Successfully synced ${syncedCount} records to VKU Cloud.`);
      this.isSyncing = false;
      this.notify({ type: 'SYNC_COMPLETED', count: syncedCount });

      return { success: true, count: syncedCount };
    } catch (err) {
      console.error('[Sync] Error during synchronization:', err);
      this.isSyncing = false;
      this.notify({ type: 'SYNC_FAILED', error: err.message });
      return { success: false, error: err.message };
    }
  }

  /**
   * Mock Cloud Upload with simulated realistic network delay
   */
  simulateCloudUpload(record) {
    return new Promise((resolve) => {
      // Simulate realistic server processing delay (400ms - 800ms)
      const delay = Math.floor(Math.random() * 400) + 400;
      setTimeout(() => {
        resolve({
          status: 'SUCCESS',
          serverTimestamp: new Date().toISOString(),
          recordId: record.id
        });
      }, delay);
    });
  }
}
