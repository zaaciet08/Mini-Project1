/**
 * geo.js - Geolocation and VKU Campus Zone Mapper
 * Works offline using cached zone coordinates and HTML5 Geolocation API.
 */

// Known VKU Campus Landmark Coordinates (470 Tran Dai Nghia, Ngu Hanh Son, Da Nang)
export const VKU_LANDMARKS = [
  {
    id: 'khu_a',
    name: 'Khu Giảng đường A (Hành chính & Lý thuyết)',
    lat: 15.975412,
    lng: 108.252631,
    radius: 70
  },
  {
    id: 'khu_v',
    name: 'Tòa nhà V - Viện Khoa học & Công nghệ số',
    lat: 15.976105,
    lng: 108.251940,
    radius: 70
  },
  {
    id: 'khu_k',
    name: 'Tòa nhà K - Khoa Kỹ thuật Máy tính & Điện tử',
    lat: 15.976800,
    lng: 108.252300,
    radius: 65
  },
  {
    id: 'thu_vien',
    name: 'Trung tâm Học liệu & Thư viện số VKU',
    lat: 15.975780,
    lng: 108.253010,
    radius: 60
  },
  {
    id: 'ktx_k1',
    name: 'Khu Ký túc xá Sinh viên K1 & K2',
    lat: 15.974890,
    lng: 108.254120,
    radius: 100
  },
  {
    id: 'san_vd',
    name: 'Nhà thi đấu thể thao đa năng & Sân vận động',
    lat: 15.977200,
    lng: 108.254600,
    radius: 120
  },
  {
    id: 'hoi_truong',
    name: 'Hội trường lớn & Khu dịch vụ sinh viên',
    lat: 15.975100,
    lng: 108.252000,
    radius: 60
  }
];

// Default VKU Center Coordinates
export const VKU_DEFAULT_LOCATION = {
  latitude: 15.975260,
  longitude: 108.253170,
  accuracy: 10,
  zoneName: 'Khuôn viên VKU (Trường Đại học CNTT & TT Việt - Hàn)'
};

/**
 * Calculate distance in meters between two lat/lng coordinates (Haversine formula)
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Detect closest VKU campus zone based on latitude and longitude
 */
export function detectClosestVKUZone(lat, lng) {
  let closest = null;
  let minDistance = Infinity;

  for (const landmark of VKU_LANDMARKS) {
    const dist = calculateDistance(lat, lng, landmark.lat, landmark.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closest = { ...landmark, distanceMeters: dist };
    }
  }

  if (closest && closest.distanceMeters <= 200) {
    return `${closest.name} (~${closest.distanceMeters}m)`;
  }
  return `Khuôn viên VKU (Cách ${closest ? closest.name : 'tâm trường'} ~${closest ? closest.distanceMeters : 0}m)`;
}

/**
 * Get current device GPS coordinates with timeout and offline-friendly error recovery
 */
export function getCurrentCoordinates(timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('[Geo] Geolocation not supported by browser.');
      return resolve({
        ...VKU_DEFAULT_LOCATION,
        isFallback: true,
        reason: 'Thiết bị không hỗ trợ Geolocation API'
      });
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy || 10);
        const zoneName = detectClosestVKUZone(lat, lng);

        resolve({
          latitude: lat,
          longitude: lng,
          accuracy,
          zoneName,
          timestamp: new Date().toISOString(),
          isFallback: false
        });
      },
      (err) => {
        console.warn('[Geo] Geolocation error or timeout, applying VKU fallback:', err.message);
        resolve({
          ...VKU_DEFAULT_LOCATION,
          timestamp: new Date().toISOString(),
          isFallback: true,
          reason: err.code === 1 ? 'Quyền truy cập vị trí bị từ chối' : 'Không bắt được tín hiệu vệ tinh (trong phòng kín)'
        });
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 30000
      }
    );
  });
}
