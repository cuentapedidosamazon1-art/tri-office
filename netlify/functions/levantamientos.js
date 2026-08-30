// ================================================================
// FUNCIÓN SERVERLESS — Levantamiento actual (Netlify Functions + Neon)
//
// Diseño de "un solo registro": esta tabla nunca acumula historial.
// Siempre existe como máximo UNA fila (id = 'current'), que se
// sobrescribe cada vez que el usuario guarda. Así nunca hay que
// limpiar la base de datos a mano.
//
// Ruta pública: /.netlify/functions/levantamientos
//
//   GET    /levantamientos   -> el levantamiento actual (o 404 si no hay ninguno)
//   POST   /levantamientos   -> guarda (sobrescribe) el levantamiento actual
//   DELETE /levantamientos   -> borra el levantamiento actual
//
// Variable de entorno requerida: DATABASE_URL (o NETLIFY_DATABASE_URL,
// que es el nombre que usa automáticamente la integración de Neon en
// Netlify si la instalas desde el marketplace).
// ================================================================

const { neon } = require('@neondatabase/serverless');

const CURRENT_ID = 'current';

function getSql() {
  const connectionString = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
  if (!connectionString) {
    throw new Error('Falta configurar la variable de entorno DATABASE_URL en Netlify.');
  }
  return neon(connectionString);
}

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function respond(statusCode, bodyObj) {
  return { statusCode, headers: jsonHeaders, body: JSON.stringify(bodyObj) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: jsonHeaders, body: '' };
  }

  let sql;
  try {
    sql = getSql();
  } catch (err) {
    return respond(500, { error: err.message });
  }

  try {
    // ---------------------------------------------------------
    // GET — traer el levantamiento actual (solo hay uno)
    // ---------------------------------------------------------
    if (event.httpMethod === 'GET') {
      const rows = await sql`SELECT * FROM levantamientos WHERE id = ${CURRENT_ID} LIMIT 1`;
      if (!rows.length) return respond(404, { error: 'No hay ningún levantamiento guardado en la nube todavía.' });
      return respond(200, rowToState(rows[0]));
    }

    // ---------------------------------------------------------
    // POST — guardar (sobrescribir) el levantamiento actual
    // ---------------------------------------------------------
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const meta = body.meta || {};
      if (!meta.cliente || !meta.cliente.trim()) return respond(400, { error: 'Falta el nombre del cliente.' });

      const departamentos = JSON.stringify(body.departamentos || []);
      const equipos = JSON.stringify(body.equipos || []);
      const thresholds = JSON.stringify(body.thresholds || { low: 1000, high: 2000 });

      const rows = await sql`
        INSERT INTO levantamientos (id, codigo, cliente, tecnico, fecha, observaciones, thresholds, departamentos, equipos, updated_at)
        VALUES (
          ${CURRENT_ID}, ${meta.codigo || ''}, ${meta.cliente}, ${meta.tecnico || ''}, ${meta.fecha || null},
          ${meta.observaciones || ''}, ${thresholds}::jsonb, ${departamentos}::jsonb, ${equipos}::jsonb, now()
        )
        ON CONFLICT (id) DO UPDATE SET
          codigo         = EXCLUDED.codigo,
          cliente        = EXCLUDED.cliente,
          tecnico        = EXCLUDED.tecnico,
          fecha          = EXCLUDED.fecha,
          observaciones  = EXCLUDED.observaciones,
          thresholds     = EXCLUDED.thresholds,
          departamentos  = EXCLUDED.departamentos,
          equipos        = EXCLUDED.equipos,
          updated_at     = now()
        RETURNING *
      `;
      return respond(200, rowToState(rows[0]));
    }

    // ---------------------------------------------------------
    // DELETE — borrar el levantamiento actual
    // ---------------------------------------------------------
    if (event.httpMethod === 'DELETE') {
      await sql`DELETE FROM levantamientos WHERE id = ${CURRENT_ID}`;
      return respond(200, { ok: true });
    }

    return respond(405, { error: 'Método no permitido.' });
  } catch (err) {
    console.error('Error en función levantamientos:', err);
    return respond(500, { error: 'Error interno al hablar con la base de datos.' });
  }
};

// Convierte la fila de la tabla al mismo formato "state" que usa el frontend
function rowToState(row) {
  return {
    meta: {
      cliente: row.cliente,
      tecnico: row.tecnico,
      fecha: row.fecha,
      codigo: row.codigo || row.id,
      observaciones: row.observaciones,
    },
    thresholds: row.thresholds,
    departamentos: row.departamentos,
    equipos: row.equipos,
    savedAt: row.updated_at,
  };
}
