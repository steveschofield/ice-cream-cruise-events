import { useLocalSearchParams, Link } from 'expo-router';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { API_URL } from '../config';

function toCoordinateValue(value) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeEvent(rawEvent) {
  if (!rawEvent) {
    return null;
  }

  const waypoints = Array.isArray(rawEvent.waypoints)
    ? rawEvent.waypoints
        .map((waypoint) => ({
          ...waypoint,
          lat: toCoordinateValue(waypoint.lat),
          lng: toCoordinateValue(waypoint.lng),
        }))
        .filter((waypoint) => waypoint.lat !== null && waypoint.lng !== null)
    : [];

  return {
    ...rawEvent,
    waypoints,
  };
}

export default function ModalScreen() {
  const { eventId } = useLocalSearchParams();
  const mapRef = useRef(null);

  const [cruiseStarted, setCruiseStarted] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [event, setEvent] = useState(null);

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

  useEffect(() => {
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [locationSubscription]);

  useEffect(() => {
    if (event && event.waypoints.length > 0 && mapRef.current) {
      console.log('Animating to waypoint:', event.waypoints[0]);
      mapRef.current.animateToRegion({
        latitude: event.waypoints[0].lat,
        longitude: event.waypoints[0].lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    }
  }, [event]);

  const startCruise = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access location was denied');
      return;
    }

    setCruiseStarted(true);

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 10,
      },
      (location) => {
        console.log('Location update:', location.coords.latitude, location.coords.longitude);
        const newCoord = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setCurrentLocation(newCoord);

        mapRef.current?.animateToRegion({
          ...newCoord,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      }
    );

    setLocationSubscription(subscription);
  };

  const stopCruise = () => {
    if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
    }
    setCruiseStarted(false);
    setCurrentLocation(null);
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

  const routeCoordinates = event.waypoints.map((wp) => ({
    latitude: wp.lat,
    longitude: wp.lng,
  }));

  return (
    <View style={styles.container}>
      <ScrollView style={styles.detailsContainer} scrollEnabled={false}>
        <Text style={styles.title}>{event.name}</Text>
        <Text style={styles.dateTime}>{event.date}</Text>
        <Text style={styles.timeInfo}>🕖 Event Start: {event.eventTime}</Text>
        <Text style={styles.timeInfo}>🚗 Cruise Start: {event.cruiseStartTime}</Text>
        <Text style={styles.meetingPoint}>📍 {event.meetingPoint}</Text>
        {cruiseStarted && <Text style={styles.statusText}>🔴 Cruise in progress</Text>}
      </ScrollView>

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: 43.169,
          longitude: -85.212,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {event.waypoints.map((waypoint) => (
          <Marker
            key={waypoint.id}
            coordinate={{
              latitude: waypoint.lat,
              longitude: waypoint.lng,
            }}
            title={waypoint.name}
            pinColor={waypoint.order === 1 ? '#34C759' : waypoint.order === event.waypoints.length ? '#FF3B30' : '#007AFF'}
          />
        ))}
        <Polyline coordinates={routeCoordinates} strokeColor="#007AFF" strokeWidth={3} />

        {currentLocation && (
          <Marker
            coordinate={currentLocation}
            title="You"
            pinColor="#5AC8FA"
          />
        )}
      </MapView>

      <View style={styles.footer}>
        <View style={styles.buttonRow}>
          {!cruiseStarted ? (
            <TouchableOpacity style={styles.button} onPress={startCruise}>
              <Text style={styles.buttonText}>Start Cruise</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={stopCruise}>
              <Text style={styles.buttonText}>Stop Cruise</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  detailsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    maxHeight: 140,
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
  statusText: {
    fontSize: 14,
    color: '#FF3B30',
    fontWeight: '600',
  },
  map: {
    flex: 1,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  buttonRow: {
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
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
