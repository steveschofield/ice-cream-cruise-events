import { useLocalSearchParams, Link } from 'expo-router';
import { Linking, StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { API_URL } from '../config';

interface Waypoint {
  id: number;
  lat: number | null;
  lng: number | null;
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

  if (event.waypoints.length === 1) {
    const waypoint = event.waypoints[0];
    return `https://www.google.com/maps/search/?api=1&query=${waypoint.lat},${waypoint.lng}`;
  }

  const [origin, ...rest] = event.waypoints;
  const destination = rest[rest.length - 1];
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

        L.circleMarker([waypoint.lat, waypoint.lng], {
          radius: 8,
          color,
          fillColor: color,
          fillOpacity: 1,
          weight: 2,
        })
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
      <ScrollView style={styles.detailsContainer}>
        <Text style={styles.title}>{event.name}</Text>
        <Text style={styles.dateTime}>{event.date}</Text>
        <Text style={styles.timeInfo}>Event Start: {event.eventTime}</Text>
        <Text style={styles.timeInfo}>Cruise Start: {event.cruiseStartTime}</Text>
        <Text style={styles.meetingPoint}>Meeting Point: {event.meetingPoint}</Text>
        <Text style={styles.description}>{event.description}</Text>

        <Text style={styles.sectionTitle}>Route Map</Text>
        <View style={styles.mapCard}>
          <iframe
            title={`${event.name} route map`}
            srcDoc={mapDocument}
            style={iframeStyle}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </View>

        {mapsUrl && (
          <TouchableOpacity style={styles.button} onPress={() => Linking.openURL(mapsUrl)}>
            <Text style={styles.buttonText}>Open Route in Google Maps</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.waypointsTitle}>Route Waypoints</Text>
        {event.waypoints && event.waypoints.map((wp) => (
          <Text key={wp.id} style={styles.waypointItem}>
            {wp.order}. {wp.name} ({wp.lat.toFixed(4)}, {wp.lng.toFixed(4)})
          </Text>
        ))}
      </ScrollView>

      <View style={styles.footer}>
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
  },
  detailsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  dateTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  timeInfo: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  meetingPoint: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  mapCard: {
    height: 360,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    backgroundColor: '#eef3f8',
    marginBottom: 16,
  },
  waypointsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  waypointItem: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    paddingLeft: 8,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
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
    paddingVertical: 12,
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
