require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
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

const allowedOrigins = [
  'http://localhost:3000',
  'http://192.168.1.69:3000',
  'https://ice-cream-cruise-events.onrender.com',
];
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https://*.tile.openstreetmap.org", "https://unpkg.com"],
      connectSrc: ["'self'", "https://ice-cream-cruise-events.onrender.com"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: false,
}));
app.use(bodyParser.json({ limit: '10kb' }));
app.use(express.static(publicDir, { index: false }));
app.use(express.static(webDir, { index: false }));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
app.use('/api/', apiLimiter);

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
    default_lat: null,
    default_lng: null,
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
    default_lat: null,
    default_lng: null,
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
      return res.json([]);
    }

    const rows = await dbAll(`
      SELECT e.id, e.name, e.date, e.time, e.event_time, e.cruise_start_time,
             e.meeting_point, e.description, e.default_lat, e.default_lng,
             w.id as wp_id, w.name as wp_name,
             w.latitude::double precision as wp_lat,
             w.longitude::double precision as wp_lng,
             w.order_index as wp_order, w.notes as wp_notes
      FROM events e
      LEFT JOIN waypoints w ON w.event_id = e.id
      ORDER BY e.date DESC, w.order_index
    `, []);

    const eventMap = new Map();
    for (const row of rows) {
      if (!eventMap.has(row.id)) {
        eventMap.set(row.id, {
          id: row.id,
          name: row.name,
          date: row.date,
          time: formatTime(row.time),
          eventTime: formatTime(row.event_time),
          cruiseStartTime: formatTime(row.cruise_start_time),
          defaultLat: row.default_lat ?? null,
          defaultLng: row.default_lng ?? null,
          description: row.description,
          meetingPoint: row.meeting_point,
          waypoints: [],
        });
      }
      if (row.wp_id) {
        eventMap.get(row.id).waypoints.push({
          id: row.wp_id,
          name: row.wp_name,
          lat: row.wp_lat,
          lng: row.wp_lng,
          order: row.wp_order,
          notes: row.wp_notes,
        });
      }
    }

    res.json([...eventMap.values()]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single event
app.get('/api/events/:id', async (req, res) => {
  try {
    const eventId = req.params.id;

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
      const mockEvent = mockEvents.find(e => e.id === parseInt(eventId));
      if (!mockEvent) return res.status(404).json({ error: 'Event not found' });
      return res.json({
        id: mockEvent.id,
        name: mockEvent.name,
        date: mockEvent.date,
        time: mockEvent.time,
        eventTime: mockEvent.event_time,
        cruiseStartTime: mockEvent.cruise_start_time,
        defaultLat: mockEvent.default_lat ?? null,
        defaultLng: mockEvent.default_lng ?? null,
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
app.post('/api/events', authLimiter, basicAuth, async (req, res) => {
  try {
    const { name, date, eventTime, cruiseStartTime, meetingPoint, description, waypoints, defaultLat, defaultLng } = req.body;

    if (!name || !date || !eventTime || !cruiseStartTime || !meetingPoint || !waypoints || waypoints.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (typeof name !== 'string' || name.length > 200) return res.status(400).json({ error: 'Invalid event name' });
    if (typeof meetingPoint !== 'string' || meetingPoint.length > 300) return res.status(400).json({ error: 'Invalid meeting point' });
    if (description && (typeof description !== 'string' || description.length > 1000)) return res.status(400).json({ error: 'Description too long' });
    if (waypoints.length > 50) return res.status(400).json({ error: 'Too many waypoints (max 50)' });

    for (const wp of waypoints) {
      const lat = parseFloat(wp.lat);
      const lng = parseFloat(wp.lng);
      if (isNaN(lat) || lat < -90 || lat > 90) return res.status(400).json({ error: `Invalid latitude: ${wp.lat}` });
      if (isNaN(lng) || lng < -180 || lng > 180) return res.status(400).json({ error: `Invalid longitude: ${wp.lng}` });
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
    const result = await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Event not found' });
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
  const mapsUrlSafe = mapsUrl ? escapeHtml(mapsUrl) : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#f5f5f5" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
    <style>
      * { box-sizing: border-box; }
      html, body { height: 100%; margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      #app { display: flex; flex-direction: column; height: 100dvh; }
      #header {
        padding: 10px 14px;
        background: #f5f5f5;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-shrink: 0;
      }
      #header-left { flex: 1; }
      #event-name { font-size: 13px; font-weight: 600; margin: 0; }
      #next-waypoint { font-size: 15px; font-weight: 700; color: #007AFF; margin: 3px 0 0; display: none; }
      #stats-row { display: none; flex-direction: row; gap: 14px; margin-top: 5px; }
      #stats-row span { font-size: 12px; color: #555; font-weight: 500; }
      #status-badge {
        font-size: 13px; font-weight: 600; color: #FF3B30;
        display: none; white-space: nowrap; padding-top: 2px;
      }
      #map { flex: 1; }
      #footer {
        padding: 10px 12px;
        border-top: 1px solid #e0e0e0;
        background: white;
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex-shrink: 0;
      }
      #btn-row { display: flex; gap: 8px; }
      .btn {
        flex: 1; padding: 12px 8px; border: none; border-radius: 6px;
        font-size: 15px; font-weight: 600; cursor: pointer; color: white;
      }
      .btn-start { background: #007AFF; }
      .btn-pause { background: #FF9500; }
      .btn-resume { background: #34C759; }
      .btn-stop { background: #FF3B30; }
      .btn-maps { background: #5856D6; }
      #close-link {
        display: block; text-align: center; padding: 8px;
        color: #007AFF; font-size: 15px; font-weight: 600; text-decoration: none;
      }
      #alert-banner {
        display: none; position: fixed; top: 0; left: 0; right: 0;
        background: #FF9500; color: white; text-align: center;
        padding: 12px; font-weight: 700; font-size: 15px; z-index: 9999;
      }
      .leaflet-container { background: #eef3f8; }
    </style>
  </head>
  <body>
    <div id="alert-banner"></div>
    <div id="app">
      <div id="header">
        <div id="header-left">
          <p id="event-name">${escapeHtml(routeDataObj.name)}</p>
          <p id="next-waypoint"></p>
          <div id="stats-row">
            <span id="speed-stat">⚡ 0 km/h</span>
            <span id="dist-stat">📍 — km</span>
          </div>
        </div>
        <div id="status-badge">🔴 Live</div>
      </div>
      <div id="map"></div>
      <div id="footer">
        <div id="btn-row">
          <button class="btn btn-start" id="btn-start">Start Cruise</button>
          ${mapsUrlSafe ? `<a href="${mapsUrlSafe}" class="btn btn-maps" style="text-align:center;text-decoration:none;line-height:1.4;">Google Maps</a>` : ''}
        </div>
        <a href="/" id="close-link">Close</a>
      </div>
    </div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <script>
      const routeData = ${routeDataJson};

      const escHtml = (v) => String(v ?? '').replace(/[&<>"']/g, c =>
        ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

      function haversineKm(lat1, lng1, lat2, lng2) {
        const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      }

      // --- Map setup ---
      const map = L.map('map', { zoomControl: true, attributionControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const coords = routeData.waypoints.map(wp => [wp.lat, wp.lng]);
      if (coords.length === 0) {
        map.setView([routeData.defaultLat || 0, routeData.defaultLng || 0], 2);
      } else if (coords.length === 1) {
        map.setView(coords[0], 13);
      } else {
        map.fitBounds(L.latLngBounds(coords).pad(0.2));
      }

      if (coords.length > 1) {
        L.polyline(coords, { color: '#2563eb', weight: 4, opacity: 0.85 }).addTo(map);
      }

      const waypointMarkers = [];
      const colors = { start: '#16a34a', middle: '#2563eb', end: '#dc2626' };

      routeData.waypoints.forEach((wp, i) => {
        const isStart = i === 0, isEnd = i === routeData.waypoints.length - 1;
        const color = isStart ? colors.start : isEnd ? colors.end : colors.middle;
        const icon = L.divIcon({
          html: '<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:' + color + ';border-radius:50%;border:2px solid white;color:white;font-weight:bold;font-size:14px;box-shadow:0 2px 4px rgba(0,0,0,0.3);">' + wp.order + '</div>',
          iconSize: [32, 32], className: ''
        });
        const marker = L.marker([wp.lat, wp.lng], { icon })
          .addTo(map)
          .bindPopup('<strong>' + escHtml(wp.order + '. ' + wp.name) + '</strong>');
        waypointMarkers.push(marker);
      });

      // --- Cruise state ---
      let cruising = false, paused = false, watchId = null, wakeLock = null;
      let lastPos = null, alertedIds = new Set(), completedIds = new Set();
      let posMarker = null, posAccCircle = null;

      const btnStart  = document.getElementById('btn-start');
      const btnRow    = document.getElementById('btn-row');
      const nextWpEl  = document.getElementById('next-waypoint');
      const statsRow  = document.getElementById('stats-row');
      const speedEl   = document.getElementById('speed-stat');
      const distEl    = document.getElementById('dist-stat');
      const statusEl  = document.getElementById('status-badge');
      const alertEl   = document.getElementById('alert-banner');

      function showAlert(msg) {
        alertEl.textContent = msg;
        alertEl.style.display = 'block';
        setTimeout(() => { alertEl.style.display = 'none'; }, 4000);
        if (navigator.vibrate) navigator.vibrate([0, 400, 100, 400]);
      }

      function updateMarkerStyle(index, isNext) {
        const wp = routeData.waypoints[index];
        if (!wp) return;
        const isStart = index === 0, isEnd = index === routeData.waypoints.length - 1;
        const isCompleted = completedIds.has(wp.order);
        let color = isStart ? colors.start : isEnd ? colors.end : colors.middle;
        if (isCompleted) color = '#aaa';
        else if (isNext && !isStart && !isEnd) color = '#FF6600';
        const size = isNext ? 44 : 32;
        const icon = L.divIcon({
          html: '<div style="display:flex;align-items:center;justify-content:center;width:' + size + 'px;height:' + size + 'px;background:' + color + ';border-radius:50%;border:2px solid white;color:white;font-weight:bold;font-size:' + (isNext?18:14) + 'px;box-shadow:0 2px 4px rgba(0,0,0,0.3);opacity:' + (isCompleted?0.4:1) + ';">' + wp.order + '</div>',
          iconSize: [size, size], className: ''
        });
        waypointMarkers[index].setIcon(icon);
      }

      function onPosition(pos) {
        if (paused) return;
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        const ts = pos.timestamp;

        // Update live marker
        if (!posMarker) {
          posMarker = L.circleMarker([lat, lng], {
            radius: 10, color: '#007AFF', fillColor: '#5AC8FA',
            fillOpacity: 0.9, weight: 3
          }).addTo(map).bindPopup('You are here');
          posAccCircle = L.circle([lat, lng], { radius: accuracy, color: '#007AFF', fillOpacity: 0.08, weight: 1 }).addTo(map);
        } else {
          posMarker.setLatLng([lat, lng]);
          posAccCircle.setLatLng([lat, lng]).setRadius(accuracy);
        }
        map.panTo([lat, lng]);

        // Speed
        if (lastPos) {
          const distKm = haversineKm(lastPos.lat, lastPos.lng, lat, lng);
          const elapsedHrs = (ts - lastPos.ts) / 3600000;
          const kmh = elapsedHrs > 0 ? Math.max(0, Math.round(distKm / elapsedHrs)) : 0;
          speedEl.textContent = '⚡ ' + kmh + ' km/h';
        }
        lastPos = { lat, lng, ts };

        // Nearest waypoint
        let nextIdx = 0, closestDist = Infinity;
        routeData.waypoints.forEach((wp, i) => {
          const d = haversineKm(lat, lng, wp.lat, wp.lng);
          if (d < 0.3) completedIds.add(wp.order);
          if (d < closestDist) { closestDist = d; nextIdx = i; }
        });

        const nextWp = routeData.waypoints[nextIdx];
        const kmToNext = haversineKm(lat, lng, nextWp.lat, nextWp.lng).toFixed(1);
        nextWpEl.textContent = nextWp.name;
        distEl.textContent = '📍 ' + kmToNext + ' km';

        routeData.waypoints.forEach((_, i) => updateMarkerStyle(i, i === nextIdx));

        if (parseFloat(kmToNext) < 1 && !alertedIds.has(nextWp.order)) {
          alertedIds.add(nextWp.order);
          showAlert('📍 Approaching: ' + nextWp.name);
        }
      }

      async function startCruise() {
        if (!navigator.geolocation) {
          alert('Geolocation is not supported by your browser.');
          return;
        }
        try {
          if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
        } catch(e) {}

        cruising = true; paused = false;
        nextWpEl.style.display = 'block';
        statsRow.style.display = 'flex';
        statusEl.style.display = 'block';
        statusEl.textContent = '🔴 Live';

        btnRow.innerHTML = \`
          <button class="btn btn-pause" onclick="pauseCruise()">Pause</button>
          <button class="btn btn-stop" onclick="stopCruise()">Stop</button>
          ${mapsUrlSafe ? `<a href="${mapsUrlSafe}" class="btn btn-maps" style="text-align:center;text-decoration:none;line-height:1.4;">Maps</a>` : ''}
        \`;

        watchId = navigator.geolocation.watchPosition(onPosition,
          (err) => alert('Location error: ' + err.message),
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
        );
      }

      function pauseCruise() {
        paused = true;
        statusEl.textContent = '⏸️ Paused';
        btnRow.innerHTML = \`
          <button class="btn btn-resume" onclick="resumeCruise()">Resume</button>
          <button class="btn btn-stop" onclick="stopCruise()">Stop</button>
          ${mapsUrlSafe ? `<a href="${mapsUrlSafe}" class="btn btn-maps" style="text-align:center;text-decoration:none;line-height:1.4;">Maps</a>` : ''}
        \`;
      }

      function resumeCruise() {
        paused = false;
        statusEl.textContent = '🔴 Live';
        btnRow.innerHTML = \`
          <button class="btn btn-pause" onclick="pauseCruise()">Pause</button>
          <button class="btn btn-stop" onclick="stopCruise()">Stop</button>
          ${mapsUrlSafe ? `<a href="${mapsUrlSafe}" class="btn btn-maps" style="text-align:center;text-decoration:none;line-height:1.4;">Maps</a>` : ''}
        \`;
      }

      function stopCruise() {
        if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
        if (wakeLock) { wakeLock.release(); wakeLock = null; }
        if (posMarker) { posMarker.remove(); posMarker = null; }
        if (posAccCircle) { posAccCircle.remove(); posAccCircle = null; }
        cruising = false; paused = false; lastPos = null;
        alertedIds.clear(); completedIds.clear();
        nextWpEl.style.display = 'none';
        statsRow.style.display = 'none';
        statusEl.style.display = 'none';
        routeData.waypoints.forEach((_, i) => updateMarkerStyle(i, false));
        if (coords.length > 1) map.fitBounds(L.latLngBounds(coords).pad(0.2));
        btnRow.innerHTML = \`
          <button class="btn btn-start" onclick="startCruise()">Start Cruise</button>
          ${mapsUrlSafe ? `<a href="${mapsUrlSafe}" class="btn btn-maps" style="text-align:center;text-decoration:none;line-height:1.4;">Google Maps</a>` : ''}
        \`;
      }

      btnStart.addEventListener('click', startCruise);
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
  console.log(`\n🗺️  Test modal: http://localhost:${PORT}/modal?eventId=1`);
  console.log(`\n`);
});
