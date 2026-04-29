import { useLocalSearchParams, Link } from 'expo-router';
import { Linking, StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
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
}

function toCoordinateValue(value: number | string): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeEvent(rawEvent: any): Event | null {
  if (!rawEvent) {
    return null;
  }

  const waypoints = Array.isArray(rawEvent.waypoints)
    ? rawEvent.waypoints
        .map((waypoint: any) => ({
          ...waypoint,
          lat: toCoordinateValue(waypoint.lat),
          lng: toCoordinateValue(waypoint.lng),
        }))
        .filter((waypoint: any) => waypoint.lat !== null && waypoint.lng !== null)
    : [];

  return {
    ...rawEvent,
    waypoints,
  };
}

function buildMapsUrl(event: Event | null): string | null {
  if (!event || event.waypoints.length === 0) {
    return null;
  }

  // Detect if on iOS (Safari or Chrome)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (event.waypoints.length === 1) {
    const waypoint = event.waypoints[0];
    if (isIOS) {
      // Use Apple Maps deep link for iOS
      return `maps://?q=${waypoint.lat},${waypoint.lng}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${waypoint.lat},${waypoint.lng}`;
  }

  const [origin, ...rest] = event.waypoints;
  const destination = rest[rest.length - 1];
  const originName = encodeURIComponent(origin.name);
  const destName = encodeURIComponent(destination.name);

  if (isIOS) {
    // Use Apple Maps deep link for directions on iOS
    // Format: maps://?saddr=SOURCE&daddr=DESTINATION
    return `maps://?saddr=${origin.lat},${origin.lng}&daddr=${destination.lat},${destination.lng}`;
  }

  const middleWaypoints = rest.slice(0, -1).map((waypoint: Waypoint) => `${waypoint.lat},${waypoint.lng}`);
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: 'driving',
  });

  if (middleWaypoints.length > 0) {
    params.set('waypoints', middleWaypoints.join('|'));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function buildMapDocument(event: Event | null): string | null {
  if (!event) {
    return null;
  }

  const routeData = JSON.stringify({
    name: event.name,
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
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body, #map {
        height: 100%;
        margin: 0;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .leaflet-container {
        background: #eef3f8;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      const routeData = ${routeData};
      const colors = {
        start: '#16a34a',
        middle: '#2563eb',
        end: '#dc2626',
      };

      const map = L.map('map', {
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const escapeHtml = (value) =>
        String(value).replace(/[&<>"']/g, (character) => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        }[character]));

      const coordinates = routeData.waypoints.map((waypoint) => [waypoint.lat, waypoint.lng]);

      if (coordinates.length === 0) {
        map.setView([43.169, -85.212], 9);
      } else if (coordinates.length === 1) {
        map.setView(coordinates[0], 13);
      } else {
        map.fitBounds(L.latLngBounds(coordinates).pad(0.2));
      }

      if (coordinates.length > 1) {
        L.polyline(coordinates, {
          color: '#2563eb',
          weight: 4,
          opacity: 0.85,
        }).addTo(map);
      }

      routeData.waypoints.forEach((waypoint, index) => {
        const isStart = index === 0;
        const isEnd = index === routeData.waypoints.length - 1;
        const color = isStart ? colors.start : isEnd ? colors.end : colors.middle;

        const markerIcon = L.divIcon({
          html: '<div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background-color: ' + color + '; border-radius: 50%; font-weight: bold; color: white; font-size: 14px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">' + waypoint.order + '</div>',
          iconSize: [32, 32],
          className: 'custom-marker'
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

  useEffect(() => {
    const loadEvent = async () => {
      try {
        console.log('Loading event:', eventId);
        const response = await fetch(`${API_URL}/events/${eventId}`);
        const data = await response.json();
        console.log('Event loaded:', data);
        setEvent(normalizeEvent(data));
      } catch (error) {
        console.error('Error loading event:', error);
      }
    };
    loadEvent();
  }, [eventId]);

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
      <View style={styles.headerCard}>
        <Text style={styles.title}>{event.name}</Text>
      </View>

      <View style={styles.mapCard}>
        {mapDocument && (
          <iframe
            title={`${event.name} route map`}
            srcDoc={mapDocument}
            style={iframeStyle}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </View>

      <View style={styles.footer}>
        {mapsUrl && (
          <TouchableOpacity style={styles.button} onPress={() => Linking.openURL(mapsUrl)}>
            <Text style={styles.buttonText}>Open Route in Google Maps</Text>
          </TouchableOpacity>
        )}
        <Link href="/" dismissTo asChild>
          <TouchableOpacity style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const iframeStyle = {
  border: '0',
  width: '100%',
  height: '100%',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    flexDirection: 'column',
  },
  headerCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  dateTime: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  timeInfo: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  meetingPoint: {
    fontSize: 13,
    color: '#007AFF',
    marginBottom: 4,
    marginTop: 4,
  },
  description: {
    fontSize: 12,
    color: '#666',
    marginBottom: 0,
    marginTop: 4,
  },
  mapCard: {
    flex: 1,
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: 0,
    backgroundColor: '#eef3f8',
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
});
