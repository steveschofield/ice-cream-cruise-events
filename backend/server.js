require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pool = require('./db');
const path = require('path');

// Validate required environment variables
const requiredEnvVars = ['ADMIN_USERNAME', 'ADMIN_PASSWORD'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('   Please set these in your .env file or environment');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');
const webDir = path.join(__dirname, 'public/web');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(publicDir, { index: false }));
app.use(express.static(webDir, { index: false }));

// Helper functions for database operations
async function dbAll(query, params) {
  const result = await pool.query(query, params);
  return result.rows;
}

async function dbGet(query, params) {
  const result = await pool.query(query, params);
  return result.rows[0];
}

async function dbRun(query, params) {
  const result = await pool.query(query, params);
  return { lastID: result.rows[0]?.id };
}

// Basic auth middleware for admin
const basicAuth = (req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).send('Authentication required');
  }

  const base64Credentials = auth.slice(6);
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;

  if (!adminUser || !adminPass) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(503).send('Admin authentication not configured');
  }

  if (username === adminUser && password === adminPass) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Admin"');
  res.status(401).send('Invalid credentials');
};

function formatTime(time) {
  if (!time) return time;
  if (/am|pm/i.test(time)) return time;
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return time;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${period}`;
}

// Mock data for development
const mockEvents = [
  {
    id: 1,
    name: 'Downtown Cone Cruise',
    date: '2024-05-15',
    time: '6:00 PM',
    event_time: '6:00 PM',
    cruise_start_time: '6:30 PM',
    default_lat: 43.169,
    default_lng: -85.212,
    meeting_point: 'Central Park Entrance',
    description: 'A scenic evening cruise through downtown streets.',
    waypoints: [
      { id: 1, name: 'Start Point', latitude: 43.169, longitude: -85.212, order_index: 1, notes: 'Meeting spot' },
      { id: 2, name: 'Ice Cream Shop', latitude: 43.175, longitude: -85.210, order_index: 2, notes: null },
      { id: 3, name: 'Park View', latitude: 43.180, longitude: -85.205, order_index: 3, notes: 'Great view' },
      { id: 4, name: 'End Point', latitude: 43.185, longitude: -85.200, order_index: 4, notes: 'Rally point' },
    ]
  },
  {
    id: 2,
    name: 'Beach Sundae Safari',
    date: '2024-05-22',
    time: '7:00 PM',
    event_time: '7:00 PM',
    cruise_start_time: '7:30 PM',
    default_lat: 43.169,
    default_lng: -85.212,
    meeting_point: 'Beach Parking Lot',
    description: 'Enjoy the sunset while cruising along the beach.',
    waypoints: [
      { id: 5, name: 'Parking Lot', latitude: 43.190, longitude: -85.215, order_index: 1, notes: 'Meet here' },
      { id: 6, name: 'Beach Entry', latitude: 43.192, longitude: -85.210, order_index: 2, notes: null },
      { id: 7, name: 'Pier Stop', latitude: 43.195, longitude: -85.205, order_index: 3, notes: 'Photo op' },
      { id: 8, name: 'Return Point', latitude: 43.190, longitude: -85.215, order_index: 4, notes: null },
    ]
  }
];

// Format mock events to match API response format
function formatMockEvents(events) {
  return events.map(event => ({
    id: event.id,
    name: event.name,
    date: event.date,
    time: event.time,
    eventTime: event.event_time,
    cruiseStartTime: event.cruise_start_time,
    defaultLat: event.default_lat ?? null,
    defaultLng: event.default_lng ?? null,
    description: event.description,
    meetingPoint: event.meeting_point,
    waypoints: event.waypoints.map(wp => ({
      id: wp.id,
      name: wp.name,
      lat: wp.latitude,
      lng: wp.longitude,
      order: wp.order_index,
      notes: wp.notes
    }))
  }));
}

// Get all events with waypoints
app.get('/api/events', async (req, res) => {
  try {
    let events;
    try {
      events = await dbAll('SELECT * FROM events ORDER BY date DESC', []);
    } catch (dbError) {
      // Fall back to mock data if database is unavailable
      console.log('Database unavailable, using mock data');
      return res.json(formatMockEvents(mockEvents));
    }

    if (!events || events.length === 0) {
      // Return mock data if database is unavailable
      return res.json(formatMockEvents(mockEvents));
    }

    const eventsWithWaypoints = await Promise.all(
      events.map(async (event) => {
        const waypoints = await dbAll(
          'SELECT id, name, latitude::double precision as lat, longitude::double precision as lng, order_index as "order", notes FROM waypoints WHERE event_id = $1 ORDER BY order_index',
          [event.id]
        );

        return {
          id: event.id,
          name: event.name,
          date: event.date,
          time: formatTime(event.time),
          eventTime: formatTime(event.event_time),
          cruiseStartTime: formatTime(event.cruise_start_time),
          defaultLat: event.default_lat ?? null,
          defaultLng: event.default_lng ?? null,
          description: event.description,
          meetingPoint: event.meeting_point,
          waypoints: waypoints || [],
        };
      })
    );

    res.json(eventsWithWaypoints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single event
app.get('/api/events/:id', async (req, res) => {
  try {
    const eventId = req.params.id;

    // Check mock data first
    const mockEvent = mockEvents.find(e => e.id === parseInt(eventId));
    if (mockEvent) {
      return res.json({
        id: mockEvent.id,
        name: mockEvent.name,
        date: mockEvent.date,
        time: mockEvent.time,
        eventTime: mockEvent.event_time,
        cruiseStartTime: mockEvent.cruise_start_time,
        description: mockEvent.description,
        meetingPoint: mockEvent.meeting_point,
        waypoints: mockEvent.waypoints.map(wp => ({
          id: wp.id,
          name: wp.name,
          lat: wp.latitude,
          lng: wp.longitude,
          order: wp.order_index,
          notes: wp.notes
        })),
      });
    }

    let event;
    let waypoints;
    try {
      event = await dbGet('SELECT * FROM events WHERE id = $1', [eventId]);

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      waypoints = await dbAll(
        'SELECT id, name, latitude::double precision as lat, longitude::double precision as lng, order_index as "order", notes FROM waypoints WHERE event_id = $1 ORDER BY order_index',
        [eventId]
      );
    } catch (dbError) {
      // Fall back to mock data if database is unavailable
      console.log('Database unavailable for event', eventId);
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({
      id: event.id,
      name: event.name,
      date: event.date,
      time: formatTime(event.time),
      eventTime: formatTime(event.event_time),
      cruiseStartTime: formatTime(event.cruise_start_time),
      defaultLat: event.default_lat ?? null,
      defaultLng: event.default_lng ?? null,
      description: event.description,
      meetingPoint: event.meeting_point,
      waypoints: waypoints || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create event with waypoints
app.post('/api/events', basicAuth, async (req, res) => {
  try {
    const { name, date, eventTime, cruiseStartTime, meetingPoint, description, waypoints, defaultLat, defaultLng } = req.body;

    if (!name || !date || !eventTime || !cruiseStartTime || !meetingPoint || !waypoints || waypoints.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      'INSERT INTO events (name, date, time, event_time, cruise_start_time, meeting_point, description, default_lat, default_lng) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
      [name, date, eventTime, eventTime, cruiseStartTime, meetingPoint, description || '', defaultLat ?? null, defaultLng ?? null]
    );

    const eventId = result.rows[0].id;

    await Promise.all(
      waypoints.map((wp) =>
        pool.query(
          'INSERT INTO waypoints (event_id, name, latitude, longitude, order_index, notes) VALUES ($1, $2, $3, $4, $5, $6)',
          [eventId, wp.name, wp.lat, wp.lng, wp.order, wp.notes || null]
        )
      )
    );

    res.status(201).json({
      id: eventId,
      name,
      date,
      time: formatTime(eventTime),
      eventTime: formatTime(eventTime),
      cruiseStartTime: formatTime(cruiseStartTime),
      defaultLat: defaultLat ?? null,
      defaultLng: defaultLng ?? null,
      description,
      meetingPoint,
      waypoints,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete event
app.delete('/api/events/:id', basicAuth, async (req, res) => {
  try {
    const eventId = req.params.id;
    await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
    res.json({ message: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// HTML escape function
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(text).replace(/[&<>"']/g, (char) => map[char]);
}

// Build Google Maps URL for navigation
function buildMapsUrl(waypoints) {
  if (!waypoints || waypoints.length === 0) {
    return null;
  }

  if (waypoints.length === 1) {
    const wp = waypoints[0];
    return `https://www.google.com/maps/search/?api=1&query=${wp.lat},${wp.lng}`;
  }

  const [origin, ...rest] = waypoints;
  const destination = rest[rest.length - 1];
  const middleWaypoints = rest.slice(0, -1);

  let googleUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
  if (middleWaypoints.length > 0) {
    const waypointParams = middleWaypoints.map(wp => `${wp.lat},${wp.lng}`).join('|');
    googleUrl += `&waypoints=${waypointParams}`;
  }

  return googleUrl;
}

function buildMapDocument(event) {
  const waypointsArray = Array.isArray(event.waypoints) ? event.waypoints : [];
  const routeDataObj = {
    name: event.name || 'Route Map',
    defaultLat: event.default_lat ?? null,
    defaultLng: event.default_lng ?? null,
    waypoints: waypointsArray.map((waypoint) => ({
      name: waypoint.name || 'Waypoint',
      lat: parseFloat(waypoint.lat),
      lng: parseFloat(waypoint.lng),
      order: waypoint.order || 0,
    })),
  };

  const mapsUrl = buildMapsUrl(waypointsArray);
  const routeDataJson = JSON.stringify(routeDataObj).replace(/</g, '\\u003c');

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
      .info-panel {
        padding: 16px;
        background: white;
        font-size: 14px;
        line-height: 1.5;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .info-panel h2 {
        margin: 0;
        font-size: 18px;
      }
      .info-panel p {
        margin: 4px 0 0 0;
        color: #666;
      }
      .button-group {
        display: flex;
        gap: 8px;
      }
      .map-button {
        flex: 1;
        padding: 10px 16px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        text-decoration: none;
        display: inline-block;
        text-align: center;
      }
      .map-button-google {
        background-color: #007AFF;
        color: white;
      }
      .map-button:hover {
        opacity: 0.9;
      }
    </style>
  </head>
  <body>
    <div style="display: flex; flex-direction: column; height: 100vh;">
      <div id="map" style="flex: 1;"></div>
      <div class="info-panel">
        <div>
          <h2>${escapeHtml(routeDataObj.name)}</h2>
          <p><strong>Waypoints:</strong> ${escapeHtml(String(routeDataObj.waypoints.length))}</p>
        </div>
        ${mapsUrl ? `<div class="button-group">
          <a href="${escapeHtml(mapsUrl)}" class="map-button map-button-google">Google Maps</a>
        </div>` : ''}
      </div>
    </div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      const routeData = ${routeDataJson};

      if (!routeData || !routeData.waypoints) {
        document.getElementById('map').innerHTML = '<div style="padding: 20px; color: red;">Error: No route data available</div>';
        throw new Error('routeData or waypoints is undefined');
      }

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

      const coordinates = (routeData.waypoints || []).map((waypoint) => [waypoint.lat, waypoint.lng]);

      if (coordinates.length === 0) {
        map.setView([routeData.defaultLat || 43.169, routeData.defaultLng || -85.212], 9);
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
          html: '<div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background: ' + color + '; border-radius: 50%; border: 2px solid white; color: white; font-weight: bold; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">' + waypoint.order + '</div>',
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

// Serve modal map view
app.get('/modal', async (req, res) => {
  try {
    const eventId = req.query.eventId;
    if (!eventId) {
      return res.status(400).send('<html><body><h1>Missing eventId parameter</h1></body></html>');
    }

    // Check mock data first
    const mockEvent = mockEvents.find(e => e.id === parseInt(eventId));
    if (mockEvent) {
      const eventWithWaypoints = {
        name: mockEvent.name,
        waypoints: mockEvent.waypoints.map(wp => ({
          id: wp.id,
          name: wp.name,
          lat: wp.latitude,
          lng: wp.longitude,
          order: wp.order_index,
          notes: wp.notes
        }))
      };
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(buildMapDocument(eventWithWaypoints));
    }

    // Try database
    let event;
    let waypoints;
    try {
      event = await dbGet('SELECT * FROM events WHERE id = $1', [eventId]);
      if (!event) {
        return res.status(404).send('<html><body><h1>Event not found</h1></body></html>');
      }

      waypoints = await dbAll(
        'SELECT id, name, latitude::double precision as lat, longitude::double precision as lng, order_index as "order", notes FROM waypoints WHERE event_id = $1 ORDER BY order_index',
        [eventId]
      );
    } catch (dbError) {
      console.log('Database unavailable for modal, checked mock data');
      return res.status(404).send('<html><body><h1>Event not found</h1></body></html>');
    }

    const eventWithWaypoints = {
      ...event,
      name: event.name,
      waypoints: waypoints || [],
    };

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(buildMapDocument(eventWithWaypoints));
  } catch (error) {
    console.error('Modal endpoint error:', error);
    res.status(500).send('<html><body><h1>Error</h1><p>An error occurred. Please try again.</p></body></html>');
  }
});

// Serve admin panel
app.get('/admin', basicAuth, (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

// Keep the share/QR page available without mounting the web app under /app.
app.get('/download', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Redirect old /app links to the actual web app root.
app.get(/^\/app(?:\/.*)?$/, (req, res) => {
  const target = req.originalUrl.replace(/^\/app\b/, '') || '/';
  res.redirect(302, target.startsWith('?') ? `/${target}` : target);
});

// Serve events list for the root route.
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Serve web app for all other routes (client-side routing)
app.use((req, res) => {
  res.sendFile(path.join(webDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✅ Server running on port ${PORT}`);
  console.log(`📍 API endpoints: http://localhost:${PORT}/api/events`);
  console.log(`🔐 Admin panel: http://localhost:${PORT}/admin`);
  console.log(`   Username: ${process.env.ADMIN_USERNAME}`);
  console.log(`\n🗺️  Test modal: http://localhost:${PORT}/modal?eventId=1`);
  console.log(`\n`);
});
