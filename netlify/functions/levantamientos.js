// ================================================================
// FUNCIÓN SERVERLESS — Levantamientos (Netlify Functions + Neon)
//
// Ruta pública: /.netlify/functions/levantamientos
//
//   GET    /levantamientos           -> lista resumida de todos los levantamientos
//   GET    /levantamientos?id=XXX    -> un levantamiento completo
//   POST   /levantamientos           -> crea o actualiza (upsert) un levantamiento
//   DELETE /levantamientos?id=XXX    -> elimina un levantamiento
//
// Variable de entorno requerida: DATABASE_URL (o NETLIFY_DATABASE_URL,
// que es el nombre que usa automáticamente la integración de Neon en
// Netlify si la instalas desde el marketplace).
// ================================================================

const { neon } = require('@neondatabase/serverless');

function getSql() {
  const connectionString = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
  if (!connectionString) {
    throw new Error('Falta configurar la variable de entorno DATABASE_URL en Netlify.');
  }
  return neon(connectionString);
}

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  // Permite llamar la función desde el mismo sitio sin problemas de CORS.
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

  const id = event.queryStringParameters && event.queryStringParameters.id;

  try {
    // ---------------------------------------------------------
    // GET — listar todos, o traer uno por id
    // ---------------------------------------------------------
    if (event.httpMethod === 'GET') {
      if (id) {
        const rows = await sql`SELECT * FROM levantamientos WHERE id = ${id} LIMIT 1`;
        if (!rows.length) return respond(404, { error: 'Levantamiento no encontrado.' });
        return respond(200, rowToState(rows[0]));
      }
      const rows = await sql`
        SELECT id, cliente, tecnico, fecha, updated_at
        FROM levantamientos
        ORDER BY updated_at DESC
        LIMIT 200
      `;
      return respond(200, rows.map(r => ({
        codigo: r.id,
        cliente: r.cliente,
        tecnico: r.tecnico,
        fecha: r.fecha,
        actualizado: r.updated_at,
      })));
    }

    // ---------------------------------------------------------
    // POST — crear o actualizar (upsert) un levantamiento completo
    // ---------------------------------------------------------
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const meta = body.meta || {};
      if (!meta.codigo) return respond(400, { error: 'Falta meta.codigo (identificador del levantamiento).' });
      if (!meta.cliente || !meta.cliente.trim()) return respond(400, { error: 'Falta el nombre del cliente.' });

      const departamentos = JSON.stringify(body.departamentos || []);
      const equipos = JSON.stringify(body.equipos || []);
      const thresholds = JSON.stringify(body.thresholds || { low: 1000, high: 2000 });

      const rows = await sql`
        INSERT INTO levantamientos (id, cliente, tecnico, fecha, observaciones, thresholds, departamentos, equipos, updated_at)
        VALUES (
          ${meta.codigo}, ${meta.cliente}, ${meta.tecnico || ''}, ${meta.fecha || null},
          ${meta.observaciones || ''}, ${thresholds}::jsonb, ${departamentos}::jsonb, ${equipos}::jsonb, now()
        )
        ON CONFLICT (id) DO UPDATE SET
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
    // DELETE — eliminar un levantamiento
    // ---------------------------------------------------------
    if (event.httpMethod === 'DELETE') {
      if (!id) return respond(400, { error: 'Falta el parámetro id.' });
      await sql`DELETE FROM levantamientos WHERE id = ${id}`;
      return respond(200, { ok: true });
    }

    return respond(405, { error: 'Método no permitido.' });
  } catch (err) {
    console.error('Error en función levantamientos:', err);
    return respond(500, { error: 'Error interno al hablar con la base de datos.' });
  }
};

// Convierte una fila de la tabla al mismo formato "state" que usa el frontend
function rowToState(row) {
  return {
    meta: {
      cliente: row.cliente,
      tecnico: row.tecnico,
      fecha: row.fecha,
      codigo: row.id,
      observaciones: row.observaciones,
    },
    thresholds: row.thresholds,
    departamentos: row.departamentos,
    equipos: row.equipos,
    savedAt: row.updated_at,
  };
}
