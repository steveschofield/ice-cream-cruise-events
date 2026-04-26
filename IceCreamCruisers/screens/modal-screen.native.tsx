import { useLocalSearchParams, Link } from 'expo-router';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Vibration } from 'react-native';
import MapView, { Marker, Polyline, Callout } from 'react-native-maps';
import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Audio } from 'expo-av';
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
  const [cruisePaused, setCruisePaused] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [event, setEvent] = useState(null);
  const [completedWaypoints, setCompletedWaypoints] = useState(new Set());
  const [nextWaypointIndex, setNextWaypointIndex] = useState(0);
  const [distanceToNext, setDistanceToNext] = useState(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [alertedWaypoints, setAlertedWaypoints] = useState(new Set());
  const lastLocationRef = useRef(null);

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

    await activateKeepAwakeAsync();
    setCruiseStarted(true);

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 10,
      },
      async (location) => {
        const newCoord = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setCurrentLocation(newCoord);

        if (lastLocationRef.current) {
          const deltaLat = newCoord.latitude - lastLocationRef.current.latitude;
          const deltaLng = newCoord.longitude - lastLocationRef.current.longitude;
          const distMeters = Math.sqrt(deltaLat * deltaLat + deltaLng * deltaLng) * 111000;
          const speedKmh = (distMeters / 1000) / (location.timestamp - lastLocationRef.current.timestamp) * 1000 * 3.6;
          setCurrentSpeed(Math.max(0, Math.round(speedKmh)));
        }
        lastLocationRef.current = { ...newCoord, timestamp: location.timestamp };

        if (event && event.waypoints.length > 0) {
          const completed = new Set();
          let nextIdx = 0;
          let closestDist = Infinity;

          event.waypoints.forEach((wp, idx) => {
            const dist = Math.sqrt(
              Math.pow(wp.lat - newCoord.latitude, 2) +
              Math.pow(wp.lng - newCoord.longitude, 2)
            );

            if (dist < 0.003) {
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
          const kmToNext = (
            Math.sqrt(
              Math.pow(nextWp.lat - newCoord.latitude, 2) +
              Math.pow(nextWp.lng - newCoord.longitude, 2)
            ) * 111
          ).toFixed(1);
          setDistanceToNext(kmToNext);

          if (kmToNext < 1 && !alertedWaypoints.has(nextWp.id)) {
            try {
              await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
              const { sound } = await Audio.Sound.createAsync(require('../assets/notification.mp3').default || { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' });
              await sound.playAsync();
            } catch (e) {
              console.log('Audio play failed, trying vibration only');
            }
            Vibration.vibrate([0, 500, 100, 500]);
            setAlertedWaypoints(new Set([...alertedWaypoints, nextWp.id]));
          }
        }

        if (!cruisePaused) {
          mapRef.current?.animateToRegion({
            ...newCoord,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          });
        }
      }
    );

    setLocationSubscription(subscription);
  };

  const pauseCruise = () => {
    setCruisePaused(true);
  };

  const resumeCruise = () => {
    setCruisePaused(false);
  };

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

  const routeCoordinates = event.waypoints.map((wp) => ({
    latitude: wp.lat,
    longitude: wp.lng,
  }));

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
        {event.waypoints.map((waypoint, idx) => {
          const isStart = waypoint.order === 1;
          const isEnd = waypoint.order === event.waypoints.length;
          const isCompleted = completedWaypoints.has(waypoint.id);
          const isNext = idx === nextWaypointIndex && !isCompleted;

          let color = '#FF3B30';
          if (isCompleted) {
            color = '#CCCCCC';
          } else if (isNext) {
            color = '#FFD700';
          } else if (!isStart && !isEnd) {
            color = '#007AFF';
          }

          return (
            <Marker
              key={waypoint.id}
              coordinate={{
                latitude: waypoint.lat,
                longitude: waypoint.lng,
              }}
              pinColor={color}
              opacity={isCompleted ? 0.4 : 1}
            >
              <View style={[styles.numberOverlay, { borderColor: color }]}>
                <Text style={styles.overlayNumber}>{waypoint.order}</Text>
              </View>
              <Callout>
                <View style={styles.calloutContainer}>
                  <View style={[styles.numberBadge, { backgroundColor: color }]}>
                    <Text style={styles.numberText}>{waypoint.order}</Text>
                  </View>
                  <View style={styles.calloutTextContainer}>
                    <Text style={styles.calloutTitle}>{waypoint.name}</Text>
                    {waypoint.notes && <Text style={styles.calloutNotes}>{waypoint.notes}</Text>}
                  </View>
                </View>
              </Callout>
            </Marker>
          );
        })}
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
  titleBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContent: {
    flex: 1,
  },
  nextWaypointText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 12,
  },
  statText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '500',
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
  modalTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  distanceText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  numberOverlay: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  overlayNumber: {
    fontWeight: 'bold',
    fontSize: 13,
    color: '#333',
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
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  button: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  pauseButton: {
    backgroundColor: '#FF9500',
  },
  resumeButton: {
    backgroundColor: '#34C759',
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
  calloutContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'white',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    maxWidth: 280,
  },
  numberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  numberText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  calloutTextContainer: {
    flex: 1,
  },
  calloutTitle: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginBottom: 2,
  },
  calloutNotes: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});
