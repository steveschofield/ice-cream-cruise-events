import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { API_URL } from '../../config';

export default function HomeScreen() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const loadEvents = async () => {
        try {
          setLoading(true);
          const response = await fetch(`${API_URL}/events`);
          const data = await response.json();
          setEvents(data);
        } catch (error) {
          console.error('Error loading events:', error);
        } finally {
          setLoading(false);
        }
      };
      loadEvents();
    }, [])
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ice Cream Cruisers</Text>
        <Text style={styles.subtitle}>Upcoming Events</Text>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      )}

      {!loading && events.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No events scheduled</Text>
        </View>
      )}

      {events.map((event) => (
        <View key={event.id} style={styles.eventCard}>
          <Text style={styles.eventName}>{event.name}</Text>
          <Text style={styles.eventDate}>{event.date}</Text>
          <Text style={styles.eventTimes}>🕖 Event: {event.eventTime} • 🚗 Cruise: {event.cruiseStartTime}</Text>
          <Text style={styles.eventMeetingPoint}>📍 {event.meetingPoint}</Text>
          <Text style={styles.eventDescription}>{event.description}</Text>
          
          <Link href={`/modal?eventId=${event.id}`} asChild>
            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>View Route</Text>
            </TouchableOpacity>
          </Link>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#007AFF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  eventCard: {
    backgroundColor: 'white',
    margin: 12,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  eventName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  eventDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  eventTimes: {
    fontSize: 13,
    color: '#555',
    marginBottom: 8,
  },
  eventMeetingPoint: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
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
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
