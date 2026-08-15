import { useEffect, useRef } from 'react';

interface MapMarker {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

interface LiveMapProps {
  pickup?: MapMarker;
  drop?: MapMarker;
  driver?: MapMarker;
  height?: string;
  className?: string;
}

/**
 * Lightweight interactive map using Leaflet (loaded via CDN).
 * No API key required.
 */
export function LiveMap({ pickup, drop, driver, height = '220px', className = '' }: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    // Dynamically inject Leaflet CSS once
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Dynamically load Leaflet JS
    function initMap(L: any) {
      if (!containerRef.current || mapRef.current) return;

      const centerLat = pickup?.lat ?? driver?.lat ?? 19.076;
      const centerLng = pickup?.lng ?? driver?.lng ?? 72.8777;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: false,
      }).setView([centerLat, centerLng], 10);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);

      mapRef.current = map;
      renderMarkers(L);
    }

    function renderMarkers(L: any) {
      const map = mapRef.current;
      if (!map) return;

      // Clear existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const bounds: [number, number][] = [];

      function addMarker(lat: number, lng: number, color: string, label: string) {
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            background:${color};
            width:14px;height:14px;
            border-radius:50%;
            border:3px solid #fff;
            box-shadow:0 2px 8px rgba(0,0,0,.35);
          " title="${label}"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const marker = L.marker([lat, lng], { icon })
          .addTo(map)
          .bindPopup(`<strong>${label}</strong>`);
        markersRef.current.push(marker);
        bounds.push([lat, lng]);
      }

      if (pickup) addMarker(pickup.lat, pickup.lng, '#28766a', pickup.label ?? 'Pickup');
      if (drop) addMarker(drop.lat, drop.lng, '#d6523d', drop.label ?? 'Drop-off');
      if (driver) {
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            background:#1e3a4f;
            width:18px;height:18px;
            border-radius:50%;
            border:3px solid #f3a51b;
            box-shadow:0 2px 12px rgba(0,0,0,.45);
            animation:pulse 1.8s ease-in-out infinite;
          " title="Driver"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const marker = L.marker([driver.lat, driver.lng], { icon })
          .addTo(map)
          .bindPopup('<strong>Driver</strong>');
        markersRef.current.push(marker);
        bounds.push([driver.lat, driver.lng]);
      }

      if (bounds.length >= 2) {
        try { map.fitBounds(bounds, { padding: [36, 36] }); } catch { /* ok */ }
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 12);
      }

      // Draw route line between pickup and drop
      if (pickup && drop) {
        const line = L.polyline(
          [[pickup.lat, pickup.lng], [drop.lat, drop.lng]],
          { color: '#f3a51b', weight: 3, dashArray: '8 6', opacity: 0.8 }
        ).addTo(map);
        markersRef.current.push(line);
      }
    }

    if ((window as any).L) {
      initMap((window as any).L);
    } else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => initMap((window as any).L);
      document.head.appendChild(script);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Only init once

  // Update markers when driver position changes
  useEffect(() => {
    if (!mapRef.current || !(window as any).L) return;
    const L = (window as any).L;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds: [number, number][] = [];

    function addMarker(lat: number, lng: number, color: string, label: string) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);" title="${label}"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const marker = L.marker([lat, lng], { icon }).addTo(mapRef.current).bindPopup(`<strong>${label}</strong>`);
      markersRef.current.push(marker);
      bounds.push([lat, lng]);
    }

    if (pickup) addMarker(pickup.lat, pickup.lng, '#28766a', pickup.label ?? 'Pickup');
    if (drop) addMarker(drop.lat, drop.lng, '#d6523d', drop.label ?? 'Drop-off');
    if (driver) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#1e3a4f;width:18px;height:18px;border-radius:50%;border:3px solid #f3a51b;box-shadow:0 2px 12px rgba(0,0,0,.45);" title="Driver"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const marker = L.marker([driver.lat, driver.lng], { icon }).addTo(mapRef.current).bindPopup('<strong>Driver</strong>');
      markersRef.current.push(marker);
      bounds.push([driver.lat, driver.lng]);
    }

    if (pickup && drop) {
      const line = L.polyline(
        [[pickup.lat, pickup.lng], [drop.lat, drop.lng]],
        { color: '#f3a51b', weight: 3, dashArray: '8 6', opacity: 0.8 }
      ).addTo(mapRef.current);
      markersRef.current.push(line);
    }
  }, [pickup?.lat, pickup?.lng, drop?.lat, drop?.lng, driver?.lat, driver?.lng]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, width: '100%', background: '#dde8e4' }}
    />
  );
}
