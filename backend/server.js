const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pool = require('./db');
const path = require('path');

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

// Get all events with waypoints
app.get('/api/events', async (req, res) => {
  try {
    const events = await dbAll('SELECT * FROM events ORDER BY date DESC', []);

    if (!events || events.length === 0) {
      return res.json([]);
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
          time: event.time,
          eventTime: event.event_time,
          cruiseStartTime: event.cruise_start_time,
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
    const event = await dbGet('SELECT * FROM events WHERE id = $1', [eventId]);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const waypoints = await dbAll(
      'SELECT id, name, latitude::double precision as lat, longitude::double precision as lng, order_index as "order", notes FROM waypoints WHERE event_id = $1 ORDER BY order_index',
      [eventId]
    );

    res.json({
      id: event.id,
      name: event.name,
      date: event.date,
      time: event.time,
      eventTime: event.event_time,
      cruiseStartTime: event.cruise_start_time,
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
    const { name, date, eventTime, cruiseStartTime, meetingPoint, description, waypoints } = req.body;

    if (!name || !date || !eventTime || !cruiseStartTime || !meetingPoint || !waypoints || waypoints.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      'INSERT INTO events (name, date, time, event_time, cruise_start_time, meeting_point, description) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [name, date, eventTime, eventTime, cruiseStartTime, meetingPoint, description || '']
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
      time: eventTime,
      eventTime,
      cruiseStartTime,
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

// Build map HTML document
function buildMapDocument(event) {
  const waypointsArray = Array.isArray(event.waypoints) ? event.waypoints : [];
  const routeDataObj = {
    name: event.name || 'Route Map',
    waypoints: waypointsArray.map((waypoint) => ({
      name: waypoint.name || 'Waypoint',
      lat: parseFloat(waypoint.lat),
      lng: parseFloat(waypoint.lng),
      order: waypoint.order || 0,
    })),
  };

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
      }
      .info-panel h2 {
        margin: 0 0 8px 0;
        font-size: 18px;
      }
      .info-panel p {
        margin: 4px 0;
        color: #666;
      }
    </style>
  </head>
  <body>
    <div style="display: flex; flex-direction: column; height: 100vh;">
      <div id="map" style="flex: 1;"></div>
      <div class="info-panel">
        <h2>${escapeHtml(routeDataObj.name)}</h2>
        <p><strong>Waypoints:</strong> ${escapeHtml(String(routeDataObj.waypoints.length))}</p>
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

    const event = await dbGet('SELECT * FROM events WHERE id = $1', [eventId]);
    if (!event) {
      return res.status(404).send('<html><body><h1>Event not found</h1></body></html>');
    }

    const waypoints = await dbAll(
      'SELECT id, name, latitude::double precision as lat, longitude::double precision as lng, order_index as "order", notes FROM waypoints WHERE event_id = $1 ORDER BY order_index',
      [eventId]
    );

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

// Serve web app for the root route.
app.get('/', (req, res) => {
  res.sendFile(path.join(webDir, 'index.html'));
});

// Serve web app for all other routes (client-side routing)
app.use((req, res) => {
  res.sendFile(path.join(webDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin panel at http://localhost:${PORT}/admin`);
});
