export interface StatBucket {
  key: string;
  count: number;
}

export interface LinkStats {
  total: number;
  byDay: StatBucket[];
  byCountry: StatBucket[];
  byReferer: StatBucket[];
  byDevice: StatBucket[];
  byOs: StatBucket[];
  byBrowser: StatBucket[];
}

// `column` is one of a fixed internal set below — never user input — so
// interpolating it into the SQL is safe.
async function groupByColumn(
  db: D1Database,
  code: string,
  column: string,
): Promise<StatBucket[]> {
  const { results } = await db
    .prepare(
      `SELECT COALESCE(${column}, 'unknown') AS key, COUNT(*) AS count
       FROM clicks WHERE code = ?
       GROUP BY key ORDER BY count DESC, key ASC`,
    )
    .bind(code)
    .all<StatBucket>();
  return results ?? [];
}

async function byDay(db: D1Database, code: string): Promise<StatBucket[]> {
  const { results } = await db
    .prepare(
      `SELECT strftime('%Y-%m-%d', ts / 1000, 'unixepoch') AS key, COUNT(*) AS count
       FROM clicks WHERE code = ?
       GROUP BY key ORDER BY key ASC`,
    )
    .bind(code)
    .all<StatBucket>();
  return results ?? [];
}

export async function getStats(
  db: D1Database,
  code: string,
): Promise<LinkStats> {
  const totalRow = await db
    .prepare("SELECT COUNT(*) AS n FROM clicks WHERE code = ?")
    .bind(code)
    .first<{ n: number }>();

  const [day, country, referer, device, os, browser] = await Promise.all([
    byDay(db, code),
    groupByColumn(db, code, "country"),
    groupByColumn(db, code, "referer"),
    groupByColumn(db, code, "device"),
    groupByColumn(db, code, "os"),
    groupByColumn(db, code, "browser"),
  ]);

  return {
    total: totalRow?.n ?? 0,
    byDay: day,
    byCountry: country,
    byReferer: referer,
    byDevice: device,
    byOs: os,
    byBrowser: browser,
  };
}
