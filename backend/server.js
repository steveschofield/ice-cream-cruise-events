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
          'SELECT id, name, latitude::double precision as lat, longitude::double precision as lng, order_index as "order" FROM waypoints WHERE event_id = $1 ORDER BY order_index',
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
      'SELECT id, name, latitude::double precision as lat, longitude::double precision as lng, order_index as "order" FROM waypoints WHERE event_id = $1 ORDER BY order_index',
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
app.post('/api/events', async (req, res) => {
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
          'INSERT INTO waypoints (event_id, name, latitude, longitude, order_index) VALUES ($1, $2, $3, $4, $5)',
          [eventId, wp.name, wp.lat, wp.lng, wp.order]
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
app.delete('/api/events/:id', async (req, res) => {
  try {
    const eventId = req.params.id;
    await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
    res.json({ message: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve admin panel
app.get('/admin', (req, res) => {
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
