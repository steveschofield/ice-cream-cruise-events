import { useLocalSearchParams, Link } from 'expo-router';
import { Linking, StyleSheet, View, Text, TouchableOpacity, Vibration } from 'react-native';
import { WebView } from 'react-native-webview';
import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { API_URL } from '../config';

interface Waypoint {
  id: number;
  lat: number;
  lng: number;
  name: string;
  notes?: string;
  order?: number;
}

interface Event {
  id: number;
  name: string;
  date: string;
  eventTime: string;
  cruiseStartTime: string;
  meetingPoint: string;
  description: string;
  waypoints: Waypoint[];
  defaultLat?: number | null;
  defaultLng?: number | null;
}

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: number;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toCoordinateValue(value: number | string): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeEvent(rawEvent: any): Event | null {
  if (!rawEvent) return null;
  const waypoints = Array.isArray(rawEvent.waypoints)
    ? rawEvent.waypoints
        .map((waypoint: any) => ({
          ...waypoint,
          lat: toCoordinateValue(waypoint.lat),
          lng: toCoordinateValue(waypoint.lng),
        }))
        .filter((waypoint: any) => waypoint.lat !== null && waypoint.lng !== null)
    : [];
  return { ...rawEvent, waypoints };
}

function buildMapsUrl(event: Event | null): string | null {
  if (!event || event.waypoints.length === 0) return null;

  if (event.waypoints.length === 1) {
    const wp = event.waypoints[0];
    return `https://www.google.com/maps/search/?api=1&query=${wp.lat},${wp.lng}`;
  }

  const [origin, ...rest] = event.waypoints;
  const destination = rest[rest.length - 1];
  const middleWaypoints = rest.slice(0, -1);

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
  if (middleWaypoints.length > 0) {
    url += `&waypoints=${middleWaypoints.map(wp => `${wp.lat},${wp.lng}`).join('|')}`;
  }
  return url;
}

function buildMapDocument(event: Event | null): string | null {
  if (!event) return null;

  const routeData = JSON.stringify({
    name: event.name,
    defaultLat: event.defaultLat ?? null,
    defaultLng: event.defaultLng ?? null,
    waypoints: event.waypoints.map((waypoint) => ({
      name: waypoint.name,
      lat: waypoint.lat,
      lng: waypoint.lng,
      order: waypoint.order,
    })),
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
    <style>
      html, body, #map { height: 100%; margin: 0; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .leaflet-container { background: #eef3f8; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <script>
      const routeData = ${routeData};
      const colors = { start: '#16a34a', middle: '#2563eb', end: '#dc2626' };
      const map = L.map('map', { zoomControl: true, attributionControl: true });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const escapeHtml = (value) =>
        String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

      const coordinates = routeData.waypoints.map((wp) => [wp.lat, wp.lng]);

      if (coordinates.length === 0) {
        map.setView([routeData.defaultLat || 0, routeData.defaultLng || 0], coordinates.length === 0 ? 2 : 9);
      } else if (coordinates.length === 1) {
        map.setView(coordinates[0], 13);
      } else {
        map.fitBounds(L.latLngBounds(coordinates).pad(0.2));
      }

      if (coordinates.length > 1) {
        L.polyline(coordinates, { color: '#2563eb', weight: 4, opacity: 0.85 }).addTo(map);
      }

      routeData.waypoints.forEach((waypoint, index) => {
        const isStart = index === 0;
        const isEnd = index === routeData.waypoints.length - 1;
        const color = isStart ? colors.start : isEnd ? colors.end : colors.middle;
        const markerIcon = L.divIcon({
          html: '<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:' + color + ';border-radius:50%;font-weight:bold;color:white;font-size:14px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);">' + waypoint.order + '</div>',
          iconSize: [32, 32], className: 'custom-marker'
        });
        L.marker([waypoint.lat, waypoint.lng], { icon: markerIcon })
          .addTo(map)
          .bindPopup('<strong>' + escapeHtml(waypoint.order + '. ' + waypoint.name) + '</strong>');
      });
    </script>
  </body>
</html>`;
}

export default function ModalScreen() {
  const { eventId } = useLocalSearchParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [cruiseStarted, setCruiseStarted] = useState(false);
  const [cruisePaused, setCruisePaused] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
  const [completedWaypoints, setCompletedWaypoints] = useState(new Set<number>());
  const [nextWaypointIndex, setNextWaypointIndex] = useState(0);
  const [distanceToNext, setDistanceToNext] = useState<number | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [alertedWaypoints, setAlertedWaypoints] = useState(new Set<number>());
  const lastLocationRef = useRef<LocationData | null>(null);

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const response = await fetch(`${API_URL}/events/${eventId}`);
        const data = await response.json();
        setEvent(normalizeEvent(data));
      } catch (error) {
        console.error('Error loading event:', error);
      }
    };
    loadEvent();
  }, [eventId]);

  useEffect(() => {
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [locationSubscription]);

  const startCruise = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access location was denied');
      return;
    }

    await activateKeepAwakeAsync();
    setCruiseStarted(true);

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 10,
      },
      (location) => {
        const newCoord = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setCurrentLocation({ ...newCoord, timestamp: location.timestamp });

        if (lastLocationRef.current) {
          const distKm = haversineKm(
            lastLocationRef.current.latitude, lastLocationRef.current.longitude,
            newCoord.latitude, newCoord.longitude
          );
          const elapsedHours = (location.timestamp - lastLocationRef.current.timestamp) / 3600000;
          const speedKmh = elapsedHours > 0 ? distKm / elapsedHours : 0;
          setCurrentSpeed(Math.max(0, Math.round(speedKmh)));
        }
        lastLocationRef.current = { ...newCoord, timestamp: location.timestamp };

        if (event && event.waypoints.length > 0) {
          const completed = new Set<number>();
          let nextIdx = 0;
          let closestDist = Infinity;

          event.waypoints.forEach((wp, idx) => {
            const dist = haversineKm(newCoord.latitude, newCoord.longitude, wp.lat, wp.lng);
            if (dist < 0.3) {
              completed.add(wp.id);
            }
            if (dist < closestDist) {
              closestDist = dist;
              nextIdx = idx;
            }
          });

          setCompletedWaypoints(completed);
          setNextWaypointIndex(nextIdx);

          const nextWp = event.waypoints[nextIdx];
          const kmToNext = Number(haversineKm(newCoord.latitude, newCoord.longitude, nextWp.lat, nextWp.lng).toFixed(1));
          setDistanceToNext(kmToNext);

          if (kmToNext < 1 && !alertedWaypoints.has(nextWp.id)) {
            Vibration.vibrate([0, 500, 100, 500]);
            setAlertedWaypoints(new Set([...alertedWaypoints, nextWp.id]));
          }
        }
      }
    );

    setLocationSubscription(subscription);
  };

  const pauseCruise = () => setCruisePaused(true);
  const resumeCruise = () => setCruisePaused(false);

  const stopCruise = async () => {
    if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
    }
    await deactivateKeepAwake();
    setCruiseStarted(false);
    setCruisePaused(false);
    setCurrentLocation(null);
    setDistanceToNext(null);
    setCurrentSpeed(0);
    setAlertedWaypoints(new Set());
    lastLocationRef.current = null;
  };

  if (!event) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Event not found</Text>
        <Link href="/" asChild>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Back to home</Text>
          </TouchableOpacity>
        </Link>
      </View>
    );
  }

  const mapsUrl = buildMapsUrl(event);
  const mapDocument = buildMapDocument(event);

  return (
    <View style={styles.container}>
      <View style={styles.titleBar}>
        <View style={styles.titleContent}>
          <Text style={styles.modalTitle}>{event.name}</Text>
          {cruiseStarted && nextWaypointIndex < event.waypoints.length && (
            <Text style={styles.nextWaypointText}>{event.waypoints[nextWaypointIndex].name}</Text>
          )}
          {cruiseStarted && (
            <View style={styles.statsRow}>
              <Text style={styles.statText}>⚡ {currentSpeed} km/h</Text>
              <Text style={styles.statText}>📍 {distanceToNext} km</Text>
            </View>
          )}
        </View>
        {cruiseStarted && <Text style={styles.statusText}>{cruisePaused ? '⏸️ Paused' : '🔴 Live'}</Text>}
      </View>

      <View style={styles.mapCard}>
        {mapDocument && (
          <WebView
            source={{ html: mapDocument }}
            style={{ flex: 1 }}
            originWhitelist={['*']}
            javaScriptEnabled
          />
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.buttonRow}>
          {!cruiseStarted ? (
            <TouchableOpacity style={styles.button} onPress={startCruise}>
              <Text style={styles.buttonText}>Start Cruise</Text>
            </TouchableOpacity>
          ) : (
            <>
              {!cruisePaused ? (
                <TouchableOpacity style={[styles.button, styles.pauseButton]} onPress={pauseCruise}>
                  <Text style={styles.buttonText}>Pause</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.button, styles.resumeButton]} onPress={resumeCruise}>
                  <Text style={styles.buttonText}>Resume</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={stopCruise}>
                <Text style={styles.buttonText}>Stop</Text>
              </TouchableOpacity>
            </>
          )}
          {mapsUrl && (
            <TouchableOpacity style={[styles.button, styles.mapsButton]} onPress={() => Linking.openURL(mapsUrl)}>
              <Text style={styles.buttonText}>Google Maps</Text>
            </TouchableOpacity>
          )}
        </View>
        <Link href="/" dismissTo asChild>
          <TouchableOpacity style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', flexDirection: 'column' },
  titleBar: {
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#f5f5f5', borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  titleContent: { flex: 1 },
  modalTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  nextWaypointText: { fontSize: 16, fontWeight: '700', color: '#007AFF', marginTop: 4 },
  statsRow: { flexDirection: 'row', marginTop: 6, gap: 12 },
  statText: { fontSize: 12, color: '#555', fontWeight: '500' },
  statusText: { fontSize: 14, color: '#FF3B30', fontWeight: '600' },
  mapCard: { flex: 1, overflow: 'hidden', backgroundColor: '#eef3f8' },
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  buttonRow: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  button: { flex: 1, backgroundColor: '#007AFF', padding: 12, borderRadius: 6, alignItems: 'center' },
  pauseButton: { backgroundColor: '#FF9500' },
  resumeButton: { backgroundColor: '#34C759' },
  stopButton: { backgroundColor: '#FF3B30' },
  mapsButton: { backgroundColor: '#5856D6' },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  closeButton: { paddingVertical: 10, alignItems: 'center' },
  closeButtonText: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  errorText: { fontSize: 16, color: '#666', marginBottom: 16 },
});
